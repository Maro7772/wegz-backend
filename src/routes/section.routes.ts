import { Router } from "express";
import {
  createSection,
  getAllSections,
  getSectionById,
  updateSection,
  deleteSection,
} from "../controllers/section.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

router.use(requireAuth);

// upload.any() → بيسمح بأي عدد وأي أسماء حقول ملفات
router.post("/:type", upload.any(), createSection);
router.get("/:type", getAllSections);
router.get("/:type/:id", getSectionById);
router.patch("/:type/:id", upload.any(), updateSection);
router.delete("/:type/:id", deleteSection);

export default router;
