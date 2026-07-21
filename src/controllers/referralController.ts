import { Request, Response } from "express";
import { User } from "../models/User";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { ReferralSettings } from "../models/ReferralSettings";
import { Wallet } from "../models/Wallet";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { SettlementEngine } from "../services/SettlementEngine";
import { Referral } from "../models/Referral";
import { Order } from "../models/Order";

// GET /api/referrals/me
export const getMyReferralInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId).populate("referredBy", "referralCode");
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
        const existing = await User.findOne({ referralCode });
        if (!existing) {
          isUnique = true;
        }
      }
      user.referralCode = referralCode;
      await user.save();
    }
    const referredBy = (user.referredBy as any)?.referralCode || "APEXBEE";

    const level1Count = await User.countDocuments({ "referralHierarchy.level1UserId": user._id });
    const level2Count = await User.countDocuments({ "referralHierarchy.level2UserId": user._id });
    const level3Count = await User.countDocuments({ "referralHierarchy.level3UserId": user._id });

    return res.status(200).json({
      success: true,
      referralCode,
      referredBy,
      level1Count,
      level2Count,
      level3Count
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/dashboard
export const getReferralDashboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const directReferrals = await User.countDocuments({ "referralHierarchy.level1UserId": user._id });
    const level2Count = await User.countDocuments({ "referralHierarchy.level2UserId": user._id });
    const level3Count = await User.countDocuments({ "referralHierarchy.level3UserId": user._id });
    const indirectReferrals = level2Count + level3Count;

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = new Wallet({
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/history
export const getReferralHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const txs = await ReferralTransaction.find({ recipientUserId: userId })
      .populate("referredUserId", "name")
      .sort({ createdAt: -1 });

    const history = txs.map(tx => ({
      user: (tx.referredUserId as any)?.name || "Unknown",
      level: tx.level,
      reward: tx.amount,
      status: tx.status
    }));

    return res.status(200).json({
      success: true,
      history
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const enrichReferredUsers = async (users: any[], referrerUserId: any) => {
  const enriched = [];
  for (const user of users) {
    const userId = user._id;

    // Count purchases (orders)
    const orders = await Order.find({ customerId: userId }).sort({ createdAt: -1 });
    const totalPurchases = orders.length;

    // Sum commission generated for the referrer
    const txs = await ReferralTransaction.find({ referredUserId: userId, recipientUserId: referrerUserId });
    
    // Get Referral record for signup bonus contribution if any
    const referral = await Referral.findOne({ referredUserId: userId, referrerUserId });
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
    const wallet = await Wallet.findOne({ userId: referrerUserId });
    const orderIds = orders.map(o => o._id.toString());
    
    const walletContributions = wallet
      ? wallet.ledgerEntries.filter(entry => 
          (entry.referenceId && orderIds.includes(entry.referenceId.toString())) ||
          (referralId && entry.referenceId && entry.referenceId.toString() === referralId.toString())
        ).map(entry => ({
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
export const getReferralNetwork = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const level1Raw = await User.find({ "referralHierarchy.level1UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");
    const level2Raw = await User.find({ "referralHierarchy.level2UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");
    const level3Raw = await User.find({ "referralHierarchy.level3UserId": userId }, "name email phone mobile referralCode referredBy createdAt status referralHierarchy firstOrderQualified");

    const level1 = await enrichReferredUsers(level1Raw, userId);
    const level2 = await enrichReferredUsers(level2Raw, userId);
    const level3 = await enrichReferredUsers(level3Raw, userId);

    return res.status(200).json({
      success: true,
      level1,
      level2,
      level3
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/admin/referrals/settings
export const getReferralSettings = async (req: Request, res: Response) => {
  try {
    let settings = await ReferralSettings.findOne({});
    if (!settings) {
      settings = new ReferralSettings();
      await settings.save();
    }
    return res.status(200).json({ success: true, settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/admin/referrals/settings
export const updateReferralSettings = async (req: Request, res: Response) => {
  try {
    let settings = await ReferralSettings.findOne({});
    if (!settings) {
      settings = new ReferralSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    return res.status(200).json({ success: true, settings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/admin/referrals/process-releases
export const processReferralReleases = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;
    const adminId = (req as any).user?.id || (req as any).user?._id;
    const stats = await SettlementEngine.releaseEligibleSettlements(undefined, orderId, adminId);
    
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/stats
export const getReferralStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(userId).populate("referredBy", "name referralCode");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const level1Count = await User.countDocuments({ "referralHierarchy.level1UserId": user._id });
    const level2Count = await User.countDocuments({ "referralHierarchy.level2UserId": user._id });
    const level3Count = await User.countDocuments({ "referralHierarchy.level3UserId": user._id });

    const completedDirectReferrals = await User.countDocuments({ "referralHierarchy.level1UserId": user._id, firstOrderQualified: true });
    const completedIndirectReferrals = await User.countDocuments({ "referralHierarchy.level2UserId": user._id, firstOrderQualified: true });
    const completedLevel3Referrals = await User.countDocuments({ "referralHierarchy.level3UserId": user._id, firstOrderQualified: true });

    // A. Signup Bonus: KYC referral rewards (Referrals with status "rewarded")
    const rewardedRefs = await Referral.find({ referrerUserId: user._id, status: "rewarded" });
    const signupBonus = rewardedRefs.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);

    // B. First Purchase Commission & C. Product Commission from ReferralTransaction
    const txs = await ReferralTransaction.find({ recipientUserId: user._id });
    
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
        if (tx.level === 1) l1_signupBonus += amt;
        else if (tx.level === 2) l2_signupBonus += amt;
        else if (tx.level === 3) l3_signupBonus += amt;
      } else if (tx.transactionType === "first_purchase_product_commission") {
        firstPurchaseCommission += amt;
        if (tx.level === 1) l1_firstPurchaseCommission += amt;
        else if (tx.level === 2) l2_firstPurchaseCommission += amt;
        else if (tx.level === 3) l3_firstPurchaseCommission += amt;
      } else if (tx.transactionType === "product_commission") {
        productCommission += amt;
        if (tx.level === 1) l1_productCommission += amt;
        else if (tx.level === 2) l2_productCommission += amt;
        else if (tx.level === 3) l3_productCommission += amt;
      }
    });

    const finalSignupBonus = signupBonusSum;

    // D. Membership, E. Vendor, F. Franchise, G. Recurring from CommissionSettlement
    const settlements = await CommissionSettlement.find({ recipientId: user._id });

    let membershipIncentives = 0;
    let vendorIncentives = 0;
    let franchiseIncentives = 0;
    let recurringCommissions = 0;

    settlements.forEach(s => {
      const amt = s.amount || 0;
      if (s.settlementType === "entrepreneur") {
        membershipIncentives += amt;
      } else if (s.settlementType === "vendor") {
        vendorIncentives += amt;
      } else if (s.settlementType === "franchise") {
        franchiseIncentives += amt;
      } else if (s.settlementType === "wishlink" || s.settlementType === "referralPool") {
        recurringCommissions += amt;
      }
    });

    // Wallet Summary
    const wallet = await Wallet.findOne({ userId: user._id });
    const availableBalance = wallet ? wallet.availableBalance : 0;
    const pendingBalance = wallet ? wallet.pendingBalance : 0;
    const withdrawnBalance = wallet ? wallet.withdrawnBalance : 0;
    const walletTotal = availableBalance + pendingBalance + withdrawnBalance;

    const totalEarned = 
      finalSignupBonus +
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
          name: (user.referredBy as any).name || "ApexBee System",
          referralCode: (user.referredBy as any).referralCode || "APEXBEE"
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/earnings-summary
export const getReferralEarningsSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const txs = await ReferralTransaction.find({ recipientUserId: userId });
    
    let direct = 0;
    let indirect = 0;
    let level3 = 0;
    let signup = 0;
    let purchase = 0;

    txs.forEach(tx => {
      if (tx.level === 1) direct += tx.amount;
      else if (tx.level === 2) indirect += tx.amount;
      else if (tx.level === 3) level3 += tx.amount;

      if (tx.transactionType === "first_order_bonus") signup += tx.amount;
      else if (tx.transactionType === "first_purchase_product_commission" || tx.transactionType === "product_commission") purchase += tx.amount;
    });

    const topReferrals: any[] = [];
    const directDownlines = await User.find({ "referralHierarchy.level1UserId": userId }, "name email");
    for (const dl of directDownlines) {
      const subTxs = await ReferralTransaction.find({ recipientUserId: userId, referredUserId: dl._id });
      const totalEarned = subTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const referralCount = await User.countDocuments({ "referralHierarchy.level1UserId": dl._id });
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/leaderboard
export const getReferralLeaderboard = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Aggregate total earnings from ReferralTransaction
    const transactions = await ReferralTransaction.aggregate([
      {
        $group: {
          _id: "$recipientUserId",
          totalEarnings: { $sum: "$amount" },
          referralCount: { $addToSet: "$referredUserId" }
        }
      },
      {
        $project: {
          recipientUserId: "$_id",
          totalEarnings: 1,
          referralCount: { $size: "$referralCount" }
        }
      },
      { $sort: { totalEarnings: -1 } }
    ]);

    // Populate user info for top 20
    const populated = [];
    let userRank = -1;
    let userEarnings = 0;
    let userCount = 0;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const isCurrentUser = tx.recipientUserId.toString() === userId.toString();
      
      const userInfo = await User.findById(tx.recipientUserId, "name email referralCode");
      if (userInfo) {
        if (isCurrentUser) {
          userRank = i + 1;
          userEarnings = tx.totalEarnings;
          userCount = tx.referralCount;
        }

        // Add to leaderboard if within top 20
        if (i < 20) {
          populated.push({
            rank: i + 1,
            name: userInfo.name,
            email: userInfo.email,
            referralCode: userInfo.referralCode,
            earnings: tx.totalEarnings,
            count: tx.referralCount,
            isCurrentUser
          });
        }
      }
    }

    // Fallback if current user is not in transactions (i.e. has 0 released earnings)
    if (userRank === -1) {
      const currentUser = await User.findById(userId, "name email referralCode");
      userRank = transactions.length + 1;
      userEarnings = 0;
      userCount = await User.countDocuments({ "referralHierarchy.level1UserId": userId });
    }

    return res.status(200).json({
      success: true,
      leaderboard: populated,
      currentUserRank: {
        rank: userRank,
        earnings: userEarnings,
        count: userCount
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

