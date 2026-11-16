import { Router } from "express";
import {
  getTenantOrderLists,
  makeOrder,
  historyOrders,
} from "../controllers/order.controller.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = Router();

// lists => payment_methods & packages where status active
router.get("/lists", getTenantOrderLists);

// make_order => uploads receipt as file, client_id from super_admin
router.post("/make-order", upload.single("receipt"), makeOrder);

// history_orders => orders of this client as pagination filter by status
router.get("/history-orders", historyOrders);

export default router;
