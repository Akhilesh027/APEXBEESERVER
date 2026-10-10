import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Referral } from "../models/Referral";
import { ReferralSettings } from "../models/ReferralSettings";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { Wallet } from "../models/Wallet";
import { SettlementEngine } from "../services/SettlementEngine";
import { WalletEngine } from "../services/WalletEngine";

// GET /api/referrals/me or /my
export const getMyReferralInfo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const referralCode = (user as any).referralCode || (user as any).myReferralCode || user.phone || user._id.toString().slice(-6).toUpperCase();
    const referralLink = `https://apexbee.in/register?ref=${referralCode}`;

    const directCount = await Referral.countDocuments({ referrerUserId: userId });

    res.status(200).json({
      success: true,
      referralCode,
      referralLink,
      directReferralsCount: directCount,
      upline: (user as any).referralHierarchy || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/dashboard
export const getReferralDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const user = await User.findById(userId);

    const directReferrals = await Referral.find({ referrerUserId: userId }).populate("referredUserId", "name email phone createdAt");
    const transactions = await ReferralTransaction.find({ recipientUserId: userId }).sort({ createdAt: -1 });

    const totalEarned = transactions
      .filter(t => t.status === "released")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalPending = transactions
      .filter(t => t.status === "pending" || t.status === "placed")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    res.status(200).json({
      success: true,
      directReferralsCount: directReferrals.length,
      directReferrals,
      totalEarned,
      totalPending,
      recentTransactions: transactions.slice(0, 15)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/history
export const getReferralHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const history = await ReferralTransaction.find({ recipientUserId: userId })
      .populate("referredUserId", "name phone")
      .sort({ createdAt: -1 });

    const directRefs = await Referral.find({
      $or: [{ referrerUserId: userId }, { referrerId: userId }]
    }).populate("referredUserId", "name phone");

    const historyReferredIds = new Set(history.map(h => String((h.referredUserId as any)?._id || h.referredUserId)));
    const syntheticBonusTxs: any[] = [];
    directRefs.forEach((r) => {
      const refUserId = String((r.referredUserId as any)?._id || r.referredUserId);
      if (!historyReferredIds.has(refUserId)) {
        syntheticBonusTxs.push({
          _id: r._id,
          recipientUserId: userId,
          referredUserId: r.referredUserId,
          level: 1,
          amount: Number((r as any).reward || r.rewardAmount || 50),
          reward: Number((r as any).reward || r.rewardAmount || 50),
          transactionType: "signup_bonus",
          rewardReason: "Direct Referral Signup Bonus",
          status: r.status === "registered" || r.status === "rewarded" || r.status === "completed" ? "released" : "pending",
          createdAt: r.createdAt || new Date()
        });
      }
    });

    const combinedHistory = [...history, ...syntheticBonusTxs];
    res.status(200).json({ success: true, history: combinedHistory });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/network
export const getReferralNetwork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    // Level 1: direct
    const selectFields = "name email phone createdAt roles referredBy referralHierarchy referralCode totalReferrals";
    const level1Users = await User.find({
      _id: { $ne: userId },
      $or: [
        { "referralHierarchy.level1UserId": userId },
        { referredBy: userId }
      ]
    }).select(selectFields);
    const l1Ids = level1Users.map(u => u._id);

    // Level 2: referred by Level 1 members or level2UserId = userId
    const level2Users = await User.find({
      _id: { $nin: [userId, ...l1Ids] },
      $or: [
        { "referralHierarchy.level2UserId": userId },
        { referredBy: { $in: l1Ids } },
        { "referralHierarchy.level1UserId": { $in: l1Ids } }
      ]
    }).select(selectFields);
    const l2Ids = level2Users.map(u => u._id);

    // Level 3: referred by Level 2 members or level3UserId = userId
    const level3Users = await User.find({
      _id: { $nin: [userId, ...l1Ids, ...l2Ids] },
      $or: [
        { "referralHierarchy.level3UserId": userId },
        { referredBy: { $in: l2Ids } },
        { "referralHierarchy.level1UserId": { $in: l2Ids } }
      ]
    }).select(selectFields);

    res.status(200).json({
      success: true,
      level1: level1Users,
      level2: level2Users,
      level3: level3Users,
      network: {
        level1: { count: level1Users.length, users: level1Users },
        level2: { count: level2Users.length, users: level2Users },
        level3: { count: level3Users.length, users: level3Users },
        totalTeam: level1Users.length + level2Users.length + level3Users.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/stats
export const getReferralStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const [directCount, totalTransactions, wallet, directReferralsList] = await Promise.all([
      Referral.countDocuments({ $or: [{ referrerUserId: userId }, { referrerId: userId }] }),
      ReferralTransaction.find({ recipientUserId: userId }),
      Wallet.findOne({ userId }),
      Referral.find({ $or: [{ referrerUserId: userId }, { referrerId: userId }] })
    ]);

    const totalEarnings = totalTransactions
      .filter(t => t.status === "released")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const pendingEarnings = totalTransactions
      .filter(t => t.status === "pending" || t.status === "placed")
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const level1 = { signupBonus: 0, firstPurchaseCommission: 0, productCommission: 0, totalEarned: 0 };
    const level2 = { signupBonus: 0, firstPurchaseCommission: 0, productCommission: 0, totalEarned: 0 };
    const level3 = { signupBonus: 0, firstPurchaseCommission: 0, productCommission: 0, totalEarned: 0 };
    let firstPurchaseCommission = 0;
    let productCommission = 0;
    let signupBonus = 0;
    let franchiseIncentives = 0;

    totalTransactions.forEach(t => {
      const amt = t.amount || 0;
      const lvl = t.level || 1;
      const typeStr = (t.transactionType || "").toLowerCase();
      const reasonStr = (t.rewardReason || "").toLowerCase();

      const isFirstPurchase = typeStr.includes("first") || reasonStr.includes("first");
      const isBonus = !isFirstPurchase && (
        typeStr.includes("signup") || 
        typeStr.includes("onboarding") || 
        typeStr.includes("welcome") || 
        typeStr.includes("bonus") || 
        reasonStr.includes("signup") || 
        reasonStr.includes("onboarding") || 
        reasonStr.includes("welcome")
      );

      if (lvl === 1) {
        level1.totalEarned += amt;
        if (isBonus) level1.signupBonus += amt;
        else if (isFirstPurchase) level1.firstPurchaseCommission += amt;
        else level1.productCommission += amt;
      } else if (lvl === 2) {
        level2.totalEarned += amt;
        if (isBonus) level2.signupBonus += amt;
        else if (isFirstPurchase) level2.firstPurchaseCommission += amt;
        else level2.productCommission += amt;
      } else if (lvl === 3) {
        level3.totalEarned += amt;
        if (isBonus) level3.signupBonus += amt;
        else if (isFirstPurchase) level3.firstPurchaseCommission += amt;
        else level3.productCommission += amt;
      }

      if (isBonus) signupBonus += amt;
      else if (isFirstPurchase) firstPurchaseCommission += amt;
      else productCommission += amt;
    });

    // If no direct signup bonus transactions recorded in ReferralTransaction yet, add any rewarded signups from Referral collection
    if (signupBonus === 0 && directReferralsList.length > 0) {
      directReferralsList.forEach(r => {
        const reward = Number((r as any).reward || r.rewardAmount || 0);
        if (reward > 0) {
          signupBonus += reward;
          level1.signupBonus += reward;
          level1.totalEarned += reward;
        }
      });
    }

    res.status(200).json({
      success: true,
      stats: {
        totalReferrals: directCount,
        totalEarnings,
        totalEarned: totalEarnings,
        pendingEarnings,
        transactionCount: totalTransactions.length,
        availableBalance: wallet?.availableBalance || 0,
        pendingBalance: wallet?.pendingBalance || pendingEarnings,
        holdBalance: wallet?.holdBalance || 0,
        withdrawnBalance: wallet?.withdrawnBalance || 0,
        firstPurchaseCommission,
        productCommission,
        signupBonus,
        franchiseIncentives,
        level1,
        level2,
        level3
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/earnings-summary
export const getReferralEarningsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const txs = await ReferralTransaction.find({ recipientUserId: userId });

    const byLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    let directBonus = 0;
    let productCommission = 0;

    txs.forEach(t => {
      const lvl = t.level || 1;
      byLevel[lvl] = (byLevel[lvl] || 0) + (t.amount || 0);

      if (t.transactionType.includes("bonus")) {
        directBonus += t.amount || 0;
      } else {
        productCommission += t.amount || 0;
      }
    });

    res.status(200).json({
      success: true,
      summary: {
        byLevel,
        directBonus,
        productCommission,
        total: directBonus + productCommission
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/leaderboard
export const getReferralLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const topReferrers = await Referral.aggregate([
      { $group: { _id: "$referrerUserId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 1,
          name: "$user.name",
          count: 1
        }
      }
    ]);

    res.status(200).json({ success: true, leaderboard: topReferrers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/referrals/admin/settings
export const getReferralSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await ReferralSettings.findOne();
    if (!settings) {
      settings = await ReferralSettings.create({
        firstOrderRewards: { level1: 50, level2: 25, level3: 10 },
        enabled: true,
        defaultReferralCode: "APEXBEE"
      });
    }
    res.status(200).json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/referrals/admin/settings
export const updateReferralSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    let settings = await ReferralSettings.findOne();
    if (!settings) {
      settings = new ReferralSettings(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.status(200).json({ success: true, message: "Referral settings updated", settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/referrals/admin/process-releases or /api/admin/settlements/release
export const processReferralReleases = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await SettlementEngine.releaseEligibleSettlements();
    res.status(200).json({
      success: true,
      message: "Referral settlements processed successfully",
      stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
