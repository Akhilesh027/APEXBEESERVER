import { Router } from "express";
import {
  getBanners,
  adminGetBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminDeleteBanner
} from "../controllers/bannerController";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

// Public routes
router.get("/", getBanners);

// Admin routes
router.get("/admin", protect, restrictTo("admin"), adminGetBanners);
router.post("/admin", protect, restrictTo("admin"), adminCreateBanner);
router.put("/admin/:id", protect, restrictTo("admin"), adminUpdateBanner);
router.delete("/admin/:id", protect, restrictTo("admin"), adminDeleteBanner);

export default router;
