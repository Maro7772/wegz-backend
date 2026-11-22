import https from "node:https";
import dns from "node:dns/promises";
import { PARENT_DOMAIN } from "../config/tenant.js";

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function getPleskConfig() {
  return {
    host: process.env.PLESK_HOST || "",
    port: process.env.PLESK_PORT || "8443",
    apiKey: process.env.PLESK_API_KEY || "",
    parentDomain: process.env.PLESK_PARENT_DOMAIN || PARENT_DOMAIN || "wegz.org",
  };
}

function isPleskReady(): boolean {
  const { host, apiKey } = getPleskConfig();
  return !!apiKey && !!host && host !== "localhost";
}

/**
 * تنفيذ أمر Plesk CLI عبر REST API v2 باستخدام node:https المدمج
 */
async function executePleskCli(utility: string, args: string[]): Promise<any> {
  const { host, port, apiKey } = getPleskConfig();
  if (!apiKey || !host) {
    throw new Error("PLESK_API_KEY or PLESK_HOST is not configured");
  }

  console.log(`[Plesk CLI] plesk bin ${utility} ${args.join(" ")}`);

  const body = JSON.stringify({ params: args });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: Number(port) || 8443,
        path: `/api/v2/cli/${utility}/call`,
        method: "POST",
        agent: httpsAgent,
        timeout: 120_000,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-API-Key": apiKey,
          Accept: "application/json",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { message: raw };
          }

          if ((res.statusCode ?? 500) >= 400) {
            const msg = parsed?.message || `HTTP ${res.statusCode}`;
            const stderr = parsed?.stderr || "";
            return reject(
              new Error(`Plesk CLI execution failed (${utility}): ${msg} - ${stderr}`),
            );
          }

          if (parsed && typeof parsed.code === "number" && parsed.code !== 0) {
            return reject(
              new Error(
                `Plesk CLI execution failed (${utility}): Command failed [${parsed.code}]: ${parsed.stderr || parsed.stdout}`,
              ),
            );
          }

          resolve(parsed);
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Plesk CLI timeout (${utility})`));
    });

    req.on("error", (err) => {
      reject(new Error(`Plesk CLI execution failed (${utility}): ${err.message}`));
    });

    req.write(body);
    req.end();
  });
}

// ============================================================================
// Domain name utilities
// ============================================================================

/**
 * تنظيف اسم الدومين المخصص وإزالة البروتوكول والمسارات
 * مثال: "https://www.sss.net/page" -> "www.sss.net"
 */
export function normalizeDomainName(domain: string): string {
  if (!domain) return "";
  let clean = domain.trim().toLowerCase();
  clean = clean.replace(/^https?:\/\//i, "");
  clean = clean.split("/")[0].split(":")[0];
  clean = clean.replace(/^\.+|\.+$/g, "");
  return clean;
}

/**
 * التحقق من صحة صيغة الدومين المخصص ومنع النطاقات المحجوزة
 */
export function validateCustomDomain(domain: string): string | null {
  const normalized = normalizeDomainName(domain);
  if (!normalized) return "Domain name is required";

  const domainRegex =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
  if (!domainRegex.test(normalized)) {
    return `Invalid domain format: "${domain}". Must be a valid domain like "example.com" or "sub.example.com"`;
  }

  const reserved = [
    "localhost",
    "wegz.org",
    "super.wegz.org",
    "superback.wegz.org",
    "api.wegz.org",
    "admin.wegz.org",
  ];
  if (reserved.includes(normalized)) {
    return `Domain "${normalized}" is reserved and cannot be assigned as a tenant custom domain`;
  }

  return null;
}

// ============================================================================
// Server DNS info
// ============================================================================

/**
 * جلب بيانات السيرفر وإعدادات الـ DNS المطلوبة لتوجيه أي Custom Domain إليه
 */
export async function getServerDnsInfo(): Promise<{
  serverIp: string;
  cnameTarget: string;
  dnsRecords: {
    type: string;
    host: string;
    value: string;
    description: string;
  }[];
  instructions: {
    ar: string;
    en: string;
  };
}> {
  const { host, parentDomain } = getPleskConfig();
  let serverIp = "127.0.0.1";

  try {
    const hostToResolve = host && host !== "localhost" ? host : parentDomain;
    const resolved = await dns.lookup(hostToResolve);
    if (resolved?.address) {
      serverIp = resolved.address;
    }
  } catch (err: any) {
    console.warn("[Plesk] Could not resolve server IP via DNS:", err.message);
  }

  const dnsRecords = [
    {
      type: "A",
      host: "@",
      value: serverIp,
      description: "يوجه النطاق الأساسي (Root Domain مثل yourdomain.com) إلى عنوان السيرفر",
    },
    {
      type: "CNAME",
      host: "www",
      value: parentDomain,
      description: `يوجه النطاق الفرعي www (مثل www.yourdomain.com) إلى سيرفر ${parentDomain}`,
    },
  ];

  return {
    serverIp,
    cnameTarget: parentDomain,
    dnsRecords,
    instructions: {
      ar: `قم بالدخول إلى لوحة تحكم النطاق الخاص بك (مثل GoDaddy, Namecheap, Cloudflare) وأضف سجلات الـ DNS الموضحة أعلاه. يستغرق انتشار الـ DNS من بضع دقائق وحتى 24 ساعة.`,
      en: `Go to your domain registrar DNS settings (e.g. GoDaddy, Namecheap, Cloudflare) and add the A and CNAME records shown above. DNS propagation typically takes a few minutes up to 24 hours.`,
    },
  };
}

// ============================================================================
// Custom Domain Website Management (Plesk site --create)
// ============================================================================

/**
 * إنشاء Website كامل في Plesk للدومين المخصص
 * يستخدم `plesk bin site --create` بدلاً من `sitealias`
 * هذا ينشئ DNS Zone تلقائياً + hosting + www-root يشير لفولدر الـ subdomain
 *
 * @param customDomain - الدومين المخصص (مثل truckzita.com)
 * @param subdomain    - اسم الـ subdomain الخاص بالعميل (مثل truckzita)
 */
export async function createCustomDomainWebsite(
  customDomain: string,
  subdomain?: string,
  options: {
    wwwRoot?: string;
    nodeVersion?: string;
  } = {},
): Promise<any> {
  const { parentDomain } = getPleskConfig();
  const cleanDomain = normalizeDomainName(customDomain);
  // التوجيه لنفس مجلد الفرونت إند كما في wegz.org (/httpdocs)
  const wwwRoot = options.wwwRoot || process.env.CUSTOM_DOMAIN_WWW_ROOT || "httpdocs";
  const docRoot = wwwRoot.startsWith("/") ? wwwRoot : `/${wwwRoot}`;
  const nodeVersion = options.nodeVersion || process.env.NODE_JS_VERSION || "22.23.5";

  if (!isPleskReady()) {
    const { host, apiKey } = getPleskConfig();
    const reason = !apiKey
      ? "PLESK_API_KEY is not set or empty in .env"
      : !host
      ? "PLESK_HOST is not set or empty in .env"
      : `PLESK_HOST is "${host}" (must not be localhost)`;
    console.error(`❌ [Plesk] Cannot connect to Plesk: ${reason}`);
    throw new Error(`Plesk configuration error: ${reason}`);
  }

  console.log(
    `[Plesk] Creating website: ${cleanDomain} | webspace: ${parentDomain} | www-root: ${wwwRoot}`,
  );

  let siteResult: any = null;
  try {
    siteResult = await executePleskCli("site", [
      "--create",
      cleanDomain,
      "-webspace-name",
      parentDomain,
      "-hosting",
      "true",
      "-www-root",
      wwwRoot,
    ]);
  } catch (err: any) {
    if (/already\s+exists?/i.test(err.message)) {
      console.warn(`[Plesk] Website ${cleanDomain} already exists — updating www-root to ${wwwRoot}`);
      await executePleskCli("site", [
        "--update",
        cleanDomain,
        "-www-root",
        wwwRoot,
      ]).catch((uErr) => console.warn(`[Plesk] site update www-root notice: ${uErr.message}`));
      siteResult = { success: true, reused: true, domain: cleanDomain };
    } else {
      throw err;
    }
  }

  // تفعيل وضبط Node.js على الدومين الجديد ليتطابق مع wegz.org
  try {
    console.log(`[Plesk] Enabling Node.js ${nodeVersion} on ${cleanDomain}...`);
    await executePleskCli("extension", [
      "--call",
      "nodejs",
      "--enable",
      "-domain",
      cleanDomain,
      "-version",
      nodeVersion,
    ]);

    // ضبط إعدادات Node.js (App Root: /httpdocs, Document Root: docRoot)
    try {
      await executePleskCli("extension", [
        "--call",
        "nodejs",
        "--set",
        "-domain",
        cleanDomain,
        "-app-root",
        "/httpdocs",
        "-doc-root",
        docRoot,
        "-app-file",
        "index.html",
        "-app-mode",
        "production",
      ]);
    } catch (setErr: any) {
      console.warn(`[Plesk] Node.js set notice for ${cleanDomain}: ${setErr.message}`);
    }
  } catch (nodeErr: any) {
    console.warn(`[Plesk] Node.js enable notice for ${cleanDomain}: ${nodeErr.message}`);
  }

  return siteResult;
}

/**
 * حذف Website من Plesk
 */
export async function deleteCustomDomainWebsite(
  customDomain: string,
): Promise<any> {
  const cleanDomain = normalizeDomainName(customDomain);

  if (!isPleskReady()) {
    console.log(`🧪 [DEV] Simulated website deletion: ${cleanDomain}`);
    return { success: true, simulated: true };
  }

  console.log(`[Plesk] Deleting website: ${cleanDomain}`);

  try {
    return await executePleskCli("site", ["--delete", cleanDomain]);
  } catch (err: any) {
    console.warn(`[Plesk] Website deletion notice: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ============================================================================
// DNS Verification
// ============================================================================

/**
 * فحص انتشار الـ DNS للنطاق والتأكد من أنه يشير إلى السيرفر
 */
export async function verifyDomainDns(
  domain: string,
  expectedIp?: string,
): Promise<{
  pointed: boolean;
  currentIps: string[];
  expectedIp: string;
}> {
  const cleanDomain = normalizeDomainName(domain);

  let targetIp = expectedIp;
  if (!targetIp) {
    const dnsInfo = await getServerDnsInfo();
    targetIp = dnsInfo.serverIp;
  }

  try {
    const resolvedIps = await dns.resolve4(cleanDomain);
    const pointed = resolvedIps.includes(targetIp);

    return {
      pointed,
      currentIps: resolvedIps,
      expectedIp: targetIp,
    };
  } catch {
    return {
      pointed: false,
      currentIps: [],
      expectedIp: targetIp,
    };
  }
}

// ============================================================================
// SSL
// ============================================================================

/**
 * إصدار وتثبيت شهادة SSL مجانية (Let's Encrypt / SSL It) للدومين المخصص
 */
export async function installDomainSsl(domain: string): Promise<any> {
  const cleanDomain = normalizeDomainName(domain);

  if (!isPleskReady()) {
    const { host, apiKey } = getPleskConfig();
    const reason = !apiKey
      ? "PLESK_API_KEY is not set or empty in .env"
      : !host
      ? "PLESK_HOST is not set or empty in .env"
      : `PLESK_HOST is "${host}" (must not be localhost)`;
    console.error(`❌ [Plesk] Cannot connect to Plesk: ${reason}`);
    throw new Error(`Plesk configuration error: ${reason}`);
  }

  console.log(`[Plesk] Issuing SSL for: ${cleanDomain}`);

  return executePleskCli("extension", [
    "--call",
    "sslit",
    "--certificate",
    "-issue",
    "-domain",
    cleanDomain,
    "-secure-domain",
  ]);
}
