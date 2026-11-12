import type { Request, Response } from "express";
import { getClientLookupModel, PARENT_DOMAIN } from "../config/tenant.js";
import {
  getServerDnsInfo,
  normalizeDomainName,
  validateCustomDomain,
  createSiteAlias,
  deleteSiteAlias,
  verifyDomainDns,
  installAliasSsl,
} from "../services/plesk.service.js";

/**
 * يجلب سجل العميل الخاص بالـ tenant الحالي مع التحقق من ملكية المعرّف إن وُجد في المسار
 */
async function getTenantClient(
  req: Request,
  res: Response,
  checkParamId = false,
): Promise<any | null> {
  const tenant = req.tenant;
  if (!tenant) {
    res.status(401).json({
      success: false,
      message: "No tenant context found for this request",
    });
    return null;
  }

  if (checkParamId && req.params.id && req.params.id !== tenant.clientId) {
    res.status(403).json({
      success: false,
      message: "Forbidden: You can only manage custom domains for your own tenant",
    });
    return null;
  }

  const ClientModel = await getClientLookupModel();
  const client = await ClientModel.findById(tenant.clientId);
  if (!client) {
    res.status(404).json({
      success: false,
      message: "Client not found",
    });
    return null;
  }

  return client;
}

/**
 * GET /api/admin/custom-domains/server-info
 * يعرض بيانات السيرفر وإعدادات الـ DNS المطلوبة ليتمكن العميل من توجيه نطاقه إليه
 */
export const getServerDnsInfoHandler = async (_req: Request, res: Response) => {
  try {
    const dnsInfo = await getServerDnsInfo();

    return res.json({
      success: true,
      message: "Server DNS instructions retrieved",
      data: dnsInfo,
    });
  } catch (err: any) {
    console.error("❌ Get server DNS info error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error retrieving DNS info",
    });
  }
};

/**
 * GET /api/admin/custom-domains
 * يعرض بيانات النطاق المخصص المسجل للعميل الحالي
 */
export const listCustomDomainsHandler = async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({
        success: false,
        message: "No tenant context found for this request",
      });
    }

    const ClientModel = await getClientLookupModel();
    const clients = await ClientModel.find({
      _id: tenant.clientId,
      custom_domain: { $exists: true, $nin: [null, ""] },
    })
      .select(
        "_id company_name subdomain subdomain_url custom_domain custom_domain_status custom_domain_ssl custom_domain_created_at custom_domain_verified_at status",
      )
      .lean();

    return res.json({
      success: true,
      message: "Custom domains retrieved",
      data: {
        total: clients.length,
        domains: clients,
      },
    });
  } catch (err: any) {
    console.error("❌ List custom domains error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error retrieving custom domains",
    });
  }
};

/**
 * POST /api/admin/custom-domains
 * يربط دومين مخصص بـ tenant الواجهة الأمامية الحالي تلقائيًا دون الحاجة لإرسال subdomain
 * body: { custom_domain: string }
 */
export const assignCustomDomainHandler = async (req: Request, res: Response) => {
  try {
    const { custom_domain } = req.body || {};

    if (!custom_domain) {
      return res.status(400).json({
        success: false,
        message: "custom_domain is required",
      });
    }

    const cleanDomain = normalizeDomainName(custom_domain);
    const validationError = validateCustomDomain(cleanDomain);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const client = await getTenantClient(req, res);
    if (!client) return;

    // التأكد من أن هذا الدومين غير مخصص لعميل آخر
    const ClientModel = await getClientLookupModel();
    const existingOther = await ClientModel.findOne({
      _id: { $ne: client._id },
      custom_domain: cleanDomain,
    }).lean();

    if (existingOther) {
      return res.status(409).json({
        success: false,
        message: `Custom domain "${cleanDomain}" is already assigned to another client (${existingOther.subdomain})`,
      });
    }

    const parentDomain = process.env.PLESK_PARENT_DOMAIN || PARENT_DOMAIN || "wegz.org";

    // حذف الـ Alias القديم من Plesk وإعادة ضبط حالة SSL إذا تم تغيير الدومين
    const previousDomain = client.custom_domain;
    if (previousDomain && previousDomain !== cleanDomain) {
      await deleteSiteAlias(previousDomain).catch((err) =>
        console.warn(`[CustomDomain] Delete previous alias notice: ${err.message}`),
      );
      client.custom_domain_ssl = false;
      client.custom_domain_verified_at = undefined;
    }

    // 1. إنشاء الـ Site Alias في Plesk
    let pleskAliasResult: any = null;
    try {
      pleskAliasResult = await createSiteAlias(cleanDomain, parentDomain);
    } catch (err: any) {
      console.warn(`[CustomDomain] Plesk alias warning: ${err.message}`);
    }

    // 2. فحص انتشار الـ DNS مباشرة لمعرفة هل العميل قام بالتوجيه أم لا
    const dnsStatus = await verifyDomainDns(cleanDomain);
    const domainStatus = dnsStatus.pointed ? "active" : "pending_dns";

    // 3. تحديث بيانات العميل في الـ Master DB
    client.custom_domain = cleanDomain;
    client.custom_domain_status = domainStatus;
    client.custom_domain_created_at = new Date();
    if (dnsStatus.pointed) {
      client.custom_domain_verified_at = new Date();
    }
    await client.save();

    const dnsInfo = await getServerDnsInfo();

    return res.status(201).json({
      success: true,
      message: dnsStatus.pointed
        ? "Custom domain assigned and DNS is pointing successfully!"
        : "Custom domain assigned. Please update your domain DNS records as indicated.",
      data: {
        client_id: client._id,
        subdomain: client.subdomain,
        target_url: client.subdomain_url || `https://${client.subdomain}.${parentDomain}`,
        custom_domain: cleanDomain,
        status: domainStatus,
        dns_status: dnsStatus,
        dns_instructions: dnsInfo.dnsRecords,
        plesk_result: pleskAliasResult,
      },
    });
  } catch (err: any) {
    console.error("❌ Assign custom domain error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error assigning custom domain",
    });
  }
};

/**
 * DELETE /api/admin/custom-domains/:id
 * يحذف النطاق المخصص من العميل ويلغي الـ Alias من Plesk
 */
export const removeCustomDomainHandler = async (req: Request, res: Response) => {
  try {
    const client = await getTenantClient(req, res, true);
    if (!client) return;

    const previousDomain = client.custom_domain;
    if (!previousDomain) {
      return res.status(400).json({
        success: false,
        message: "Client does not have a custom domain assigned",
      });
    }

    await deleteSiteAlias(previousDomain).catch((err) =>
      console.warn(`[CustomDomain] Delete alias notice: ${err.message}`),
    );

    client.custom_domain = undefined;
    client.custom_domain_status = "disabled";
    client.custom_domain_ssl = false;
    await client.save();

    return res.json({
      success: true,
      message: `Custom domain "${previousDomain}" removed successfully`,
    });
  } catch (err: any) {
    console.error("❌ Remove custom domain error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error removing custom domain",
    });
  }
};

/**
 * POST /api/admin/custom-domains/:id/verify-dns
 * فحص انتشار الـ DNS للنطاق وتحديث حالته لـ active إذا كان يشير للسيرفر
 */
export const verifyCustomDomainDnsHandler = async (req: Request, res: Response) => {
  try {
    const client = await getTenantClient(req, res, true);
    if (!client) return;

    if (!client.custom_domain) {
      return res.status(404).json({
        success: false,
        message: "Client or custom domain not found",
      });
    }

    const dnsCheck = await verifyDomainDns(client.custom_domain);

    if (dnsCheck.pointed && client.custom_domain_status !== "active") {
      client.custom_domain_status = "active";
      client.custom_domain_verified_at = new Date();
      await client.save();

      // محاولة إصدار شهادة SSL تلقائياً بمجرد تأكيد الـ DNS
      installAliasSsl(client.custom_domain)
        .then(async () => {
          client.custom_domain_ssl = true;
          await client.save();
        })
        .catch((sslErr) => {
          console.warn(`[SSL Auto-Issue notice]: ${sslErr.message}`);
        });
    }

    return res.json({
      success: true,
      message: dnsCheck.pointed
        ? "DNS verified successfully! Domain is active."
        : "DNS is not pointing to this server yet. Please verify your A and CNAME records.",
      data: {
        domain: client.custom_domain,
        pointed: dnsCheck.pointed,
        current_ips: dnsCheck.currentIps,
        expected_ip: dnsCheck.expectedIp,
        status: client.custom_domain_status,
      },
    });
  } catch (err: any) {
    console.error("❌ Verify custom domain DNS error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error verifying custom domain DNS",
    });
  }
};

/**
 * POST /api/admin/custom-domains/:id/ssl
 * إصدار شهادة SSL للنطاق المخصص عبر Plesk
 */
export const installCustomDomainSslHandler = async (req: Request, res: Response) => {
  try {
    const client = await getTenantClient(req, res, true);
    if (!client) return;

    if (!client.custom_domain) {
      return res.status(404).json({
        success: false,
        message: "Client or custom domain not found",
      });
    }

    const dnsCheck = await verifyDomainDns(client.custom_domain);
    if (!dnsCheck.pointed) {
      return res.status(400).json({
        success: false,
        message: `Cannot issue SSL for "${client.custom_domain}". The domain does not point to this server (${dnsCheck.expectedIp}) yet.`,
      });
    }

    const sslResult = await installAliasSsl(client.custom_domain);
    client.custom_domain_ssl = true;
    await client.save();

    return res.json({
      success: true,
      message: `SSL certificate installed successfully for ${client.custom_domain}`,
      data: sslResult,
    });
  } catch (err: any) {
    console.error("❌ Install custom domain SSL error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error installing custom domain SSL",
    });
  }
};
