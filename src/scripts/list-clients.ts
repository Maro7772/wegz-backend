import "dotenv/config";
import mongoose from "mongoose";
import { getClientLookupModel } from "../config/tenant.js";

async function main() {
  console.log("🔍 Checking registered tenants in Master DB...\n");

  try {
    const ClientModel = await getClientLookupModel();
    const clients = await ClientModel.find(
      {},
      "subdomain company_name status backend_url custom_domain",
    )
      .sort({ createdAt: -1 })
      .lean();

    if (!clients || clients.length === 0) {
      console.log("⚠️ No clients found in Master DB.");
      process.exit(0);
    }

    console.log(`Found ${clients.length} client(s):\n`);
    clients.forEach((c: any, i: number) => {
      console.log(
        `  ${i + 1}. Subdomain: [ ${c.subdomain} ] | Status: [ ${c.status} ] | Company: "${c.company_name}"`,
      );
      if (c.custom_domain) {
        console.log(`     Custom Domain: ${c.custom_domain}`);
      }
      if (c.backend_url) {
        console.log(`     Backend URL:   ${c.backend_url}`);
      }
    });

    console.log(
      "\n💡 استخدم أي Subdomain نشط (status: active) من القائمة أعلاه لاختبار الـ API.",
    );
  } catch (err: any) {
    console.error("❌ Error fetching clients:", err.message);
  } finally {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  }
}

main();
