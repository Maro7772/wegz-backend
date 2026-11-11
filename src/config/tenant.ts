/**
 * Wildcard Multi-Tenancy — Dynamic DB Connection Manager
 *
 * يدير اتصالات MongoDB لكل tenant:
 * 1. Master Connection: للتحقق من العميل والـ subdomain من جدول Clients
 * 2. Tenant Connection: قاعدة بيانات مستقلة لكل عميل (sc_<clientId>)
 */
import mongoose from "mongoose";

export interface TenantInfo {
  clientId: string;
  subdomain: string;        // المقطع الأول فقط (e.g. "acme")
  subdomainUrl: string;     // الـ URL بالكامل (e.g. "https://acme.wegz.org")
  backendUrl: string;       // e.g. "https://api-acme.wegz.org"
  dbName: string;           // e.g. "sc_6730..."
  companyName: string;
  status: "active" | "suspended" | "pending";
  sections: string[];
  start_date?: Date;
  end_date?: Date;
  payment_cycle?: string;
  payment_amount?: number;
  custom_domain?: string;
}

// ── Cache للاتصالات لتفادي إعادة الاتصال مع كل request ────────────────────────
const tenantConnectionCache = new Map<string, mongoose.Connection>();
let masterConnection: mongoose.Connection | null = null;
let ClientLookupModel: mongoose.Model<any> | null = null;

// ── Configuration ──────────────────────────────────────────────────────────
const MASTER_MONGO_URI =
  process.env.SUPER_MONGO_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/super_wegz";
const TENANT_MONGO_BASE_URI =
  process.env.TENANT_MONGO_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
export const PARENT_DOMAIN = process.env.PARENT_DOMAIN || "wegz.org";

// ── Master Connection ──────────────────────────────────────────────────────

export async function getMasterConnection(): Promise<mongoose.Connection> {
  if (masterConnection && masterConnection.readyState === 1) {
    return masterConnection;
  }

  try {
    masterConnection = mongoose.createConnection(MASTER_MONGO_URI);
    await masterConnection.asPromise();
    console.log("âœ… Master DB connected (Super Client lookup)");
    return masterConnection;
  } catch (err: any) {
    console.error("â Œ Master DB connection error:", err.message);
    throw err;
  }
}

// ── Client Model على الـ Master DB ────────────────────────────────────────

const clientSchemaDefinition = new mongoose.Schema(
  {
    company_name: { type: String, required: true },
    email: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, index: true },
    subdomain_url: { type: String, index: true },
    backend_url: String,
    db_name: String,
    status: {
      type: String,
      enum: ["active", "suspended", "pending"],
      default: "pending",
    },
    sections: [{ type: mongoose.Schema.Types.ObjectId }],
    provisioning_status: String,
    start_date: Date,
    end_date: Date,
    payment_cycle: String,
    payment_amount: Number,
    custom_domain: { type: String, index: true },
  },
  { timestamps: true, collection: "clients" },
);

export async function getClientLookupModel(): Promise<mongoose.Model<any>> {
  if (ClientLookupModel) return ClientLookupModel;

  const conn = await getMasterConnection();
  ClientLookupModel =
    conn.models.Client || conn.model("Client", clientSchemaDefinition);
  return ClientLookupModel;
}

// ── Tenant Resolution ──────────────────────────────────────────────────────

export interface ResolveTenantOptions {
  subdomain?: string;
  host?: string;
  origin?: string;
  fullUrl?: string;
}

/**
 * يبحث عن الـ tenant في قاعدة البيانات الرئيسية (Master DB):
 * 1. بمطابقة IClient.subdomain (المقطع الأول: "acme")
 * 2. أو بمطابقة IClient.subdomain_url (الرابط بالكامل: "https://acme.wegz.org")
 * 3. أو بمطابقة الـ Host مع subdomain_url
 */
export async function resolveTenant(
  options: ResolveTenantOptions,
): Promise<TenantInfo | null> {
  const Client = await getClientLookupModel();

  const queries: any[] = [];

  if (options.subdomain) {
    queries.push({ subdomain: options.subdomain.toLowerCase().trim() });
  }

  if (options.host) {
    const cleanHost = options.host.split(":")[0].toLowerCase().trim();
    const hostWithoutWww = cleanHost.startsWith("www.")
      ? cleanHost.slice(4)
      : cleanHost;

    // 1. مطابقة مباشرة مع custom_domain في جدول Clients (مثل sss.net أو www.sss.net)
    queries.push({ custom_domain: cleanHost });
    queries.push({ custom_domain: hostWithoutWww });

    // 2. مطابقة مع الروابط المسجلة
    queries.push({
      subdomain_url: new RegExp(`^https?://${cleanHost}(/.*)?$`, "i"),
    });
    queries.push({
      backend_url: new RegExp(`^https?://${cleanHost}(/.*)?$`, "i"),
    });
  }

  if (options.origin) {
    try {
      const url = new URL(options.origin);
      const originHost = url.hostname.toLowerCase();
      const originWithoutWww = originHost.startsWith("www.")
        ? originHost.slice(4)
        : originHost;

      queries.push({ custom_domain: originHost });
      queries.push({ custom_domain: originWithoutWww });
      queries.push({
        subdomain_url: new RegExp(`^https?://${originHost}(/.*)?$`, "i"),
      });
    } catch {}
  }

  if (options.fullUrl) {
    queries.push({ subdomain_url: options.fullUrl.trim() });
  }

  if (queries.length === 0) return null;

  const client = await Client.findOne({ $or: queries }).lean();
  if (!client) return null;

  // استخراج اسم الداتابيز: لو db_name مش محدد نستخدم البادئة الافتراضية
  const dbName = client.db_name || `sc_${client._id.toString()}`;

  return {
    clientId: client._id.toString(),
    subdomain: client.subdomain,
    subdomainUrl: client.subdomain_url || `https://${client.subdomain}.${PARENT_DOMAIN}`,
    backendUrl: client.backend_url || `https://api-${client.subdomain}.${PARENT_DOMAIN}`,
    dbName,
    companyName: client.company_name,
    status: client.status,
    sections: (client.sections || []).map((s: any) => s.toString()),
    start_date: client.start_date,
    end_date: client.end_date,
    payment_cycle: client.payment_cycle,
    payment_amount: client.payment_amount,
    custom_domain: client.custom_domain,
  };
}

// ── Tenant DB Connection Manager ───────────────────────────────────────────

/**
 * يرجع connection لقاعدة بيانات tenant محددة، مع cache لتفادي تكرار الاتصال
 */
export function getTenantConnection(dbName: string): mongoose.Connection {
  const cached = tenantConnectionCache.get(dbName);
  if (cached && cached.readyState === 1) {
    return cached;
  }

  const tenantUri = buildTenantUri(dbName);
  const conn = mongoose.createConnection(tenantUri);

  conn.on("connected", () => {
    console.log(`âœ… Connected to tenant DB: ${dbName}`);
  });

  conn.on("error", (err) => {
    console.error(`â Œ Tenant DB connection error (${dbName}):`, err.message);
    tenantConnectionCache.delete(dbName);
  });

  conn.on("disconnected", () => {
    tenantConnectionCache.delete(dbName);
  });

  tenantConnectionCache.set(dbName, conn);
  return conn;
}

/**
 * يبني connection URI مخصص لقاعدة بيانات العميل
 */
export function buildTenantUri(dbName: string): string {
  const baseUri = TENANT_MONGO_BASE_URI;

  const qIndex = baseUri.indexOf("?");
  const query = qIndex >= 0 ? baseUri.slice(qIndex) : "";
  const withoutQuery = qIndex >= 0 ? baseUri.slice(0, qIndex) : baseUri;

  const schemeEnd = withoutQuery.indexOf("://");
  const authorityStart = schemeEnd >= 0 ? schemeEnd + 3 : 0;
  const slashAfterAuthority = withoutQuery.indexOf("/", authorityStart);
  const authority =
    slashAfterAuthority === -1
      ? withoutQuery
      : withoutQuery.slice(0, slashAfterAuthority);

  return `${authority.replace(/\/+$/, "")}/${dbName}${query}`;
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────

export async function closeAllConnections(): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const [name, conn] of tenantConnectionCache) {
    promises.push(
      conn.close().then(() => console.log(`Closed tenant DB: ${name}`)),
    );
  }
  tenantConnectionCache.clear();

  if (masterConnection) {
    promises.push(
      masterConnection.close().then(() => console.log("Closed master DB")),
    );
    masterConnection = null;
  }

  await Promise.allSettled(promises);
}
