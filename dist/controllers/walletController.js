"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyWallet = exports.getAllWithdrawals = exports.rejectWithdrawal = exports.approveWithdrawal = exports.getWithdrawalsHistory = exports.createWithdrawalRequest = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Wallet_1 = require("../models/Wallet");
const WalletEngine_1 = require("../services/WalletEngine");
const Franchise_1 = require("../models/Franchise");
// POST /api/wallet/withdrawals
const createWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { amount, note, feePercent } = req.body;
        const reqAmount = Number(amount);
        if (isNaN(reqAmount) || reqAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid withdrawal amount" });
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
        if (reqAmount > wallet.availableBalance) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        }
        // Deduct from available, add to pending (hold) via WalletEngine
        const updatedWallet = await WalletEngine_1.WalletEngine.debit(userId, reqAmount, {
            category: "Withdrawal",
            source: "withdrawal",
            remarks: note || "",
            description: "Withdrawal request pending approval",
            status: "pending",
            referenceType: "WITHDRAWAL"
        });
        const lastEntry = updatedWallet.ledgerEntries[updatedWallet.ledgerEntries.length - 1];
        const fee = feePercent ? Math.round((reqAmount * feePercent) / 100) : 0;
        const net = reqAmount - fee;
        res.status(201).json({
            success: true,
            message: "Withdrawal requested successfully",
            withdrawal: {
                _id: lastEntry._id || lastEntry.referenceId || `with-${Date.now()}`,
                amount: reqAmount,
                status: "pending",
                note: note || "",
                createdAt: lastEntry.createdAt || new Date(),
                feePercent: feePercent || 0,
                feeAmount: fee,
                netAmount: net
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createWithdrawalRequest = createWithdrawalRequest;
// GET /api/wallet/withdrawals
const getWithdrawalsHistory = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
        // Filter and map ledger entries representing withdrawals
        const withdrawals = wallet.ledgerEntries
            .filter((entry) => entry.source === "withdrawal")
            .map((entry) => {
            const feePercent = 15; // 15% TDS + Platform Fee
            const fee = Math.round((entry.amount * feePercent) / 100);
            const net = entry.amount - fee;
            return {
                _id: entry._id || entry.referenceId || `with-${entry.createdAt ? entry.createdAt.getTime() : Date.now()}`,
                amount: entry.amount,
                status: entry.status || "pending",
                note: entry.remarks || entry.description || "",
                createdAt: entry.createdAt ? entry.createdAt.toISOString() : new Date().toISOString(),
                feePercent,
                feeAmount: fee,
                netAmount: net
            };
        })
            .reverse(); // Newest first
        res.json({
            success: true,
            withdrawals,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getWithdrawalsHistory = getWithdrawalsHistory;
// PATCH /api/wallet/withdrawals/:id/approve
const approveWithdrawal = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        const { id } = req.params;
        const wallet = await Wallet_1.Wallet.findOne({ "ledgerEntries._id": id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Withdrawal request not found" });
        }
        let updatedWallet = null;
        await session.withTransaction(async () => {
            updatedWallet = await WalletEngine_1.WalletEngine.approveWithdrawal(wallet.userId, id, session);
        });
        return res.status(200).json({ success: true, message: "Withdrawal approved successfully", wallet: updatedWallet });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
    finally {
        await session.endSession();
    }
};
exports.approveWithdrawal = approveWithdrawal;
// PATCH /api/wallet/withdrawals/:id/reject
const rejectWithdrawal = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        const { id } = req.params;
        const wallet = await Wallet_1.Wallet.findOne({ "ledgerEntries._id": id });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Withdrawal request not found" });
        }
        let updatedWallet = null;
        await session.withTransaction(async () => {
            updatedWallet = await WalletEngine_1.WalletEngine.rejectWithdrawal(wallet.userId, id, session);
        });
        return res.status(200).json({ success: true, message: "Withdrawal rejected successfully", wallet: updatedWallet });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
    finally {
        await session.endSession();
    }
};
exports.rejectWithdrawal = rejectWithdrawal;
// GET /api/wallet/admin/withdrawals
const getAllWithdrawals = async (req, res) => {
    try {
        const wallets = await Wallet_1.Wallet.find();
        const withdrawals = [];
        for (const w of wallets) {
            const rawUserId = w.userId;
            if (!rawUserId)
                continue;
            let ownerName = "";
            let roles = [];
            let ownerId = rawUserId;
            const user = await mongoose_1.default.model("User").findById(rawUserId);
            if (!user) {
                // Since user is not found in User collection, check if rawUserId refers to a Franchise ID
                const franchise = await Franchise_1.Franchise.findById(rawUserId);
                if (franchise) {
                    ownerName = franchise.ownerName;
                    roles = [franchise.franchiseLevel + "_franchise"];
                    ownerId = franchise.userId; // actual user id
                }
                else {
                    continue; // Not a franchise wallet, skip
                }
            }
            else {
                ownerName = user.name;
                roles = user.roles;
                ownerId = user._id;
            }
            w.ledgerEntries.forEach((entry) => {
                if (entry.source === "withdrawal") {
                    const feePercent = 15;
                    const fee = Math.round((entry.amount * feePercent) / 100);
                    const net = entry.amount - fee;
                    withdrawals.push({
                        id: entry._id ? String(entry._id) : entry.referenceId ? String(entry.referenceId) : `with-${entry.createdAt ? entry.createdAt.getTime() : Date.now()}`,
                        ownerId: ownerId,
                        ownerName: ownerName,
                        type: roles.includes("vendor") ? "Vendor" : roles.includes("service_provider") ? "Service Provider" : roles.some((r) => r.includes("franchise")) ? "Franchise" : "Referral",
                        amount: entry.amount,
                        status: entry.status === "completed" ? "Approved" : entry.status === "rejected" ? "Rejected" : "Pending",
                        date: entry.createdAt ? entry.createdAt.toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
                        method: entry.remarks?.includes("Bank") ? "Bank Transfer" : "UPI",
                        details: entry.remarks || entry.description || "",
                        feePercent,
                        feeAmount: fee,
                        netAmount: net
                    });
                }
            });
        }
        // Sort newest first
        withdrawals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return res.json({ success: true, withdrawals });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllWithdrawals = getAllWithdrawals;
// GET /api/wallet/my-wallet
const getMyWallet = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
        res.status(200).json({ success: true, wallet });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyWallet = getMyWallet;
