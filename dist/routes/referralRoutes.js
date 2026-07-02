"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const referralController_1 = require("../controllers/referralController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// User Referral Endpoints
router.get("/me", auth_1.protect, referralController_1.getMyReferralInfo);
router.get("/dashboard", auth_1.protect, referralController_1.getReferralDashboard);
router.get("/history", auth_1.protect, referralController_1.getReferralHistory);
router.get("/network", auth_1.protect, referralController_1.getReferralNetwork);
router.get("/stats", auth_1.protect, referralController_1.getReferralStats);
router.get("/earnings-summary", auth_1.protect, referralController_1.getReferralEarningsSummary);
// Admin Configuration Endpoints
router.get("/admin/settings", auth_1.protect, referralController_1.getReferralSettings);
router.put("/admin/settings", auth_1.protect, referralController_1.updateReferralSettings);
router.post("/admin/process-releases", auth_1.protect, referralController_1.processReferralReleases);
exports.default = router;
