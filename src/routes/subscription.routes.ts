import { Router } from "express";
import { getSubscriptionStatus } from "../controllers/subscription.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// فحص الاشتراك للمديرين (محمي بالتوكن)
router.get("/", requireAuth, getSubscriptionStatus);

// فحص الاشتراك للواجهة الأمامية (لتنبيهات انتهاء الاشتراك وعرض البانر)
router.get("/check", getSubscriptionStatus);

export default router;
