"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const walletController_1 = require("../controllers/walletController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get("/my-wallet", auth_1.protect, walletController_1.getMyWallet);
router.post("/add-funds", auth_1.protect, walletController_1.addFunds);
router.post("/withdrawals", auth_1.protect, walletController_1.createWithdrawalRequest);
router.get("/withdrawals", auth_1.protect, walletController_1.getWithdrawalsHistory);
router.post("/withdraw/request", auth_1.protect, walletController_1.requestWithdrawalOtp);
router.post("/withdraw/verify", auth_1.protect, walletController_1.verifyWithdrawalOtp);
// Admin endpoints
router.get("/admin/withdrawals", auth_1.protect, (0, auth_1.restrictTo)("admin"), walletController_1.getAllWithdrawals);
router.patch("/withdrawals/:id/approve", auth_1.protect, (0, auth_1.restrictTo)("admin"), walletController_1.approveWithdrawal);
router.patch("/withdrawals/:id/reject", auth_1.protect, (0, auth_1.restrictTo)("admin"), walletController_1.rejectWithdrawal);
exports.default = router;
