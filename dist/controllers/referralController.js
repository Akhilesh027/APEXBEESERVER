"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReferralEarningsSummary = exports.getReferralStats = exports.processReferralReleases = exports.updateReferralSettings = exports.getReferralSettings = exports.getReferralNetwork = exports.getReferralHistory = exports.getReferralDashboard = exports.getMyReferralInfo = void 0;
const User_1 = require("../models/User");
const ReferralTransaction_1 = require("../models/ReferralTransaction");
const ReferralSettings_1 = require("../models/ReferralSettings");
const Wallet_1 = require("../models/Wallet");
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const SettlementEngine_1 = require("../services/SettlementEngine");
const Referral_1 = require("../models/Referral");
const Order_1 = require("../models/Order");
// GET /api/referrals/me
const getMyReferralInfo = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await User_1.User.findById(userId).populate("referredBy", "referralCode");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        let referralCode = user.referralCode || "";
        if (!referralCode) {
            const cleanName = user.name.replace(/[^a-zA-Z]/g, "").toUpperCase();
            const prefix = (cleanName.substring(0, 3) + "XXX").substring(0, 3);
            let isUnique = false;
            while (!isUnique) {
                const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
                referralCode = `APX-${prefix}${randomChars}`;
                const existing = await User_1.User.findOne({ referralCode });
                if (!existing) {
                    isUnique = true;
                }
            }
            user.referralCode = referralCode;
            await user.save();
        }
        const referredBy = user.referredBy?.referralCode || "APEXBEE";
        const level1Count = await User_1.User.countDocuments({ "referralHierarchy.level1UserId": user._id });
        const level2Count = await User_1.User.countDocuments({ "referralHierarchy.level2UserId": user._id });
        const level3Count = await User_1.User.countDocuments({ "referralHierarchy.level3UserId": user._id });
        return res.status(200).json({
            success: true,
            referralCode,
            referredBy,
            level1Count,
            level2Count,
            level3Count
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMyReferralInfo = getMyReferralInfo;
// GET /api/referrals/dashboard
const getReferralDashboard = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const directReferrals = await User_1.User.countDocuments({ "referralHierarchy.level1UserId": user._id });
        const level2Count = await User_1.User.countDocuments({ "referralHierarchy.level2UserId": user._id });
        const level3Count = await User_1.User.countDocuments({ "referralHierarchy.level3UserId": user._id });
        const indirectReferrals = level2Count + level3Count;
        let wallet = await Wallet_1.Wallet.findOne({ userId: user._id });
        if (!wallet) {
            wallet = new Wallet_1.Wallet({
                userId: user._id,
                availableBalance: 0,
                pendingBalance: 0,
                withdrawnBalance: 0,
                totalCredits: 0,
                totalDebits: 0,
                ledgerEntries: []
            });
            await wallet.save();
        }
        const pendingRewards = wallet.pendingBalance;
        const releasedRewards = wallet.availableBalance;
        return res.status(200).json({
            success: true,
            referralCode: user.referralCode || "",
            directReferrals,
            indirectReferrals,
            pendingRewards,
            releasedRewards,
            walletTotal: wallet.availableBalance + wallet.pendingBalance,
            walletHold: wallet.pendingBalance,
            walletAvailable: wallet.availableBalance
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralDashboard = getReferralDashboard;
// GET /api/referrals/history
const getReferralHistory = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const txs = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: userId })
            .populate("referredUserId", "name")
            .sort({ createdAt: -1 });
        const history = txs.map(tx => ({
            user: tx.referredUserId?.name || "Unknown",
            level: tx.level,
            reward: tx.amount,
            status: tx.status
        }));
        return res.status(200).json({
            success: true,
            history
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralHistory = getReferralHistory;
const enrichReferredUsers = async (users, referrerUserId) => {
    const enriched = [];
    for (const user of users) {
        const userId = user._id;
        // Count purchases (orders)
        const orders = await Order_1.Order.find({ customerId: userId }).sort({ createdAt: -1 });
        const totalPurchases = orders.length;
        // Sum commission generated for the referrer
        const txs = await ReferralTransaction_1.ReferralTransaction.find({ referredUserId: userId, recipientUserId: referrerUserId });
        // Get Referral record for signup bonus contribution if any
        const referral = await Referral_1.Referral.findOne({ referredUserId: userId, referrerUserId });
        const referralId = referral ? referral._id : null;
        const initialSignupBonus = (referral && referral.status === "rewarded") ? (referral.rewardAmount || 0) : 0;
        const firstOrderBonusAmt = txs
            .filter(tx => tx.transactionType === "first_order_bonus")
            .reduce((sum, tx) => sum + tx.amount, 0);
        const signupBonus = initialSignupBonus + firstOrderBonusAmt;
        const firstPurchaseCommission = txs
            .filter(tx => tx.transactionType === "first_purchase_product_commission")
            .reduce((sum, tx) => sum + tx.amount, 0);
        const productCommission = txs
            .filter(tx => tx.transactionType === "product_commission")
            .reduce((sum, tx) => sum + tx.amount, 0);
        const totalEarned = signupBonus + firstPurchaseCommission + productCommission;
        // Get wallet contributions (ledger entries in referrer's wallet associated with this referral's orderIds or referralId)
        const wallet = await Wallet_1.Wallet.findOne({ userId: referrerUserId });
        const orderIds = orders.map(o => o._id.toString());
        const walletContributions = wallet
            ? wallet.ledgerEntries.filter(entry => (entry.referenceId && orderIds.includes(entry.referenceId.toString())) ||
                (referralId && entry.referenceId && entry.referenceId.toString() === referralId.toString())).map(entry => ({
                transactionId: entry.transactionId,
                referenceId: entry.referenceId,
                amount: entry.amount,
                date: entry.date || entry.createdAt
            }))
            : [];
        enriched.push({
            _id: user._id,
            name: user.name,
            email: user.email,
            referredBy: user.referredBy,
            phone: user.phone || user.mobile || "",
            referralCode: user.referralCode || "",
            createdAt: user.createdAt,
            status: user.status,
            firstOrderQualified: user.firstOrderQualified || false,
            totalPurchases,
            totalCommissionGenerated: totalEarned,
            signupBonus,
            firstPurchaseCommission,
            productCommission,
            totalEarned,
            orders: orders.map(o => ({
                orderNumber: o.orderNumber,
                totalAmount: o.totalAmount,
                createdAt: o.createdAt,
                status: o.orderStatus
            })),
            commissions: txs.map(tx => ({
                commissionType: tx.transactionType === "first_order_bonus"
                    ? "Signup Bonus"
                    : tx.transactionType === "first_purchase_product_commission"
                        ? "First Purchase"
                        : "Product Commission",
                amount: tx.amount,
                level: tx.level,
                date: tx.createdAt
            })),
            walletContributions
        });
    }
    return enriched;
};
// GET /api/referrals/network
const getReferralNetwork = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const level1Raw = await User_1.User.find({ "referralHierarchy.level1UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");
        const level2Raw = await User_1.User.find({ "referralHierarchy.level2UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");
        const level3Raw = await User_1.User.find({ "referralHierarchy.level3UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");
        const level1 = await enrichReferredUsers(level1Raw, userId);
        const level2 = await enrichReferredUsers(level2Raw, userId);
        const level3 = await enrichReferredUsers(level3Raw, userId);
        return res.status(200).json({
            success: true,
            level1,
            level2,
            level3
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralNetwork = getReferralNetwork;
// GET /api/admin/referrals/settings
const getReferralSettings = async (req, res) => {
    try {
        let settings = await ReferralSettings_1.ReferralSettings.findOne({});
        if (!settings) {
            settings = new ReferralSettings_1.ReferralSettings();
            await settings.save();
        }
        return res.status(200).json({ success: true, settings });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralSettings = getReferralSettings;
// PUT /api/admin/referrals/settings
const updateReferralSettings = async (req, res) => {
    try {
        let settings = await ReferralSettings_1.ReferralSettings.findOne({});
        if (!settings) {
            settings = new ReferralSettings_1.ReferralSettings(req.body);
        }
        else {
            Object.assign(settings, req.body);
        }
        await settings.save();
        return res.status(200).json({ success: true, settings });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateReferralSettings = updateReferralSettings;
// POST /api/admin/referrals/process-releases
const processReferralReleases = async (req, res) => {
    try {
        const { orderId } = req.body;
        const adminId = req.user?.id || req.user?._id;
        const stats = await SettlementEngine_1.SettlementEngine.releaseEligibleSettlements(undefined, orderId, adminId);
        if (stats.releasedTxs + stats.releasedSettlements === 0) {
            return res.status(400).json({
                success: false,
                message: "No pending commissions found for this order."
            });
        }
        return res.status(200).json({
            success: true,
            message: `Successfully processed ${stats.releasedTxs} referral rewards and ${stats.releasedSettlements} franchise settlements.`,
            processedCount: stats.releasedTxs,
            processedSettlementsCount: stats.releasedSettlements
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.processReferralReleases = processReferralReleases;
// GET /api/referrals/stats
const getReferralStats = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const user = await User_1.User.findById(userId).populate("referredBy", "name referralCode");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const level1Count = await User_1.User.countDocuments({ "referralHierarchy.level1UserId": user._id });
        const level2Count = await User_1.User.countDocuments({ "referralHierarchy.level2UserId": user._id });
        const level3Count = await User_1.User.countDocuments({ "referralHierarchy.level3UserId": user._id });
        const completedDirectReferrals = await User_1.User.countDocuments({ "referralHierarchy.level1UserId": user._id, firstOrderQualified: true });
        const completedIndirectReferrals = await User_1.User.countDocuments({ "referralHierarchy.level2UserId": user._id, firstOrderQualified: true });
        const completedLevel3Referrals = await User_1.User.countDocuments({ "referralHierarchy.level3UserId": user._id, firstOrderQualified: true });
        // A. Signup Bonus: KYC referral rewards (Referrals with status "rewarded")
        const rewardedRefs = await Referral_1.Referral.find({ referrerUserId: user._id, status: "rewarded" });
        const signupBonus = rewardedRefs.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
        // B. First Purchase Commission & C. Product Commission from ReferralTransaction
        const txs = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: user._id });
        let signupBonusSum = signupBonus; // Start with KYC rewarded referrals
        let firstPurchaseCommission = 0;
        let productCommission = 0;
        let l1_signupBonus = signupBonus; // All rewarded referrals are level 1 directs
        let l1_firstPurchaseCommission = 0;
        let l1_productCommission = 0;
        let l2_signupBonus = 0;
        let l2_firstPurchaseCommission = 0;
        let l2_productCommission = 0;
        let l3_signupBonus = 0;
        let l3_firstPurchaseCommission = 0;
        let l3_productCommission = 0;
        txs.forEach(tx => {
            const amt = tx.amount || 0;
            if (tx.transactionType === "first_order_bonus") {
                signupBonusSum += amt;
                if (tx.level === 1)
                    l1_signupBonus += amt;
                else if (tx.level === 2)
                    l2_signupBonus += amt;
                else if (tx.level === 3)
                    l3_signupBonus += amt;
            }
            else if (tx.transactionType === "first_purchase_product_commission") {
                firstPurchaseCommission += amt;
                if (tx.level === 1)
                    l1_firstPurchaseCommission += amt;
                else if (tx.level === 2)
                    l2_firstPurchaseCommission += amt;
                else if (tx.level === 3)
                    l3_firstPurchaseCommission += amt;
            }
            else if (tx.transactionType === "product_commission") {
                productCommission += amt;
                if (tx.level === 1)
                    l1_productCommission += amt;
                else if (tx.level === 2)
                    l2_productCommission += amt;
                else if (tx.level === 3)
                    l3_productCommission += amt;
            }
        });
        const finalSignupBonus = signupBonusSum;
        // D. Membership, E. Vendor, F. Franchise, G. Recurring from CommissionSettlement
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ recipientId: user._id });
        let membershipIncentives = 0;
        let vendorIncentives = 0;
        let franchiseIncentives = 0;
        let recurringCommissions = 0;
        settlements.forEach(s => {
            const amt = s.amount || 0;
            if (s.settlementType === "entrepreneur") {
                membershipIncentives += amt;
            }
            else if (s.settlementType === "vendor") {
                vendorIncentives += amt;
            }
            else if (s.settlementType === "franchise") {
                franchiseIncentives += amt;
            }
            else if (s.settlementType === "wishlink" || s.settlementType === "referralPool") {
                recurringCommissions += amt;
            }
        });
        // Wallet Summary
        const wallet = await Wallet_1.Wallet.findOne({ userId: user._id });
        const availableBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        const withdrawnBalance = wallet ? wallet.withdrawnBalance : 0;
        const walletTotal = availableBalance + pendingBalance + withdrawnBalance;
        const totalEarned = finalSignupBonus +
            firstPurchaseCommission +
            productCommission +
            membershipIncentives +
            vendorIncentives +
            franchiseIncentives +
            recurringCommissions;
        return res.status(200).json({
            success: true,
            stats: {
                totalReferrals: level1Count + level2Count + level3Count,
                completedReferrals: completedDirectReferrals + completedIndirectReferrals + completedLevel3Referrals,
                pendingReferrals: (level1Count + level2Count + level3Count) - (completedDirectReferrals + completedIndirectReferrals + completedLevel3Referrals),
                totalDirectReferrals: level1Count,
                totalIndirectReferrals: level2Count,
                totalLevel3Referrals: level3Count,
                completedDirectReferrals,
                completedIndirectReferrals,
                completedLevel3Referrals,
                pendingDirectReferrals: level1Count - completedDirectReferrals,
                pendingIndirectReferrals: level2Count - completedIndirectReferrals,
                pendingLevel3Referrals: level3Count - completedLevel3Referrals,
                // User profile and parent info
                userLevel: 1,
                hasParent: !!user.referredBy,
                parentInfo: user.referredBy ? {
                    name: user.referredBy.name || "ApexBee System",
                    referralCode: user.referredBy.referralCode || "APEXBEE"
                } : undefined,
                // Seven Categories
                signupBonus: finalSignupBonus,
                firstPurchaseCommission,
                productCommission,
                membershipIncentives,
                vendorIncentives,
                franchiseIncentives,
                recurringCommissions,
                totalEarned,
                // Wallet Balance splits
                availableBalance,
                pendingBalance,
                withdrawnBalance,
                walletTotal,
                walletHold: pendingBalance,
                walletAvailable: availableBalance,
                // Level-based earnings breakdowns
                level1: {
                    signupBonus: l1_signupBonus,
                    firstPurchaseCommission: l1_firstPurchaseCommission,
                    productCommission: l1_productCommission,
                    totalEarned: l1_signupBonus + l1_firstPurchaseCommission + l1_productCommission
                },
                level2: {
                    signupBonus: l2_signupBonus,
                    firstPurchaseCommission: l2_firstPurchaseCommission,
                    productCommission: l2_productCommission,
                    totalEarned: l2_signupBonus + l2_firstPurchaseCommission + l2_productCommission
                },
                level3: {
                    signupBonus: l3_signupBonus,
                    firstPurchaseCommission: l3_firstPurchaseCommission,
                    productCommission: l3_productCommission,
                    totalEarned: l3_signupBonus + l3_firstPurchaseCommission + l3_productCommission
                }
            }
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralStats = getReferralStats;
// GET /api/referrals/earnings-summary
const getReferralEarningsSummary = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const txs = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: userId });
        let direct = 0;
        let indirect = 0;
        let level3 = 0;
        let signup = 0;
        let purchase = 0;
        txs.forEach(tx => {
            if (tx.level === 1)
                direct += tx.amount;
            else if (tx.level === 2)
                indirect += tx.amount;
            else if (tx.level === 3)
                level3 += tx.amount;
            if (tx.transactionType === "first_order_bonus")
                signup += tx.amount;
            else if (tx.transactionType === "first_purchase_product_commission" || tx.transactionType === "product_commission")
                purchase += tx.amount;
        });
        const topReferrals = [];
        const directDownlines = await User_1.User.find({ "referralHierarchy.level1UserId": userId }, "name email");
        for (const dl of directDownlines) {
            const subTxs = await ReferralTransaction_1.ReferralTransaction.find({ recipientUserId: userId, referredUserId: dl._id });
            const totalEarned = subTxs.reduce((sum, tx) => sum + tx.amount, 0);
            const referralCount = await User_1.User.countDocuments({ "referralHierarchy.level1UserId": dl._id });
            topReferrals.push({
                user: { name: dl.name, email: dl.email },
                totalEarned,
                referralCount
            });
        }
        topReferrals.sort((a, b) => b.totalEarned - a.totalEarned);
        return res.status(200).json({
            success: true,
            summary: {
                timeframe: "alltime",
                totals: {
                    direct,
                    indirect,
                    level3,
                    signup,
                    purchase,
                    total: direct + indirect + level3
                },
                breakdown: {
                    byLevel: { level1: direct, level2: indirect, level3 },
                    byType: { signup, purchase }
                }
            },
            topReferrals: topReferrals.slice(0, 5)
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getReferralEarningsSummary = getReferralEarningsSummary;
