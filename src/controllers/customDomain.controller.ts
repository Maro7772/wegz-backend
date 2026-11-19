import type { Request, Response } from "express";
import { getClientLookupModel, PARENT_DOMAIN } from "../config/tenant.js";
import {
  getServerDnsInfo,
  normalizeDomainName,
  validateCustomDomain,
  deleteCustomDomainWebsite,
  verifyDomainDns,
} from "../services/plesk.service.js";
import { startDomainBackgroundSetup } from "../services/customDomainBackground.service.js";

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
 * يربط دومين مخصص بالعميل الحالي — الـ subdomain يتحدد تلقائياً من الـ tenant
 * body: { custom_domain: string }
 *
 * كل العمليات الثقيلة (إنشاء website في Plesk، فحص DNS، إصدار SSL) تتم في الخلفية
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

    // حذف الـ Website القديم من Plesk إذا تم تغيير الدومين
    const previousDomain = client.custom_domain;
    if (previousDomain && previousDomain !== cleanDomain) {
      deleteCustomDomainWebsite(previousDomain).catch((err) =>
        console.warn(`[CustomDomain] Delete previous website notice: ${err.message}`),
      );
      client.custom_domain_ssl = false;
      client.custom_domain_verified_at = undefined;
    }

    // تحديث بيانات العميل في الـ Master DB فوراً
    client.custom_domain = cleanDomain;
    client.custom_domain_status = "pending_setup";
    client.custom_domain_created_at = new Date();
    await client.save();

    // تشغيل كل العمليات في الخلفية: إنشاء Website → فحص DNS → إصدار SSL
    startDomainBackgroundSetup(
      client._id.toString(),
      cleanDomain,
      client.subdomain,
    );

    const dnsInfo = await getServerDnsInfo();

    return res.status(201).json({
      success: true,
      message:
        "Custom domain setup started! Website creation, DNS verification, and SSL will be configured automatically in the background.",
      data: {
        client_id: client._id,
        subdomain: client.subdomain,
        target_url: client.subdomain_url || `https://${client.subdomain}.${parentDomain}`,
        custom_domain: cleanDomain,
        status: "pending_setup",
        dns_instructions: dnsInfo.dnsRecords,
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
 * يحذف النطاق المخصص من العميل ويحذف الـ Website من Plesk
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

    // حذف الـ Website من Plesk في الخلفية
    deleteCustomDomainWebsite(previousDomain).catch((err) =>
      console.warn(`[CustomDomain] Delete website notice: ${err.message}`),
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
 * فحص انتشار الـ DNS للنطاق وتحديث حالته
 * إذا لم يكتمل بعد يبدأ فاحص المراقبة في الخلفية تلقائياً
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
    }

    // إذا لم يكتمل الـ DNS بعد، نعيد تشغيل المراقبة في الخلفية
    if (!dnsCheck.pointed) {
      startDomainBackgroundSetup(
        client._id.toString(),
        client.custom_domain,
        client.subdomain,
      );
    }

    return res.json({
      success: true,
      message: dnsCheck.pointed
        ? "DNS verified successfully! Domain is active."
        : "DNS is not pointing to this server yet. Background watcher is active.",
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
 * إصدار شهادة SSL للنطاق المخصص — إذا الـ DNS لم يكتمل بعد، تشتغل في الخلفية تلقائياً
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

    // نعيد تشغيل الفاحص الكامل (website + DNS + SSL) في الخلفية
    startDomainBackgroundSetup(
      client._id.toString(),
      client.custom_domain,
      client.subdomain,
    );

    return res.json({
      success: true,
      message:
        "SSL setup started in the background. The certificate will be issued automatically once DNS is verified.",
      data: {
        domain: client.custom_domain,
        status: client.custom_domain_status,
        ssl_status: "pending_background",
      },
    });
  } catch (err: any) {
    console.error("❌ Install custom domain SSL error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Server error installing custom domain SSL",
    });
  }
};
