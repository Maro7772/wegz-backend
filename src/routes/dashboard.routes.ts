import { Router } from "express";
import { getAllSections } from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(requireAuth);

router.get("/sections", getAllSections);

export default router;
