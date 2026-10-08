import { Router } from "express";
import { getLanding } from "../controllers/public.controller.js";

const router = Router();

router.get("/landing", getLanding);

export default router;
