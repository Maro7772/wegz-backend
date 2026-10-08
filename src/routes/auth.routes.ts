import { Router } from "express";
import {
  login,
  me,
  updateMe,
  changePassword,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/login", login);

router.get("/me", requireAuth, me);
router.patch("/me", requireAuth, updateMe);
router.patch("/change-password", requireAuth, changePassword);

export default router;
