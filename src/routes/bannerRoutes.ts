import { Router } from "express";
import {
  getBanners,
  trackBannerClick,
  trackBannerImpression,
  adminGetBanners,
  adminCreateBanner,
  adminUpdateBanner,
  adminToggleBannerStatus,
  adminBulkReorderBanners,
  adminDeleteBanner,
  adminUploadBannerImage
} from "../controllers/bannerController";
import { protect, restrictTo } from "../middleware/auth";
import { uploadDisk } from "../middleware/multer";

const router = Router();

// Public routes
router.get("/", getBanners);
router.post("/:id/click", trackBannerClick);
router.post("/:id/impression", trackBannerImpression);

// Admin routes
router.get("/admin", protect, restrictTo("admin"), adminGetBanners);
router.post("/admin", protect, restrictTo("admin"), adminCreateBanner);
router.post("/admin/upload", protect, restrictTo("admin"), uploadDisk.single("file"), adminUploadBannerImage);
router.put("/admin/:id", protect, restrictTo("admin"), adminUpdateBanner);
router.patch("/admin/:id/toggle", protect, restrictTo("admin"), adminToggleBannerStatus);
router.patch("/admin/reorder", protect, restrictTo("admin"), adminBulkReorderBanners);
router.delete("/admin/:id", protect, restrictTo("admin"), adminDeleteBanner);

export default router;
