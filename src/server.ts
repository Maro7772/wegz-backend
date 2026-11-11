import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import { getMasterConnection } from "./config/tenant.js";
import { connectDB } from "./config/db.js";
import { tenantMiddleware } from "./middlewares/tenant.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import sectionRoutes from "./routes/section.routes.js";
import publicRoutes from "./routes/public.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import themeRoutes from "./routes/theme.routes.js";

const app = express();

// إعداد CORS ليدعم جميع الـ wildcard subdomains والـ localhost
app.use(
  cors({
    origin: (origin, callback) => {
      // السماح بطلبات الـ API المباشرة أو من server-to-server / curl
      if (!origin) return callback(null, true);

      // السماح بأي subdomain لنطاق wegz.org أو localhost
      if (
        /^https?:\/\/([a-z0-9-]+\.)?wegz\.org(:\d+)?$/i.test(origin) ||
        /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)
      ) {
        return callback(null, true);
      }

      // دعم النطاقات المخصصة (Custom Domains) للعملاء
      return callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة ملفات الرفع ثابتة
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// فحص الصحة يعمل دون اشتراط subdomain لمراقبة السيرفر
app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// تطبيق الـ Tenant Middleware للتحقق من الـ subdomain واختيار قاعدة البيانات
app.use(tenantMiddleware);

// المسارات الحالية تعمل 100% دون أي تغيير في الـ request أو الـ response
app.use("/api/auth", authRoutes);
app.use("/api/admin/themes", themeRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/sections", sectionRoutes);
app.use("/api/admin/upload", uploadRoutes);
app.use("/api/public", publicRoutes);

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    // 1. الاتصال بقاعدة البيانات الرئيسية (SuperWegz) للتحقق من العملاء
    await getMasterConnection();

    // 2. الاتصال الافتراضي كـ fallback إذا كان متوفراً
    if (process.env.MONGO_URI) {
      await connectDB().catch((err) =>
        console.warn("Notice: Default fallback DB not connected, running in full dynamic tenant mode:", err.message),
      );
    }

    app.listen(PORT, () => {
      console.log(`🚀 Wildcard Multi-Tenant API listening on port ${PORT}`);
      console.log(`   Architecture: Wildcard subdomain routing + database-per-tenant isolation`);
    });
  } catch (err: any) {
    console.error("❌ Fatal startup error:", err.message);
    process.exit(1);
  }
};

start();
