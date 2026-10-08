import { Router } from "express";
import { uploadImage } from "../controllers/upload.controller.js";
import { upload } from "../middlewares/upload.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/image", requireAuth, upload.single("image"), uploadImage);

export default router;
