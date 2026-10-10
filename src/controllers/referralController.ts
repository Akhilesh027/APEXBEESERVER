import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import mongoose from "mongoose";
import { User } from "../models/User";
import { Referral } from "../models/Referral";
import { ReferralSettings } from "../models/ReferralSettings";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { CommissionSettlement } from "../models/CommissionSettlement";
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
      .populate("referredUserId", "name phone email")
      .populate("orderId", "orderNumber totalAmount createdAt")
      .sort({ createdAt: -1 });

    const directRefs = await Referral.find({
      $or: [{ referrerUserId: userId }, { referrerId: userId }]
    }).populate("referredUserId", "name phone email");

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
          status: r.status === "registered" || r.status === "rewarded" || r.status === "approved" ? "released" : "pending",
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

    const rootUser = await User.findById(userId).select("name email phone referralCode totalReferrals");

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

    // Calculate commissions generated and orders placed by downline members
    const allDownlineIds = [...l1Ids, ...l2Ids, ...level3Users.map(u => u._id)];
    const commMap = new Map<string, number>();
    const orderMap = new Map<string, number>();

    const userObjId = new mongoose.Types.ObjectId(String(userId));
    const allDownlineObjIds = allDownlineIds.map(id => new mongoose.Types.ObjectId(String(id)));
    const allDownlineMatch = [...allDownlineIds.map(id => String(id)), ...allDownlineObjIds];

    try {
      const commsAgg = await ReferralTransaction.aggregate([
        { 
          $match: { 
            recipientUserId: { $in: [userObjId, String(userId) as any] }, 
            referredUserId: { $in: allDownlineMatch } 
          } 
        },
        { $group: { _id: "$referredUserId", totalCommission: { $sum: "$amount" }, orderCount: { $sum: 1 } } }
      ]);
      commsAgg.forEach((c: any) => {
        if (c._id) {
          const idStr = String(c._id);
          commMap.set(idStr, (commMap.get(idStr) || 0) + (c.totalCommission || 0));
          orderMap.set(idStr, (orderMap.get(idStr) || 0) + (c.orderCount || 0));
        }
      });
    } catch { }

    try {
      const settlementsAgg = await CommissionSettlement.aggregate([
        {
          $match: {
            recipientId: { $in: [userObjId, String(userId) as any] },
            $or: [
              { vendorId: { $in: allDownlineMatch } },
              { entrepreneurId: { $in: allDownlineMatch } }
            ]
          }
        },
        { $group: { _id: { $ifNull: ["$vendorId", "$entrepreneurId"] }, totalCommission: { $sum: "$amount" }, orderCount: { $sum: 1 } } }
      ]);
      settlementsAgg.forEach((s: any) => {
        if (s._id) {
          const idStr = String(s._id);
          commMap.set(idStr, (commMap.get(idStr) || 0) + (s.totalCommission || 0));
          orderMap.set(idStr, (orderMap.get(idStr) || 0) + (s.orderCount || 0));
        }
      });
    } catch { }

    try {
      const directReferralsList = await Referral.find({
        $or: [{ referrerUserId: userId }, { referrerId: userId }]
      });
      directReferralsList.forEach((dr: any) => {
        const refId = String(dr.referredUserId || dr.referredId);
        const rw = Number(dr.rewardAmount || (dr as any).reward || 0);
        if (rw > 0 && (!commMap.get(refId) || commMap.get(refId) === 0)) {
          commMap.set(refId, rw);
        }
      });
    } catch { }

    try {
      const OrderModel = mongoose.models.Order || (User.db as any).model("Order");
      if (OrderModel) {
        const ordersAgg = await OrderModel.aggregate([
          { 
            $match: { 
              $or: [
                { customerId: { $in: allDownlineMatch } },
                { userId: { $in: allDownlineMatch } }
              ]
            } 
          },
          { $group: { _id: { $ifNull: ["$customerId", "$userId"] }, orderCount: { $sum: 1 } } }
        ]);
        ordersAgg.forEach((o: any) => {
          if (o._id) {
            const idStr = String(o._id);
            orderMap.set(idStr, Math.max(orderMap.get(idStr) || 0, o.orderCount || 0));
          }
        });
      }
    } catch { }

    // Calculate root user's total commissions generated and orders placed
    let rootTotalCommission = 0;
    let rootTotalOrders = 0;

    try {
      const rootComms = await ReferralTransaction.aggregate([
        { $match: { recipientUserId: { $in: [userObjId, String(userId) as any] } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ]);
      if (rootComms.length > 0) {
        rootTotalCommission += rootComms[0].total || 0;
        rootTotalOrders += rootComms[0].count || 0;
      }
    } catch { }

    try {
      const rootSettlements = await CommissionSettlement.aggregate([
        { $match: { recipientId: { $in: [userObjId, String(userId) as any] } } },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ]);
      if (rootSettlements.length > 0) {
        rootTotalCommission += rootSettlements[0].total || 0;
        rootTotalOrders += rootSettlements[0].count || 0;
      }
    } catch { }

    try {
      const OrderModel = mongoose.models.Order || (User.db as any).model("Order");
      if (OrderModel) {
        const rootUserOrdersCount = await OrderModel.countDocuments({
          $or: [
            { customerId: { $in: [userObjId, String(userId) as any] } },
            { userId: { $in: [userObjId, String(userId) as any] } }
          ]
        });
        if (rootUserOrdersCount > 0) {
          rootTotalOrders = Math.max(rootTotalOrders, rootUserOrdersCount);
        }
      }
    } catch { }

    const enrichUser = (u: any) => {
      const raw = u.toObject ? u.toObject() : { ...u };
      const sId = String(raw._id);
      return {
        ...raw,
        totalCommissionGenerated: commMap.get(sId) || 0,
        totalPurchases: orderMap.get(sId) || 0
      };
    };

    const enrichedL1 = level1Users.map(enrichUser);
    const enrichedL2 = level2Users.map(enrichUser);
    const enrichedL3 = level3Users.map(enrichUser);

    const enrichedRootUser = {
      ...(rootUser?.toObject ? rootUser.toObject() : rootUser),
      totalCommissionGenerated: rootTotalCommission,
      totalPurchases: rootTotalOrders
    };

    res.status(200).json({
      success: true,
      user: enrichedRootUser,
      level1: enrichedL1,
      level2: enrichedL2,
      level3: enrichedL3,
      network: {
        level1: { count: enrichedL1.length, users: enrichedL1 },
        level2: { count: enrichedL2.length, users: enrichedL2 },
        level3: { count: enrichedL3.length, users: enrichedL3 },
        totalTeam: enrichedL1.length + enrichedL2.length + enrichedL3.length
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
