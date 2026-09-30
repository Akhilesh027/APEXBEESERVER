import mongoose, { ClientSession } from "mongoose";
import { User } from "../models/User";
import { Referral } from "../models/Referral";
import { Franchise } from "../models/Franchise";
import { TerritoryMapping } from "../models/TerritoryMapping";
import { WalletEngine } from "./WalletEngine";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { ReferralTransaction } from "../models/ReferralTransaction";
import { notificationEmitter } from "../modules/notifications/events/notificationEmitter";
import { SettlementEngine } from "./SettlementEngine";

export interface CommissionRecipient {
  userId: mongoose.Types.ObjectId;
  role: string;
  tier: string;
  percentage: number;
  amount: number;
  description: string;
}

export class AssignmentCommissionService {
  /**
   * Traverse up to 3 levels of referral uplines
   */
  static async resolveReferralUplines(
    userId: mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<{
    level1?: mongoose.Types.ObjectId;
    level2?: mongoose.Types.ObjectId;
    level3?: mongoose.Types.ObjectId;
  }> {
    const result: {
      level1?: mongoose.Types.ObjectId;
      level2?: mongoose.Types.ObjectId;
      level3?: mongoose.Types.ObjectId;
    } = {};

    try {
      // Level 1
      let ref1Query = Referral.findOne({ referredUserId: userId });
      if (session) ref1Query = ref1Query.session(session);
      const ref1 = await ref1Query;

      if (ref1 && ref1.referrerUserId) {
        result.level1 = ref1.referrerUserId;

        // Level 2
        let ref2Query = Referral.findOne({ referredUserId: ref1.referrerUserId });
        if (session) ref2Query = ref2Query.session(session);
        const ref2 = await ref2Query;

        if (ref2 && ref2.referrerUserId) {
          result.level2 = ref2.referrerUserId;

          // Level 3
          let ref3Query = Referral.findOne({ referredUserId: ref2.referrerUserId });
          if (session) ref3Query = ref3Query.session(session);
          const ref3 = await ref3Query;

          if (ref3 && ref3.referrerUserId) {
            result.level3 = ref3.referrerUserId;
          }
        }
      }
    } catch (err) {
      console.warn("[AssignmentCommissionService] Error resolving referral uplines:", err);
    }

    return result;
  }

  /**
   * Resolve Mandal, District, and State Franchisers for a given geography
   */
  /**
   * Resolve Mandal, District, and State Franchisers for a given geography or user hierarchy
   */
  static async resolveTerritoryFranchisers(
    location: {
      state?: string;
      district?: string;
      mandal?: string;
    },
    sourceUserId?: mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<{
    mandalFranchiseUserId?: mongoose.Types.ObjectId;
    districtFranchiseUserId?: mongoose.Types.ObjectId;
    stateFranchiseUserId?: mongoose.Types.ObjectId;
  }> {
    let { state, district, mandal } = location || {};
    const result: {
      mandalFranchiseUserId?: mongoose.Types.ObjectId;
      districtFranchiseUserId?: mongoose.Types.ObjectId;
      stateFranchiseUserId?: mongoose.Types.ObjectId;
    } = {};

    const activeStatusFilter = {
      $in: ["active", "Active", "Approved", "approved", "verified", "Verified", "pending_verification"]
    };

    try {
      // If location is incomplete, try resolving from sourceUser or sourceUser's Franchise doc
      if (sourceUserId && (!state || !district || !mandal)) {
        const u = await User.findById(sourceUserId).session(session || null);
        if (u) {
          state = state || u.territory?.state || (u as any).state;
          district = district || u.territory?.district || (u as any).district;
          mandal = mandal || u.territory?.mandal || (u as any).mandal;
        }
        const fc = await Franchise.findOne({ userId: sourceUserId }).session(session || null);
        if (fc) {
          state = state || fc.state;
          district = district || fc.district;
          mandal = mandal || fc.mandal;
        }
      }

      const cleanState = (state || "").trim();
      const cleanDistrict = (district || "").trim();
      const cleanMandal = (mandal || "").trim();

      const stateRegex = cleanState
        ? new RegExp(`^${cleanState.replace(/\s*state$/i, "").trim()}`, "i")
        : null;
      const districtRegex = cleanDistrict
        ? new RegExp(`^${cleanDistrict.replace(/\s*district$/i, "").trim()}`, "i")
        : null;
      const mandalRegex = cleanMandal
        ? new RegExp(`^${cleanMandal.replace(/\s*mandal$/i, "").trim()}`, "i")
        : null;

      // 1. Check Mandal Franchiser
      if (mandalRegex && districtRegex && stateRegex) {
        let mandalFranchise = await Franchise.findOne({
          franchiseLevel: "mandal",
          state: stateRegex,
          district: districtRegex,
          mandal: mandalRegex,
          status: activeStatusFilter,
        }).session(session || null);

        if (!mandalFranchise) {
          mandalFranchise = await Franchise.findOne({
            franchiseLevel: "mandal",
            mandal: mandalRegex,
          }).session(session || null);
        }

        if (mandalFranchise && mandalFranchise.userId) {
          result.mandalFranchiseUserId = mandalFranchise.userId as any;
        } else {
          // Fallback via TerritoryMapping
          const mapping = await TerritoryMapping.findOne({
            state: stateRegex,
            district: districtRegex,
            mandal: mandalRegex,
            mandalFranchiseId: { $ne: null },
          }).populate("mandalFranchiseId").session(session || null);

          if (mapping && (mapping.mandalFranchiseId as any)?.userId) {
            result.mandalFranchiseUserId = (mapping.mandalFranchiseId as any).userId;
          }
        }
      }

      // 2. Check District Franchiser
      let districtFranchiseDoc: any = null;
      if (districtRegex) {
        const query: any = {
          franchiseLevel: "district",
          district: districtRegex,
        };
        if (stateRegex) query.state = stateRegex;

        districtFranchiseDoc = await Franchise.findOne({
          ...query,
          status: activeStatusFilter,
        }).sort({ createdAt: -1 }).session(session || null);

        if (!districtFranchiseDoc) {
          districtFranchiseDoc = await Franchise.findOne(query).sort({ createdAt: -1 }).session(session || null);
        }

        if (districtFranchiseDoc && districtFranchiseDoc.userId) {
          result.districtFranchiseUserId = districtFranchiseDoc.userId as any;
        } else {
          // Fallback via TerritoryMapping
          const mapping = await TerritoryMapping.findOne({
            district: districtRegex,
            districtFranchiseId: { $ne: null },
          }).populate("districtFranchiseId").session(session || null);

          if (mapping && (mapping.districtFranchiseId as any)?.userId) {
            result.districtFranchiseUserId = (mapping.districtFranchiseId as any).userId;
            districtFranchiseDoc = mapping.districtFranchiseId;
          }
        }
      }

      // 3. Check State Franchiser
      // Method A: Check via state name matching (prioritizing the latest registered/approved)
      let stateFranchiseDoc: any = null;
      if (stateRegex) {
        stateFranchiseDoc = await Franchise.findOne({
          franchiseLevel: "state",
          state: stateRegex,
          status: activeStatusFilter,
        }).sort({ createdAt: -1 }).session(session || null);

        if (!stateFranchiseDoc) {
          // Try without strict status
          stateFranchiseDoc = await Franchise.findOne({
            franchiseLevel: "state",
            state: stateRegex,
          }).sort({ createdAt: -1 }).session(session || null);
        }
      }

      // Method B: Check via TerritoryMapping
      if (!stateFranchiseDoc && stateRegex) {
        const mapping = await TerritoryMapping.findOne({
          state: stateRegex,
          stateFranchiseId: { $ne: null },
        }).populate("stateFranchiseId").session(session || null);

        if (mapping && (mapping.stateFranchiseId as any)?.userId) {
          stateFranchiseDoc = mapping.stateFranchiseId;
        }
      }

      // Method C: Traverse parentFranchiseId from District Franchise
      if (!stateFranchiseDoc && districtFranchiseDoc && districtFranchiseDoc.parentFranchiseId) {
        const parentOfDistrict = await Franchise.findById(districtFranchiseDoc.parentFranchiseId).session(session || null);
        if (parentOfDistrict && parentOfDistrict.franchiseLevel === "state") {
          stateFranchiseDoc = parentOfDistrict;
        }
      }

      // Method D: If sourceUser has a Franchise record, check its parent hierarchy
      if (!stateFranchiseDoc && sourceUserId) {
        const sourceFc = await Franchise.findOne({ userId: sourceUserId }).session(session || null);
        if (sourceFc && sourceFc.parentFranchiseId) {
          const parent = await Franchise.findById(sourceFc.parentFranchiseId).session(session || null);
          if (parent) {
            if (parent.franchiseLevel === "state") {
              stateFranchiseDoc = parent;
            } else if (parent.parentFranchiseId) {
              const grandParent = await Franchise.findById(parent.parentFranchiseId).session(session || null);
              if (grandParent && grandParent.franchiseLevel === "state") {
                stateFranchiseDoc = grandParent;
              }
            }
          }
        }
      }

      // Method E: Check User model for state_franchise role
      if (!stateFranchiseDoc) {
        const stateUser = await User.findOne({
          roles: { $in: ["state_franchise"] },
          status: { $ne: "blocked" },
          ...(stateRegex ? { "territory.state": stateRegex } : {}),
        }).session(session || null);

        if (stateUser) {
          result.stateFranchiseUserId = stateUser._id as any;
        }
      }

      // Method F: If only 1 State Franchise exists in DB, fallback to it
      if (!stateFranchiseDoc && !result.stateFranchiseUserId) {
        const allStateFranchises = await Franchise.find({
          franchiseLevel: "state",
        }).session(session || null);

        if (allStateFranchises.length === 1) {
          stateFranchiseDoc = allStateFranchises[0];
          console.log(`[AssignmentCommissionService] Using single registered State Franchise fallback: ${stateFranchiseDoc.businessName}`);
        } else if (allStateFranchises.length > 1 && stateRegex) {
          const matched = allStateFranchises.find(f => stateRegex.test(f.state || ""));
          if (matched) stateFranchiseDoc = matched;
        }
      }

      if (stateFranchiseDoc && stateFranchiseDoc.userId) {
        result.stateFranchiseUserId = stateFranchiseDoc.userId as any;
      }

      console.log(`[AssignmentCommissionService] Resolved Territory Franchisers:`, {
        location: { state: cleanState, district: cleanDistrict, mandal: cleanMandal },
        mandalFranchiseUserId: result.mandalFranchiseUserId,
        districtFranchiseUserId: result.districtFranchiseUserId,
        stateFranchiseUserId: result.stateFranchiseUserId,
      });

    } catch (err) {
      console.warn("[AssignmentCommissionService] Error resolving territory franchisers:", err);
    }

    return result;
  }

  /**
   * Calculate and execute multi-tier commission settlement on fee payment
   */
  static async processFeeCommissionSettlement(params: {
    sourceUserId: mongoose.Types.ObjectId;
    sourceRole: "franchise" | "vendor" | "service_provider" | "user";
    serviceKey: string;
    amount: number;
    referenceId: string | mongoose.Types.ObjectId;
    location?: {
      state?: string;
      district?: string;
      mandal?: string;
      franchiseLevel?: "mandal" | "district" | "state";
    };
    notes?: string;
    session?: ClientSession;
  }): Promise<{
    success: boolean;
    settlements: CommissionRecipient[];
    companyRetainedAmount: number;
  }> {
    const { sourceUserId, sourceRole, serviceKey, amount, referenceId, location, notes, session } = params;

    await SettlementEngine.ensureSystemProfiles(session);

    const uplines = await this.resolveReferralUplines(sourceUserId, session);
    const franchisers = await this.resolveTerritoryFranchisers(location || {}, sourceUserId, session);

    const settlements: CommissionRecipient[] = [];
    let totalDistributedPercent = 0;

    const normKey = serviceKey.toLowerCase();

    // 1. MANDAL FRANCHISE ASSIGN
    // L1: 10%, L2: 3%, L3: 2%, Dist Franchiser: 10%, State Franchiser: 5% (Company: 70%)
    if (normKey.includes("mandal_franchise") || (sourceRole === "franchise" && location?.franchiseLevel === "mandal")) {
      if (uplines.level1) {
        settlements.push({
          userId: uplines.level1,
          role: "referrer",
          tier: "Level 1 Referral (10%)",
          percentage: 10,
          amount: Number(((amount * 10) / 100).toFixed(2)),
          description: `Level 1 Sponsor Commission for Mandal Franchise Assignment`,
        });
        totalDistributedPercent += 10;
      }
      if (uplines.level2) {
        settlements.push({
          userId: uplines.level2,
          role: "referrer",
          tier: "Level 2 Referral (3%)",
          percentage: 3,
          amount: Number(((amount * 3) / 100).toFixed(2)),
          description: `Level 2 Upline Commission for Mandal Franchise Assignment`,
        });
        totalDistributedPercent += 3;
      }
      if (uplines.level3) {
        settlements.push({
          userId: uplines.level3,
          role: "referrer",
          tier: "Level 3 Referral (2%)",
          percentage: 2,
          amount: Number(((amount * 2) / 100).toFixed(2)),
          description: `Level 3 Upline Commission for Mandal Franchise Assignment`,
        });
        totalDistributedPercent += 2;
      }
      if (franchisers.districtFranchiseUserId) {
        settlements.push({
          userId: franchisers.districtFranchiseUserId,
          role: "district_franchise",
          tier: "District Franchiser (10%)",
          percentage: 10,
          amount: Number(((amount * 10) / 100).toFixed(2)),
          description: `District Franchise Override Commission for Mandal Assignment`,
        });
        totalDistributedPercent += 10;
      }
      if (franchisers.stateFranchiseUserId) {
        settlements.push({
          userId: franchisers.stateFranchiseUserId,
          role: "state_franchise",
          tier: "State Franchiser (5%)",
          percentage: 5,
          amount: Number(((amount * 5) / 100).toFixed(2)),
          description: `State Franchise Override Commission for Mandal Assignment`,
        });
        totalDistributedPercent += 5;
      }
    }

    // 2. DISTRICT FRANCHISE ASSIGN
    // L1: 15%, L2: 3%, L3: 2%, State Franchiser: 10% (Company: 70%)
    else if (normKey.includes("dist_franchise") || normKey.includes("district_franchise") || (sourceRole === "franchise" && location?.franchiseLevel === "district")) {
      if (uplines.level1) {
        settlements.push({
          userId: uplines.level1,
          role: "referrer",
          tier: "Level 1 Referral (15%)",
          percentage: 15,
          amount: Number(((amount * 15) / 100).toFixed(2)),
          description: `Level 1 Sponsor Commission for District Franchise Assignment`,
        });
        totalDistributedPercent += 15;
      }
      if (uplines.level2) {
        settlements.push({
          userId: uplines.level2,
          role: "referrer",
          tier: "Level 2 Referral (3%)",
          percentage: 3,
          amount: Number(((amount * 3) / 100).toFixed(2)),
          description: `Level 2 Upline Commission for District Franchise Assignment`,
        });
        totalDistributedPercent += 3;
      }
      if (uplines.level3) {
        settlements.push({
          userId: uplines.level3,
          role: "referrer",
          tier: "Level 3 Referral (2%)",
          percentage: 2,
          amount: Number(((amount * 2) / 100).toFixed(2)),
          description: `Level 3 Upline Commission for District Franchise Assignment`,
        });
        totalDistributedPercent += 2;
      }
      if (franchisers.stateFranchiseUserId) {
        settlements.push({
          userId: franchisers.stateFranchiseUserId,
          role: "state_franchise",
          tier: "State Franchiser (10%)",
          percentage: 10,
          amount: Number(((amount * 10) / 100).toFixed(2)),
          description: `State Franchise Override Commission for District Assignment`,
        });
        totalDistributedPercent += 10;
      }
    }

    // 3. STATE FRANCHISE ASSIGN
    // L1: 15%, L2: 3%, L3: 2% (Company: 80%)
    else if (normKey.includes("state_franchise") || (sourceRole === "franchise" && location?.franchiseLevel === "state")) {
      if (uplines.level1) {
        settlements.push({
          userId: uplines.level1,
          role: "referrer",
          tier: "Level 1 Referral (15%)",
          percentage: 15,
          amount: Number(((amount * 15) / 100).toFixed(2)),
          description: `Level 1 Sponsor Commission for State Franchise Assignment`,
        });
        totalDistributedPercent += 15;
      }
      if (uplines.level2) {
        settlements.push({
          userId: uplines.level2,
          role: "referrer",
          tier: "Level 2 Referral (3%)",
          percentage: 3,
          amount: Number(((amount * 3) / 100).toFixed(2)),
          description: `Level 2 Upline Commission for State Franchise Assignment`,
        });
        totalDistributedPercent += 3;
      }
      if (uplines.level3) {
        settlements.push({
          userId: uplines.level3,
          role: "referrer",
          tier: "Level 3 Referral (2%)",
          percentage: 2,
          amount: Number(((amount * 2) / 100).toFixed(2)),
          description: `Level 3 Upline Commission for State Franchise Assignment`,
        });
        totalDistributedPercent += 2;
      }
    }

    // 4. VENDOR ENROLLMENT, SOFTWARE, OR MARKETING SERVICES
    // L1: 10%, L2: 3%, L3: 2%, Mandal Franchiser: 10%, Dist. Franchiser: 5%, State Franchiser: 3% (Company: 67%)
    else {
      if (uplines.level1) {
        settlements.push({
          userId: uplines.level1,
          role: "referrer",
          tier: "Level 1 Referral (10%)",
          percentage: 10,
          amount: Number(((amount * 10) / 100).toFixed(2)),
          description: `Level 1 Referral Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 10;
      }
      if (uplines.level2) {
        settlements.push({
          userId: uplines.level2,
          role: "referrer",
          tier: "Level 2 Referral (3%)",
          percentage: 3,
          amount: Number(((amount * 3) / 100).toFixed(2)),
          description: `Level 2 Upline Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 3;
      }
      if (uplines.level3) {
        settlements.push({
          userId: uplines.level3,
          role: "referrer",
          tier: "Level 3 Referral (2%)",
          percentage: 2,
          amount: Number(((amount * 2) / 100).toFixed(2)),
          description: `Level 3 Upline Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 2;
      }
      if (franchisers.mandalFranchiseUserId) {
        settlements.push({
          userId: franchisers.mandalFranchiseUserId,
          role: "mandal_franchise",
          tier: "Mandal Franchiser (10%)",
          percentage: 10,
          amount: Number(((amount * 10) / 100).toFixed(2)),
          description: `Mandal Franchise Territory Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 10;
      }
      if (franchisers.districtFranchiseUserId) {
        settlements.push({
          userId: franchisers.districtFranchiseUserId,
          role: "district_franchise",
          tier: "District Franchiser (5%)",
          percentage: 5,
          amount: Number(((amount * 5) / 100).toFixed(2)),
          description: `District Franchise Territory Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 5;
      }
      if (franchisers.stateFranchiseUserId) {
        settlements.push({
          userId: franchisers.stateFranchiseUserId,
          role: "state_franchise",
          tier: "State Franchiser (3%)",
          percentage: 3,
          amount: Number(((amount * 3) / 100).toFixed(2)),
          description: `State Franchise Territory Commission for Vendor Enrollment / Software Fee`,
        });
        totalDistributedPercent += 3;
      }
    }

    // Calculate total distributed amount and company retained amount
    const totalDistributedAmount = settlements.reduce((acc, s) => acc + s.amount, 0);
    const companyRetainedAmount = Number((amount - totalDistributedAmount).toFixed(2));

    // Credit each recipient's wallet
    for (const item of settlements) {
      try {
        await WalletEngine.credit(
          item.userId,
          item.amount,
          {
            category: item.role === "referrer" ? "Referral Bonus" : "Franchise Commission",
            source: "fee_assignment_commission",
            remarks: `${item.tier}: ${item.description} (${notes || serviceKey})`,
            referenceId: new mongoose.Types.ObjectId(String(referenceId)),
            referenceType: item.role === "referrer" ? "REFERRAL" : "SYSTEM",
            operationKey: `${item.userId}_${item.role}_${referenceId}`,
          },
          session
        );

        // Record ReferralTransaction if referrer
        if (item.role === "referrer") {
          await ReferralTransaction.create(
            [
              {
                recipientUserId: item.userId,
                referrerUserId: item.userId,
                referredUserId: sourceUserId,
                amount: item.amount,
                commissionPercent: item.percentage,
                orderAmount: amount,
                level: item.tier.includes("Level 1") ? 1 : item.tier.includes("Level 2") ? 2 : 3,
                transactionType: "product_commission",
                rewardReason: "product_commission",
                notes: `${item.tier}: ${item.description}`,
                status: "released",
                released: true,
                walletCredited: true,
                releaseDate: new Date(),
                releasedAt: new Date(),
              },
            ],
            { session }
          );
        } else {
          // Record CommissionSettlement for franchiser
          await CommissionSettlement.create(
            [
              {
                recipientId: item.userId,
                settlementType: "franchise",
                amount: item.amount,
                percentage: item.percentage,
                status: "released",
                remarks: `${item.tier} for ${serviceKey}`,
              },
            ],
            { session }
          );
        }

        // Notify recipient
        notificationEmitter.emitNotification(
          "wallet.credited",
          {
            userId: item.userId.toString(),
            amount: item.amount,
            title: "Commission Credited! 🎉",
            message: `You earned ₹${item.amount} (${item.tier}) for ${serviceKey}.`,
          },
          [{ userId: item.userId.toString() }]
        );
      } catch (creditErr) {
        console.error(`[AssignmentCommissionService] Failed to credit wallet for user ${item.userId}:`, creditErr);
      }
    }

    // Credit retained company pool
    if (companyRetainedAmount > 0) {
      try {
        await WalletEngine.credit(
          SettlementEngine.COMPANY_ID,
          companyRetainedAmount,
          {
            category: "Platform Reserve",
            source: "fee_company_retained",
            remarks: `Platform fee retainment (${amount - totalDistributedAmount}) for ${serviceKey}`,
            referenceId: new mongoose.Types.ObjectId(String(referenceId)),
            referenceType: "SYSTEM",
          },
          session
        );
      } catch (compErr) {
        console.warn("[AssignmentCommissionService] Error crediting company pool:", compErr);
      }
    }

    return {
      success: true,
      settlements,
      companyRetainedAmount,
    };
  }
}
