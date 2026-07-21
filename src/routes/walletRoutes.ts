import { Router } from "express";
import {
   createWithdrawalRequest,
   getWithdrawalsHistory,
   approveWithdrawal,
   rejectWithdrawal,
   getAllWithdrawals,
   getMyWallet,
   addFunds,
   requestWithdrawalOtp,
   verifyWithdrawalOtp
} from "../controllers/walletController";
import { protect, restrictTo } from "../middleware/auth";

const router = Router();

router.get("/my-wallet", protect, getMyWallet);
router.post("/add-funds", protect, addFunds);
router.post("/withdrawals", protect, createWithdrawalRequest);
router.get("/withdrawals", protect, getWithdrawalsHistory);
router.post("/withdraw/request", protect, requestWithdrawalOtp);
router.post("/withdraw/verify", protect, verifyWithdrawalOtp);

// Admin endpoints
router.get("/admin/withdrawals", protect, restrictTo("admin"), getAllWithdrawals);
router.patch("/withdrawals/:id/approve", protect, restrictTo("admin"), approveWithdrawal);
router.patch("/withdrawals/:id/reject", protect, restrictTo("admin"), rejectWithdrawal);

export default router;
