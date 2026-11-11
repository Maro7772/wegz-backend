/**
 * Subscription Controller (Tenant Backend)
 *
 * يتحقق مما إذا كان النطاق/العميل الحالي داخل فترة الاشتراك المحددة في Super Admin:
 * من جدول Clients في الـ Master DB:
 * يفحص الشرط: start_date <= now <= end_date
 * ويُرجع true أو false مع تفاصيل الاشتراك.
 */
import type { Request, Response } from "express";
import { getClientLookupModel } from "../config/tenant.js";

export const getSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant;
    if (!tenant) {
      return res.status(401).json({
        in_subscription_period: false,
        is_valid: false,
        message: "No tenant context found for this request",
      });
    }

    // جلب أحدث بيانات العميل مباشرة من قاعدة البيانات المركزية (Master DB)
    const ClientModel = await getClientLookupModel();
    const client = await ClientModel.findById(tenant.clientId).lean();

    if (!client) {
      return res.status(404).json({
        in_subscription_period: false,
        is_valid: false,
        message: "Client record not found in Master database",
      });
    }

    const now = new Date();
    const startDate = client.start_date ? new Date(client.start_date) : null;
    const endDate = client.end_date ? new Date(client.end_date) : null;

    // الشرط الأساسي: هل التاريخ الحالي يقع بين تاريخ البداية والنهاية
    const inSubscriptionPeriod = Boolean(
      startDate && endDate && now >= startDate && now <= endDate,
    );

    // حساب الأيام المتبقية
    let daysRemaining = 0;
    if (endDate && endDate.getTime() > now.getTime()) {
      daysRemaining = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    // حساب حالة الصلاحية العامة (أن يكون داخل الفترة وحسابه active)
    const isValid = inSubscriptionPeriod && client.status === "active";

    res.json({
      in_subscription_period: inSubscriptionPeriod, // true or false كما طُلب
      is_valid: isValid,                            // true or false مع فحص الـ status
      subdomain: client.subdomain,
      subdomain_url: client.subdomain_url || tenant.subdomainUrl,
      custom_domain: client.custom_domain || null,
      company_name: client.company_name,
      start_date: startDate ? startDate.toISOString() : null,
      end_date: endDate ? endDate.toISOString() : null,
      days_remaining: daysRemaining,
      payment_cycle: client.payment_cycle || "monthly",
      status: client.status,
      checked_at: now.toISOString(),
    });
  } catch (err: any) {
    console.error("❌ Subscription check error:", err);
    res.status(500).json({
      in_subscription_period: false,
      is_valid: false,
      message: "Server error checking subscription status",
      error: err.message,
    });
  }
};
