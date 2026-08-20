"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bannerController_1 = require("../controllers/bannerController");
const auth_1 = require("../middleware/auth");
const multer_1 = require("../middleware/multer");
const router = (0, express_1.Router)();
// Public routes
router.get("/", bannerController_1.getBanners);
router.post("/:id/click", bannerController_1.trackBannerClick);
router.post("/:id/impression", bannerController_1.trackBannerImpression);
// Admin routes
router.get("/admin", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminGetBanners);
router.post("/admin", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminCreateBanner);
router.post("/admin/upload", auth_1.protect, (0, auth_1.restrictTo)("admin"), multer_1.uploadDisk.single("file"), bannerController_1.adminUploadBannerImage);
router.put("/admin/:id", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminUpdateBanner);
router.patch("/admin/:id/toggle", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminToggleBannerStatus);
router.patch("/admin/reorder", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminBulkReorderBanners);
router.delete("/admin/:id", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminDeleteBanner);
exports.default = router;
