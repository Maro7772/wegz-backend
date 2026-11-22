import { Router } from "express";
import { getLanding, sendContactMessage } from "../controllers/public.controller.js";

const router = Router();

router.get("/landing", getLanding);
router.post("/contact", sendContactMessage);

export default router;
