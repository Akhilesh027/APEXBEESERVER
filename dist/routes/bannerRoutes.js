"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bannerController_1 = require("../controllers/bannerController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public routes
router.get("/", bannerController_1.getBanners);
// Admin routes
router.get("/admin", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminGetBanners);
router.post("/admin", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminCreateBanner);
router.put("/admin/:id", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminUpdateBanner);
router.delete("/admin/:id", auth_1.protect, (0, auth_1.restrictTo)("admin"), bannerController_1.adminDeleteBanner);
exports.default = router;
