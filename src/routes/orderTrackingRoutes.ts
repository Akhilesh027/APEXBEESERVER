import { Router } from "express";
import {
  getOrderTracking,
  adminGetOrderTrackings,
  adminUpdateOrderTracking
} from "../controllers/orderTrackingController";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

// Customer tracking routes
router.get("/:orderId", protect, getOrderTracking);

// Admin status and coordinates updater
router.get("/admin/all", protect, restrictTo("admin"), adminGetOrderTrackings);
router.put("/admin/:orderId", protect, restrictTo("admin"), adminUpdateOrderTracking);

export default router;
