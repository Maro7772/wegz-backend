import { getClientLookupModel } from "../config/tenant.js";
import {
  verifyDomainDns,
  installAliasSsl,
  ensureAliasDnsZone,
} from "./plesk.service.js";

// قائمة بأسماء النطاقات التي يجري فحصها في الخلفية حالياً لمنع تكرار الـ jobs
const activeDomainJobs = new Set<string>();

interface BackgroundVerificationOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
}

/**
 * يبدأ عملية فحص انتشار الـ DNS وإصدار شهادة SSL تلقائياً في الخلفية
 * تُجرى محاولات ذكية متتالية:
 * - كل 30 ثانية لأول 6 محاولات
 * - كل دقيقتين للمحاولات التالية
 * - كل 5 دقائق حتى اكتمال 60 محاولة (حوالي 4-5 ساعات)
 * بمجرد توجيه الـ DNS يتم إصدار الشهادة تلقائياً وتفعيل النطاق في قاعدة البيانات
 */
export function startDomainBackgroundVerification(
  clientId: string,
  domain: string,
  options: BackgroundVerificationOptions = {},
): void {
  const cleanDomain = domain.trim().toLowerCase();
  if (!cleanDomain) return;

  if (activeDomainJobs.has(cleanDomain)) {
    console.log(`[Background Domain] Verification already active for "${cleanDomain}"`);
    return;
  }

  activeDomainJobs.add(cleanDomain);
  console.log(`🚀 [Background Domain] Started background SSL watcher for "${cleanDomain}" (Client ID: ${clientId})`);

  let attempt = 0;
  const maxAttempts = options.maxAttempts || 60;

  const checkNext = async () => {
    attempt++;
    try {
      // محاولة تفعيل الـ DNS Zone في السيرفر تحسباً لو أن الدومين موجه لـ Nameservers السيرفر
      if (attempt === 1) {
        await ensureAliasDnsZone(cleanDomain).catch(() => {});
      }

      const dnsCheck = await verifyDomainDns(cleanDomain);

      if (dnsCheck.pointed) {
        console.log(`✅ [Background Domain] Domain "${cleanDomain}" is now pointing to server (${dnsCheck.expectedIp})!`);
        console.log(`🔐 [Background Domain] Auto-issuing SSL certificate for "${cleanDomain}"...`);

        try {
          await installAliasSsl(cleanDomain);
          console.log(`🎉 [Background Domain] SSL successfully installed for "${cleanDomain}"!`);

          const ClientModel = await getClientLookupModel();
          await ClientModel.findByIdAndUpdate(clientId, {
            custom_domain_status: "active",
            custom_domain_ssl: true,
            custom_domain_verified_at: new Date(),
          });

          console.log(`💾 [Background Domain] Client record updated for "${cleanDomain}"`);
        } catch (sslErr: any) {
          console.error(`❌ [Background Domain] SSL auto-issuance error for "${cleanDomain}":`, sslErr.message);
          // إذا فشل الـ SSL مؤقتاً، نستمر في المحاولة
          if (attempt < maxAttempts) {
            scheduleNext();
            return;
          }
        }

        activeDomainJobs.delete(cleanDomain);
        return;
      }

      if (attempt >= maxAttempts) {
        console.warn(`⚠️ [Background Domain] Max verification attempts (${maxAttempts}) reached for "${cleanDomain}". Watcher paused.`);
        activeDomainJobs.delete(cleanDomain);
        return;
      }

      scheduleNext();
    } catch (err: any) {
      console.warn(`[Background Domain] Verification tick error for "${cleanDomain}":`, err.message);
      if (attempt < maxAttempts) {
        scheduleNext();
      } else {
        activeDomainJobs.delete(cleanDomain);
      }
    }
  };

  const scheduleNext = () => {
    let delayMs = 30_000; // 30 ثانية في البداية
    if (attempt > 15) {
      delayMs = 300_000; // 5 دقائق بعد أول 15 محاولة
    } else if (attempt > 5) {
      delayMs = 120_000; // دقيقتان
    }

    setTimeout(checkNext, delayMs);
  };

  // نبدأ أول محاولة بعد مهلة قصيرة
  setTimeout(checkNext, options.initialDelayMs || 5_000);
}

/**
 * فاحص دوري على مستوى النظام يبحث عن أي نطاق مخصص قيد الانتظار
 * مفيد بعد إعادة تشغيل السيرفر لضمان عدم ضياع أي دومين لم تكتمل شهادته
 */
export async function runPendingCustomDomainsCheck(): Promise<void> {
  try {
    const ClientModel = await getClientLookupModel();
    const pendingClients = await ClientModel.find({
      custom_domain: { $exists: true, $nin: [null, ""] },
      custom_domain_status: { $ne: "disabled" },
      $or: [
        { custom_domain_status: "pending_dns" },
        { custom_domain_ssl: false },
      ],
    }).select("_id custom_domain custom_domain_status custom_domain_ssl");

    if (!pendingClients || pendingClients.length === 0) return;

    console.log(`[Background Scanner] Checking ${pendingClients.length} pending custom domain(s)...`);

    for (const client of pendingClients) {
      if (!activeDomainJobs.has(client.custom_domain)) {
        startDomainBackgroundVerification(client._id.toString(), client.custom_domain, {
          initialDelayMs: 2_000,
        });
      }
    }
  } catch (err: any) {
    console.warn("[Background Scanner] Failed to scan pending domains:", err.message);
  }
}

/**
 * تهيئة الجدولة الدورية عند إقلاع السيرفر
 */
export function initPeriodicCustomDomainWorker(): void {
  // فحص مبدئي بعد دقيقة من بدء السيرفر
  setTimeout(() => {
    runPendingCustomDomainsCheck().catch(() => {});
  }, 60_000);

  // تكرار الفحص الدوري كل 15 دقيقة
  setInterval(() => {
    runPendingCustomDomainsCheck().catch(() => {});
  }, 15 * 60_000);

  console.log("🕒 [Background Worker] Custom Domain SSL auto-issuance worker initialized.");
}
