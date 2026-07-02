import { Router } from "express";
import {
  createOrder,
  getOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrdersByUserId,
  createOrderWithProof,
  getOrderCountByUserId
} from "../controllers/orderController";
import { uploadAnyDisk } from "../middleware/multer";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

router.get("/", protect, restrictTo('admin', 'vendor', 'wholesaler', 'manufacturer', 'state_franchise', 'district_franchise', 'mandal_franchise'), getOrders);
router.get("/user/:userId", protect, getOrdersByUserId);
router.get("/:userId/count", protect, getOrderCountByUserId);
router.get("/:id", protect, getOrderById);
router.post("/", protect, createOrder);
router.post("/with-proof", protect, uploadAnyDisk.single('paymentProof'), createOrderWithProof);
router.put("/:id", protect, updateOrder);
router.patch("/:id", protect, updateOrder);
router.patch("/:id/status", protect, updateOrder);
router.delete("/:id", protect, restrictTo('admin'), deleteOrder);

export default router;
