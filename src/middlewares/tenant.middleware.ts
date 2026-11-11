/**
 * Wildcard Tenant Resolution Middleware
 *
 * 1. يستخرج الـ subdomain أو النطاق من:
 *    - Host header (مثل api-acme.wegz.org أو acme.wegz.org أو acme.localhost)
 *    - X-Tenant-Subdomain header
 *    - Origin / Referer headers (في طلبات الـ CORS من الفرونت إند)
 *    - Query parameter (للاختبارات)
 * 2. يبحث عن العميل في Master DB:
 *    - IClient.subdomain (المقطع الأول فقط)
 *    - IClient.subdomain_url (الرابط بالكامل)
 * 3. إذا لم يكن الـ subdomain مسجلاً أو نشطاً:
 *    يُرجع HTTP 401 Unauthorized كما هو مطلوب بدقة
 * 4. يربط الاتصال بقاعدة بيانات العميل ويغذي AsyncLocalStorage بالموديلات
 */
import type { Request, Response, NextFunction } from "express";
import { resolveTenant, getTenantConnection, PARENT_DOMAIN, type TenantInfo } from "../config/tenant.js";
import { buildTenantModels, type TenantModels } from "../config/tenantModels.js";
import { tenantStorage } from "../config/tenantContext.js";

// تمديد نوع الـ Request ليشمل بيانات العميل
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantInfo;
      tenantModels?: TenantModels;
    }
  }
}

/**
 * دالة مساعدة لاستخراج الـ subdomain من الـ hostname
 */
export function extractSubdomainFromHost(rawHost?: string): string | null {
  if (!rawHost) return null;

  // إزالة المنفذ إن وجد (مثل :3000)
  const host = rawHost.split(":")[0].toLowerCase().trim();

  // تجاهل الـ IP الصريح والـ localhost المجرد
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host === "localhost") {
    return null;
  }

  // إذا كان على نطاق localhost مع subdomain (مثل: acme.localhost أو api-acme.localhost)
  if (host.endsWith(".localhost")) {
    const sub = host.slice(0, -".localhost".length);
    return cleanSubdomainSegment(sub);
  }

  // إذا كان الهوست يبدأ بـ api- (مثل api-acme.wegz.org أو api-acme.domain.com)
  if (host.startsWith("api-")) {
    const withoutApi = host.slice(4); // إزالة api-
    const parts = withoutApi.split(".");
    return cleanSubdomainSegment(parts[0]);
  }

  // إذا كان على النطاق الأب الافتراضي (مثل acme.wegz.org)
  const parent = PARENT_DOMAIN.toLowerCase();
  if (host.endsWith(`.${parent}`)) {
    const sub = host.slice(0, -(parent.length + 1));
    return cleanSubdomainSegment(sub);
  }

  // لأي نطاق فرعي من مستوى ثالث فأكثر (e.g. sub.domain.com)
  const parts = host.split(".");
  if (parts.length >= 3) {
    return cleanSubdomainSegment(parts[0]);
  }

  return null;
}

/**
 * ينظف المقطع ويستخرج اسم الـ subdomain المباشر
 */
function cleanSubdomainSegment(segment: string): string | null {
  if (!segment) return null;
  let clean = segment.toLowerCase().trim();

  // إزالة أي بادئة api- إن كانت لا تزال موجودة
  if (clean.startsWith("api-")) {
    clean = clean.slice(4);
  }
  // إزالة أي لاحقة -api
  if (clean.endsWith("-api")) {
    clean = clean.slice(0, -4);
  }

  // تجاهل النطاقات المحجوزة
  const reserved = ["www", "api", "admin", "super", "superback", "mail", "ftp", "cpanel"];
  if (reserved.includes(clean)) {
    return null;
  }

  return clean || null;
}

/**
 * استخراج الـ subdomain من الـ Origin أو Referer header
 */
function extractSubdomainFromUrl(urlStr?: string): string | null {
  if (!urlStr) return null;
  try {
    const url = new URL(urlStr);
    return extractSubdomainFromHost(url.host);
  } catch {
    return null;
  }
}

/**
 * Tenant Middleware الرئيسي
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // استثناء فحص الصحة من قيود الـ subdomain
  if (req.path === "/health" || req.path === "/health/") {
    return next();
  }

  try {
    // 1. محاولة استخراج الـ subdomain من المصادر المختلفة بترتيب الأولوية
    const headerSubdomain =
      (req.headers["x-tenant-subdomain"] as string) ||
      (req.headers["x-subdomain"] as string);

    const host = (req.headers["x-forwarded-host"] as string) || req.headers.host;
    const origin = (req.headers.origin as string) || (req.headers.referer as string);
    const querySubdomain = req.query.subdomain as string | undefined;

    const extractedSubdomain =
      headerSubdomain?.trim() ||
      extractSubdomainFromHost(host) ||
      extractSubdomainFromUrl(origin) ||
      querySubdomain?.trim();

    // 2. البحث عن الـ tenant في قاعدة البيانات الرئيسية
    const tenant = await resolveTenant({
      subdomain: extractedSubdomain || undefined,
      host: host || undefined,
      origin: origin || undefined,
      fullUrl: host ? `${req.protocol}://${host}` : undefined,
    });

    // 3. إذا لم يكن الـ subdomain مسجلاً: إرجاع 401 فورًا
    if (!tenant) {
      res.status(401).json({
        message: "Unauthorized: Invalid or unregistered subdomain",
        subdomain: extractedSubdomain || null,
      });
      return;
    }

    // إذا كان حساب العميل موقوفاً أو غير نشط
    if (tenant.status !== "active") {
      res.status(401).json({
        message: `Unauthorized: Tenant account is ${tenant.status}`,
        subdomain: tenant.subdomain,
      });
      return;
    }

    // 4. جلب اتصال قاعدة بيانات العميل وموديلاته
    const tenantConnection = getTenantConnection(tenant.dbName);
    const tenantModels = buildTenantModels(tenantConnection);

    // ربط البيانات بطلب Express الحالي
    req.tenant = tenant;
    req.tenantModels = tenantModels;

    // 5. تشغيل الـ request داخل سياق AsyncLocalStorage لعزل البيانات بالكامل
    tenantStorage.run(
      {
        tenant,
        connection: tenantConnection,
        models: tenantModels,
      },
      () => {
        next();
      },
    );
  } catch (err: any) {
    console.error("â Œ Error resolving tenant:", err);
    res.status(500).json({
      message: "Internal server error during tenant resolution",
      error: err.message,
    });
  }
}
