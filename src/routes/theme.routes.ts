import { Router } from "express";
import {
  getAllThemes,
  getThemeById,
  activateTheme,
  changeMode,
  forbiddenInTenantAdmin,
} from "../controllers/theme.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

// قراءة الثيمات واختيارها
router.get("/", getAllThemes);
router.get("/:id", getThemeById);
router.patch("/:id/activate", activateTheme);
router.patch("/:id/mode", changeMode);

// الإنشاء والحذف والتعديل المركزي محظور على مستوى الـ Tenant (متاح فقط في Super Admin)
router.post("/", forbiddenInTenantAdmin);
router.patch("/:id", forbiddenInTenantAdmin);
router.delete("/:id", forbiddenInTenantAdmin);

export default router;
