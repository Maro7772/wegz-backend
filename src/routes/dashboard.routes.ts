import { Router } from "express";
import {
  getAllSections,
  getCounts,
} from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/sections", getAllSections);
router.get("/counts", getCounts);

export default router;
