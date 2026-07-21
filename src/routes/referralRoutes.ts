import { Router } from "express";
import {
  getMyReferralInfo,
  getReferralDashboard,
  getReferralHistory,
  getReferralNetwork,
  getReferralSettings,
  updateReferralSettings,
  processReferralReleases,
  getReferralStats,
  getReferralEarningsSummary,
  getReferralLeaderboard
} from "../controllers/referralController";
import { protect } from "../middleware/auth";

const router = Router();

// User Referral Endpoints
router.get("/me", protect, getMyReferralInfo);
router.get("/dashboard", protect, getReferralDashboard);
router.get("/history", protect, getReferralHistory);
router.get("/network", protect, getReferralNetwork);
router.get("/stats", protect, getReferralStats);
router.get("/earnings-summary", protect, getReferralEarningsSummary);
router.get("/leaderboard", protect, getReferralLeaderboard);


// Admin Configuration Endpoints
router.get("/admin/settings", protect, getReferralSettings);
router.put("/admin/settings", protect, updateReferralSettings);
router.post("/admin/process-releases", protect, processReferralReleases);

export default router;
