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

/**
 * إنشاء Domain Alias (Site Alias) في Plesk يوجه إلى الموقع الأساسي
 */
export async function createSiteAlias(
  aliasDomain: string,
  targetSite?: string,
): Promise<any> {
  const { host, apiKey, parentDomain } = getPleskConfig();
  const cleanAlias = normalizeDomainName(aliasDomain);
  const target = targetSite || parentDomain;

  const pleskReady = !!apiKey && !!host && host !== "localhost";
  if (!pleskReady) {
    console.log(
      `🧪 [DEV] Simulated Plesk site-alias creation: ${cleanAlias} -> ${target}`,
    );
    return { success: true, simulated: true, alias: cleanAlias, target };
  }

  console.log(`[Plesk] Creating site alias: ${cleanAlias} for site: ${target}`);

  try {
    return await executePleskCli("sitealias", [
      "--create",
      cleanAlias,
      "-site",
      target,
      "-status",
      "true",
      "-web",
      "true",
      "-seo-redirect",
      "false",
    ]);
  } catch (err: any) {
    if (/already\s+exists?/i.test(err.message)) {
      console.warn(`[Plesk] Site alias ${cleanAlias} already exists — reusing`);
      return { success: true, reused: true, alias: cleanAlias };
    }
    throw err;
  }
}

/**
 * حذف Domain Alias من Plesk
 */
export async function deleteSiteAlias(aliasDomain: string): Promise<any> {
  const { host, apiKey } = getPleskConfig();
  const cleanAlias = normalizeDomainName(aliasDomain);

  const pleskReady = !!apiKey && !!host && host !== "localhost";
  if (!pleskReady) {
    console.log(`🧪 [DEV] Simulated Plesk site-alias deletion: ${cleanAlias}`);
    return { success: true, simulated: true };
  }

  console.log(`[Plesk] Deleting site alias: ${cleanAlias}`);

  try {
    return await executePleskCli("sitealias", ["--delete", cleanAlias]);
  } catch (err: any) {
    console.warn(`[Plesk] Site alias deletion notice: ${err.message}`);
    return { success: false, error: err.message };
  }
}

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

/**
 * إصدار وتثبيت شهادة SSL مجانية (Let's Encrypt / SSL It) لـ Custom Domain Alias
 */
export async function installAliasSsl(aliasDomain: string): Promise<any> {
  const { host, apiKey } = getPleskConfig();
  const cleanAlias = normalizeDomainName(aliasDomain);

  const pleskReady = !!apiKey && !!host && host !== "localhost";
  if (!pleskReady) {
    console.log(`🧪 [DEV] Simulated SSL install for alias: ${cleanAlias}`);
    return { success: true, simulated: true };
  }

  console.log(`[Plesk] Issuing SSL for alias: ${cleanAlias}`);

  return executePleskCli("extension", [
    "--call",
    "sslit",
    "--certificate",
    "-issue",
    "-domain",
    cleanAlias,
    "-secure-domain",
  ]);
}
