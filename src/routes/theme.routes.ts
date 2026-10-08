import { Router } from "express";
import {
  getAllThemes,
  getThemeById,
  createTheme,
  updateTheme,
  activateTheme,
  deleteTheme,
} from "../controllers/theme.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getAllThemes);
router.get("/:id", getThemeById);
router.post("/", createTheme);
router.patch("/:id", updateTheme);
router.patch("/:id/activate", activateTheme);
router.delete("/:id", deleteTheme);

export default router;
