import { Router } from "express";
import {
  getServerDnsInfoHandler,
  listCustomDomainsHandler,
  assignCustomDomainHandler,
  removeCustomDomainHandler,
  verifyCustomDomainDnsHandler,
  installCustomDomainSslHandler,
} from "../controllers/customDomain.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

// 1. بيانات السيرفر وسجلات الـ DNS المطلوبة (A, CNAME)
router.get("/server-info", getServerDnsInfoHandler);

// 2. بيانات النطاق المخصص للعميل الحالي
router.get("/", listCustomDomainsHandler);

// 3. ربط دومين مخصص تلقائياً بـ subdomain الفرونت إند الحالي
router.post("/", assignCustomDomainHandler);

// 4. حذف الدومين المخصص
router.delete("/:id", removeCustomDomainHandler);

// 5. فحص انتشار الـ DNS للدومين
router.post("/:id/verify-dns", verifyCustomDomainDnsHandler);

// 6. إصدار شهادة SSL للدومين عبر Plesk
router.post("/:id/ssl", installCustomDomainSslHandler);

export default router;
