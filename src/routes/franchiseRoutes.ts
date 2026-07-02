import { Router } from "express";
import {
  createFranchise,
  getFranchiseProfile,
  updateFranchiseProfile,
  getFranchiseTeam,
  getFranchiseTerritories,
  getFranchisePerformance,
  getFranchiseNetwork,
  getFranchiseWallet,
  createFranchiseWithdrawal,
  getFranchiseApplications,
  handleFranchiseApplicationAction,
  getAllFranchises,
  getFranchiseById,
  getFranchiseLogins,
  getFranchiseDashboardAnalytics,
  getFranchiseCommissions,
  getFranchiseReportsData,
  downloadFranchiseReport,
  getFranchiseCustomers,
  getFranchiseDeliveryPartners,
  getFranchiseTerritoryDetails,
} from "../controllers/franchiseController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/create", protect, createFranchise);
router.get("/profile", protect, getFranchiseProfile);
router.put("/profile", protect, updateFranchiseProfile);
router.get("/team", protect, getFranchiseTeam);
router.get("/territories", protect, getFranchiseTerritories);
router.get("/performance", protect, getFranchisePerformance);
router.get("/network", protect, getFranchiseNetwork);
router.get("/wallet", protect, getFranchiseWallet);
router.post("/withdraw", protect, createFranchiseWithdrawal);
router.get("/applications", protect, getFranchiseApplications);
router.post("/applications/:id/action", protect, handleFranchiseApplicationAction);
router.get("/security/logins", protect, getFranchiseLogins);
router.get("/dashboard/analytics", protect, getFranchiseDashboardAnalytics);
router.get("/commissions", protect, getFranchiseCommissions);
router.get("/reports/data", protect, getFranchiseReportsData);
router.get("/reports/download", downloadFranchiseReport); // direct browser link: token auth is done inside the handler
router.get("/customers", protect, getFranchiseCustomers);
router.get("/delivery-partners", protect, getFranchiseDeliveryPartners);
router.get("/territory/details", protect, getFranchiseTerritoryDetails);

router.get("/", getAllFranchises);
router.get("/:id", getFranchiseById);

export default router;