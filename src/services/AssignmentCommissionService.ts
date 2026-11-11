import mongoose from "mongoose";
import { User } from "../models/User";
import { Franchise } from "../models/Franchise";
import { Territory } from "../models/Territory";
import { WalletEngine } from "./WalletEngine";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { SettlementEngine } from "./SettlementEngine";
import { FeeInvoice } from "../models/FeeInvoice";
import { Vendor } from "../models/Vendor";
import { BusinessApplication } from "../models/BusinessApplication";
import { RestaurantProfile } from "../models/RestaurantProfile";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TerritoryLocation {
  state?: string;
  district?: string;
  mandal?: string;
  franchiseLevel?: "state" | "district" | "mandal" | string;
}

export interface FeeCommissionParams {
  sourceUserId?: any;
  sourceRole?: string;
  serviceKey?: string;
  amount: number;
  referenceId?: any;
  location?: TerritoryLocation;
  notes?: string;
}

export interface CommissionSettlementItem {
  userId: any;
  role: string;
  tier: string;
  percentage: number;
  amount: number;
  status: string;
}

export interface FeeCommissionResult {
  success: boolean;
  totalDistributed: number;
  companyRetainedAmount: number;
  settlements: CommissionSettlementItem[];
}

export class AssignmentCommissionService {
  /**
   * Helper to resolve an active User ID from a Franchise doc or ID.
   */
  private static async resolveUserIdFromFranchise(
    franchiseDocOrId: any,
    excludeUserId?: any
  ): Promise<mongoose.Types.ObjectId | null> {
    if (!franchiseDocOrId) return null;

    let fDoc: any = null;
    if (typeof franchiseDocOrId === "string" || franchiseDocOrId instanceof mongoose.Types.ObjectId) {
      fDoc = await Franchise.findById(franchiseDocOrId);
    } else {
      fDoc = franchiseDocOrId;
    }

    if (!fDoc) return null;

    // Check by fDoc.userId
    if (fDoc.userId) {
      if (!excludeUserId || fDoc.userId.toString() !== excludeUserId.toString()) {
        const u = await User.findOne({
          _id: fDoc.userId,
          status: { $in: ["active", "Active"] }
        });
        if (u) return u._id as any;
      }
    }

    // Check by fDoc.email
    if (fDoc.email) {
      const u = await User.findOne({
        email: { $regex: new RegExp(`^${fDoc.email.trim()}$`, "i") },
        status: { $in: ["active", "Active"] }
      });
      if (u && (!excludeUserId || u._id.toString() !== excludeUserId.toString())) {
        return u._id as any;
      }
    }

    return null;
  }

  /**
   * Resolve territory franchise users for state, district, and mandal.
   * Strictly prioritizes the currently assigned franchise on that territory.
   */
  static async resolveTerritoryFranchisers(
    location?: TerritoryLocation,
    excludeUserId?: any
  ): Promise<{
    stateFranchiseUserId: mongoose.Types.ObjectId | null;
    districtFranchiseUserId: mongoose.Types.ObjectId | null;
    mandalFranchiseUserId: mongoose.Types.ObjectId | null;
  }> {
    let stateFranchiseUserId: mongoose.Types.ObjectId | null = null;
    let districtFranchiseUserId: mongoose.Types.ObjectId | null = null;
    let mandalFranchiseUserId: mongoose.Types.ObjectId | null = null;

    if (!location) {
      return { stateFranchiseUserId, districtFranchiseUserId, mandalFranchiseUserId };
    }

    const { state, district, mandal } = location;

    // 1. Mandal Franchiser (strictly for this mandal territory)
    if (mandal && String(mandal).trim()) {
      let cleanMandal = String(mandal).trim();
      const normMandal = cleanMandal.replace(/\s*mandal$/i, "").trim();
      const escapedMandal = escapeRegex(cleanMandal);
      const escapedNormMandal = escapeRegex(normMandal);
      const mandalRegexStr = `^(${escapedMandal}|${escapedNormMandal})$`;

      const mandalQuery: any = {
        level: "Mandal",
        $or: [
          { mandal: { $regex: new RegExp(mandalRegexStr, "i") } },
          { name: { $regex: new RegExp(mandalRegexStr, "i") } }
        ]
      };
      if (district && String(district).trim()) {
        const cleanDist = String(district).trim();
        const normDist = cleanDist.replace(/\s*district$/i, "").trim();
        const distRegexStr = `^(${escapeRegex(cleanDist)}|${escapeRegex(normDist)})$`;
        mandalQuery.district = { $regex: new RegExp(distRegexStr, "i") };
      }

      // Priority 1: Check Territory collection
      const mandalTerritories = await Territory.find(mandalQuery);
      const activeMandalTerritory = mandalTerritories.find(
        (t) => t.franchiseStatus === "ACTIVE" && (t.franchiseId || t.currentFranchisee?.franchiseId || t.currentFranchisee?.masterUserId || t.currentFranchisee?.email)
      ) || mandalTerritories[0];

      if (activeMandalTerritory) {
        if (activeMandalTerritory.franchiseId) {
          mandalFranchiseUserId = await this.resolveUserIdFromFranchise(activeMandalTerritory.franchiseId, excludeUserId);
        }
        if (!mandalFranchiseUserId && activeMandalTerritory.currentFranchisee?.franchiseId) {
          mandalFranchiseUserId = await this.resolveUserIdFromFranchise(activeMandalTerritory.currentFranchisee.franchiseId, excludeUserId);
        }
        if (!mandalFranchiseUserId && activeMandalTerritory.currentFranchisee?.masterUserId) {
          const candidateId = activeMandalTerritory.currentFranchisee.masterUserId;
          if (!excludeUserId || candidateId.toString() !== excludeUserId.toString()) {
            const u = await User.findOne({ _id: candidateId, status: { $in: ["active", "Active"] } });
            if (u) mandalFranchiseUserId = u._id as any;
          }
        }
        if (!mandalFranchiseUserId && activeMandalTerritory.currentFranchisee?.email) {
          const u = await User.findOne({
            email: { $regex: new RegExp(`^${escapeRegex(activeMandalTerritory.currentFranchisee.email.trim())}$`, "i") },
            status: { $in: ["active", "Active"] }
          });
          if (u && (!excludeUserId || u._id.toString() !== excludeUserId.toString())) {
            mandalFranchiseUserId = u._id as any;
          }
        }
        if (!mandalFranchiseUserId) {
          const assignedFranchise = await Franchise.findOne({
            assignedTerritories: activeMandalTerritory._id,
            status: { $in: ["active", "Approved", "approved", "verified"] }
          });
          if (assignedFranchise) {
            mandalFranchiseUserId = await this.resolveUserIdFromFranchise(assignedFranchise, excludeUserId);
          }
        }
      }

      // Priority 2: Franchises that have assignedTerritories non-empty
      if (!mandalFranchiseUserId) {
        const assignedFranchises = await Franchise.find({
          franchiseLevel: "mandal",
          $or: [
            { mandal: { $regex: new RegExp(mandalRegexStr, "i") } },
            { businessName: { $regex: new RegExp(mandalRegexStr, "i") } }
          ],
          assignedTerritories: { $exists: true, $not: { $size: 0 } },
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const mf of assignedFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(mf, excludeUserId);
          if (candidateUserId) {
            mandalFranchiseUserId = candidateUserId;
            break;
          }
        }
      }

      // Priority 3: Fallback only if no territory assignment existed
      if (!mandalFranchiseUserId) {
        const mandalFranchises = await Franchise.find({
          franchiseLevel: "mandal",
          $or: [
            { mandal: { $regex: new RegExp(mandalRegexStr, "i") } },
            { businessName: { $regex: new RegExp(mandalRegexStr, "i") } }
          ],
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const mf of mandalFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(mf, excludeUserId);
          if (candidateUserId) {
            mandalFranchiseUserId = candidateUserId;
            break;
          }
        }
      }
    }

    // 2. District Franchiser (strictly for this district territory)
    if (district && String(district).trim()) {
      let cleanDistrict = String(district).trim();
      const normDistrict = cleanDistrict.replace(/\s*district$/i, "").trim();
      const escapedDist = escapeRegex(cleanDistrict);
      const escapedNormDist = escapeRegex(normDistrict);
      const distRegexStr = `^(${escapedDist}|${escapedNormDist})$`;

      const distQuery: any = {
        level: "District",
        $or: [
          { district: { $regex: new RegExp(distRegexStr, "i") } },
          { name: { $regex: new RegExp(distRegexStr, "i") } }
        ]
      };
      if (state && String(state).trim()) {
        const cleanState = String(state).trim();
        const normState = cleanState.replace(/\s*state$/i, "").trim();
        const stateRegexStr = `^(${escapeRegex(cleanState)}|${escapeRegex(normState)})$`;
        distQuery.state = { $regex: new RegExp(stateRegexStr, "i") };
      }

      // Priority 1: Check Territory collection
      const distTerritories = await Territory.find(distQuery);
      const activeDistTerritory = distTerritories.find(
        (t) => t.franchiseStatus === "ACTIVE" && (t.franchiseId || t.currentFranchisee?.franchiseId || t.currentFranchisee?.masterUserId || t.currentFranchisee?.email)
      ) || distTerritories[0];

      if (activeDistTerritory) {
        if (activeDistTerritory.franchiseId) {
          districtFranchiseUserId = await this.resolveUserIdFromFranchise(activeDistTerritory.franchiseId, excludeUserId);
        }
        if (!districtFranchiseUserId && activeDistTerritory.currentFranchisee?.franchiseId) {
          districtFranchiseUserId = await this.resolveUserIdFromFranchise(activeDistTerritory.currentFranchisee.franchiseId, excludeUserId);
        }
        if (!districtFranchiseUserId && activeDistTerritory.currentFranchisee?.masterUserId) {
          const candidateId = activeDistTerritory.currentFranchisee.masterUserId;
          if (!excludeUserId || candidateId.toString() !== excludeUserId.toString()) {
            const u = await User.findOne({ _id: candidateId, status: { $in: ["active", "Active"] } });
            if (u) districtFranchiseUserId = u._id as any;
          }
        }
        if (!districtFranchiseUserId && activeDistTerritory.currentFranchisee?.email) {
          const u = await User.findOne({
            email: { $regex: new RegExp(`^${escapeRegex(activeDistTerritory.currentFranchisee.email.trim())}$`, "i") },
            status: { $in: ["active", "Active"] }
          });
          if (u && (!excludeUserId || u._id.toString() !== excludeUserId.toString())) {
            districtFranchiseUserId = u._id as any;
          }
        }
        if (!districtFranchiseUserId) {
          const assignedFranchise = await Franchise.findOne({
            assignedTerritories: activeDistTerritory._id,
            status: { $in: ["active", "Approved", "approved", "verified"] }
          });
          if (assignedFranchise) {
            districtFranchiseUserId = await this.resolveUserIdFromFranchise(assignedFranchise, excludeUserId);
          }
        }
      }

      // Priority 2: Franchises that have assignedTerritories non-empty
      if (!districtFranchiseUserId) {
        const assignedFranchises = await Franchise.find({
          franchiseLevel: "district",
          $or: [
            { district: { $regex: new RegExp(distRegexStr, "i") } },
            { businessName: { $regex: new RegExp(distRegexStr, "i") } }
          ],
          assignedTerritories: { $exists: true, $not: { $size: 0 } },
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const df of assignedFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(df, excludeUserId);
          if (candidateUserId) {
            districtFranchiseUserId = candidateUserId;
            break;
          }
        }
      }

      // Priority 3: Fallback only if no territory assignment existed
      if (!districtFranchiseUserId) {
        const distFranchises = await Franchise.find({
          franchiseLevel: "district",
          $or: [
            { district: { $regex: new RegExp(distRegexStr, "i") } },
            { businessName: { $regex: new RegExp(distRegexStr, "i") } }
          ],
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const df of distFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(df, excludeUserId);
          if (candidateUserId) {
            districtFranchiseUserId = candidateUserId;
            break;
          }
        }
      }
    }

    // 3. State Franchiser (strictly for this state territory)
    if (state && String(state).trim()) {
      let cleanState = String(state).trim();
      const normState = cleanState.replace(/\s*state$/i, "").trim();
      const escapedState = escapeRegex(cleanState);
      const escapedNormState = escapeRegex(normState);
      const stateRegexStr = `^(${escapedState}|${escapedNormState})$`;

      // Priority 1: Check Territory collection for this state
      const stateTerritories = await Territory.find({
        level: "State",
        $or: [
          { state: { $regex: new RegExp(stateRegexStr, "i") } },
          { name: { $regex: new RegExp(stateRegexStr, "i") } }
        ]
      });
      const activeStateTerritory = stateTerritories.find(
        (t) => t.franchiseStatus === "ACTIVE" && (t.franchiseId || t.currentFranchisee?.franchiseId || t.currentFranchisee?.masterUserId || t.currentFranchisee?.email)
      ) || stateTerritories[0];

      if (activeStateTerritory) {
        // 1a. Direct franchiseId on territory (set when admin reassigns territory!)
        if (activeStateTerritory.franchiseId) {
          stateFranchiseUserId = await this.resolveUserIdFromFranchise(activeStateTerritory.franchiseId, excludeUserId);
        }

        // 1b. currentFranchisee.franchiseId
        if (!stateFranchiseUserId && activeStateTerritory.currentFranchisee?.franchiseId) {
          stateFranchiseUserId = await this.resolveUserIdFromFranchise(activeStateTerritory.currentFranchisee.franchiseId, excludeUserId);
        }

        // 1c. currentFranchisee.masterUserId
        if (!stateFranchiseUserId && activeStateTerritory.currentFranchisee?.masterUserId) {
          const candidateId = activeStateTerritory.currentFranchisee.masterUserId;
          if (!excludeUserId || candidateId.toString() !== excludeUserId.toString()) {
            const u = await User.findOne({ _id: candidateId, status: { $in: ["active", "Active"] } });
            if (u) stateFranchiseUserId = u._id as any;
          }
        }

        // 1d. currentFranchisee.email
        if (!stateFranchiseUserId && activeStateTerritory.currentFranchisee?.email) {
          const u = await User.findOne({
            email: { $regex: new RegExp(`^${escapeRegex(activeStateTerritory.currentFranchisee.email.trim())}$`, "i") },
            status: { $in: ["active", "Active"] }
          });
          if (u && (!excludeUserId || u._id.toString() !== excludeUserId.toString())) {
            stateFranchiseUserId = u._id as any;
          }
        }

        // 1e. Franchise with assignedTerritories containing this territory._id
        if (!stateFranchiseUserId) {
          const assignedFranchise = await Franchise.findOne({
            assignedTerritories: activeStateTerritory._id,
            status: { $in: ["active", "Approved", "approved", "verified"] }
          });
          if (assignedFranchise) {
            stateFranchiseUserId = await this.resolveUserIdFromFranchise(assignedFranchise, excludeUserId);
          }
        }
      }

      // Priority 2: Franchises that have assignedTerritories non-empty in this state
      if (!stateFranchiseUserId) {
        const assignedFranchises = await Franchise.find({
          franchiseLevel: "state",
          $or: [
            { state: { $regex: new RegExp(stateRegexStr, "i") } },
            { businessName: { $regex: new RegExp(stateRegexStr, "i") } }
          ],
          assignedTerritories: { $exists: true, $not: { $size: 0 } },
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const sf of assignedFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(sf, excludeUserId);
          if (candidateUserId) {
            stateFranchiseUserId = candidateUserId;
            break;
          }
        }
      }

      // Priority 3: Fallback only if no territory assignment existed
      if (!stateFranchiseUserId) {
        const stateFranchises = await Franchise.find({
          franchiseLevel: "state",
          $or: [
            { state: { $regex: new RegExp(stateRegexStr, "i") } },
            { businessName: { $regex: new RegExp(stateRegexStr, "i") } }
          ],
          status: { $in: ["active", "Approved", "approved", "verified"] }
        }).sort({ updatedAt: -1, createdAt: -1 });

        for (const sf of stateFranchises) {
          const candidateUserId = await this.resolveUserIdFromFranchise(sf, excludeUserId);
          if (candidateUserId) {
            stateFranchiseUserId = candidateUserId;
            break;
          }
        }
      }
    }

    // STRICT: If no active franchise exists for this territory, return null. Never use default fallback to random states.
    return { stateFranchiseUserId, districtFranchiseUserId, mandalFranchiseUserId };
  }

  /**
   * Process and disburse fee commission settlement across referral & franchise tiers.
   */
  static async processFeeCommissionSettlement(params: FeeCommissionParams): Promise<FeeCommissionResult> {
    const { sourceUserId, sourceRole, serviceKey, amount, referenceId, location, notes } = params;

    const settlements: CommissionSettlementItem[] = [];
    let totalDistributed = 0;

    if (!amount || amount <= 0) {
      return { success: true, totalDistributed: 0, companyRetainedAmount: 0, settlements: [] };
    }

    // 1. Fetch source user for referral uplines
    let sourceUser: any = null;
    if (sourceUserId) {
      sourceUser = await User.findById(sourceUserId);
    }

    // Auto-resolve missing location details from Vendor, BusinessApplication, RestaurantProfile, or User territory
    let effectiveLocation: TerritoryLocation = location ? { ...location } : {};
    let vendorDoc: any = null;
    let appDoc: any = null;
    let restDoc: any = null;

    if (sourceUserId) {
      vendorDoc = await Vendor.findOne({ $or: [{ userId: sourceUserId }, { _id: sourceUserId }] });
      if (!vendorDoc && sourceUser?.email) {
        vendorDoc = await Vendor.findOne({ email: sourceUser.email.toLowerCase().trim() });
      }

      appDoc = await BusinessApplication.findOne({
        $or: [
          { userId: sourceUserId },
          ...(sourceUser?.email ? [{ email: sourceUser.email.toLowerCase().trim() }] : []),
          ...(sourceUser?.phone ? [{ mobile: sourceUser.phone.trim() }] : [])
        ]
      }).sort({ createdAt: -1 });

      restDoc = await RestaurantProfile.findOne({
        $or: [{ userId: sourceUserId }, { _id: sourceUserId }]
      });

      effectiveLocation.state = effectiveLocation.state || vendorDoc?.state || appDoc?.state || restDoc?.state || sourceUser?.territory?.state || "";
      effectiveLocation.district = effectiveLocation.district || vendorDoc?.district || appDoc?.district || restDoc?.district || restDoc?.city || sourceUser?.territory?.district || "";
      effectiveLocation.mandal = effectiveLocation.mandal || vendorDoc?.mandal || appDoc?.mandal || restDoc?.mandal || restDoc?.locality || sourceUser?.territory?.mandal || "";
    }

    // 2. Resolve territory franchisers
    const franchisers = await this.resolveTerritoryFranchisers(effectiveLocation, sourceUserId);

    // Fallback: If any territory franchiser was not resolved by territory lookup,
    // check direct assignedFranchise links on User, Vendor, or BusinessApplication!
    if (!franchisers.mandalFranchiseUserId) {
      const directMandal = sourceUser?.assignedFranchise?.mandalFranchiseId || vendorDoc?.mandalFranchiseId || appDoc?.assignedFranchise?.mandalFranchiseId;
      if (directMandal) {
        franchisers.mandalFranchiseUserId = await this.resolveUserIdFromFranchise(directMandal, sourceUserId);
      }
    }

    if (!franchisers.districtFranchiseUserId) {
      const directDist = sourceUser?.assignedFranchise?.districtFranchiseId || vendorDoc?.districtFranchiseId || appDoc?.assignedFranchise?.districtFranchiseId;
      if (directDist) {
        franchisers.districtFranchiseUserId = await this.resolveUserIdFromFranchise(directDist, sourceUserId);
      }
    }

    if (!franchisers.stateFranchiseUserId) {
      const directState = sourceUser?.assignedFranchise?.stateFranchiseId || vendorDoc?.stateFranchiseId || appDoc?.assignedFranchise?.stateFranchiseId;
      if (directState) {
        franchisers.stateFranchiseUserId = await this.resolveUserIdFromFranchise(directState, sourceUserId);
      }
    }

    // 3. Define percentage rules according to serviceKey / role
    // Defaults: L1: 10%, L2: 3%, L3: 2%, Mandal: 10%, District: 5%, State: 3%
    const isMandalAssign = serviceKey?.includes("mandal_franchise");
    const isDistAssign = serviceKey?.includes("district_franchise");
    const isStateAssign = serviceKey?.includes("state_franchise");

    const shares: Array<{ tier: string; role: string; recipientId: any; percent: number }> = [];

    // Referral uplines
    let l1Id = sourceUser?.referralHierarchy?.level1UserId || sourceUser?.referredBy;
    let l2Id = sourceUser?.referralHierarchy?.level2UserId;
    let l3Id = sourceUser?.referralHierarchy?.level3UserId;

    if (!l1Id && sourceUser?.referredByCode) {
      const directRef = await User.findOne({ referralCode: sourceUser.referredByCode });
      if (directRef) l1Id = directRef._id;
    }

    if (l1Id && (!l2Id || !l3Id)) {
      const u1 = await User.findById(l1Id);
      if (u1?.referredBy) {
        l2Id = l2Id || u1.referredBy;
        const u2 = await User.findById(l2Id);
        if (u2?.referredBy) {
          l3Id = l3Id || u2.referredBy;
        }
      }
    }

    if (l1Id) shares.push({ tier: "level1", role: "referrer", recipientId: l1Id, percent: 10 });
    if (l2Id) shares.push({ tier: "level2", role: "referrer", recipientId: l2Id, percent: 3 });
    if (l3Id) shares.push({ tier: "level3", role: "referrer", recipientId: l3Id, percent: 2 });

    // Franchise network shares
    if (!isMandalAssign && !isDistAssign && !isStateAssign) {
      // Vendor or standard partner enrollment
      if (franchisers.mandalFranchiseUserId) {
        shares.push({ tier: "mandal", role: "mandal_franchise", recipientId: franchisers.mandalFranchiseUserId, percent: 10 });
      }
      if (franchisers.districtFranchiseUserId) {
        shares.push({ tier: "district", role: "district_franchise", recipientId: franchisers.districtFranchiseUserId, percent: 5 });
      }
      if (franchisers.stateFranchiseUserId) {
        shares.push({ tier: "state", role: "state_franchise", recipientId: franchisers.stateFranchiseUserId, percent: 3 });
      }
    } else if (isMandalAssign) {
      // Mandal license assignment: District gets 10%, State gets 5%
      if (franchisers.districtFranchiseUserId) {
        shares.push({ tier: "district", role: "district_franchise", recipientId: franchisers.districtFranchiseUserId, percent: 10 });
      }
      if (franchisers.stateFranchiseUserId) {
        shares.push({ tier: "state", role: "state_franchise", recipientId: franchisers.stateFranchiseUserId, percent: 5 });
      }
    } else if (isDistAssign) {
      // District license assignment: State gets 10%
      if (franchisers.stateFranchiseUserId) {
        shares.push({ tier: "state", role: "state_franchise", recipientId: franchisers.stateFranchiseUserId, percent: 10 });
      }
    }

    // 4. Disburse credits and create settlement logs
    for (const share of shares) {
      const shareAmount = Math.round((amount * share.percent) / 100);
      if (shareAmount > 0 && share.recipientId) {
        try {
          const creditWallet = await WalletEngine.credit(share.recipientId, shareAmount, {
            category: "Commission",
            source: `${share.tier}_commission`,
            remarks: notes || `Fee Commission for ${serviceKey || 'enrollment'} (${share.tier})`,
            referenceId: referenceId || new mongoose.Types.ObjectId(),
            referenceType: "SYSTEM"
          });

          const lastLedger = creditWallet?.ledgerEntries?.[creditWallet.ledgerEntries.length - 1];
          const txId = lastLedger?.transactionId;

          await CommissionSettlement.create({
            recipientId: share.recipientId,
            amount: shareAmount,
            settlementType: share.role,
            status: "released",
            releaseDate: new Date(),
            released: true,
            walletCredited: true,
            releasedAt: new Date(),
            releasedTransactionId: txId,
            referenceId: referenceId,
            notes: notes || `Fee commission (${share.tier}) for ${serviceKey}`
          });

          settlements.push({
            userId: share.recipientId,
            role: share.role,
            tier: share.tier,
            percentage: share.percent,
            amount: shareAmount,
            status: "completed"
          });

          totalDistributed += shareAmount;
        } catch (creditErr: any) {
          if (!creditErr.message?.includes("E11000")) {
            console.warn(`[AssignmentCommissionService] Failed to credit ${share.tier} commission:`, creditErr.message);
          }
        }
      }
    }

    // 5. Credit remainder (retained pool) to ApexBee Company System Wallet
    const companyRetainedAmount = Math.max(0, amount - totalDistributed);

    if (companyRetainedAmount > 0) {
      try {
        await WalletEngine.credit(SettlementEngine.COMPANY_ID, companyRetainedAmount, {
          category: "Commission",
          source: "company_platform_pool",
          remarks: notes || `Platform retained fee for ${serviceKey || 'enrollment'}`,
          referenceId: referenceId || new mongoose.Types.ObjectId(),
          referenceType: "SYSTEM"
        });

        await CommissionSettlement.create({
          recipientId: SettlementEngine.COMPANY_ID,
          amount: companyRetainedAmount,
          settlementType: "company",
          status: "released",
          releaseDate: new Date(),
          released: true,
          walletCredited: true,
          releasedAt: new Date(),
          notes: notes || `Platform retained pool for ${serviceKey || 'enrollment'}`
        });

        settlements.push({
          userId: SettlementEngine.COMPANY_ID,
          role: "company",
          tier: "company",
          percentage: amount > 0 ? Math.round((companyRetainedAmount / amount) * 100) : 100,
          amount: companyRetainedAmount,
          status: "completed"
        });

        console.log(`[AssignmentCommissionService] Credited ApexBee Company System Wallet: ₹${companyRetainedAmount} for ${serviceKey || 'fee'}`);
      } catch (companyErr: any) {
        if (!companyErr.message?.includes("E11000")) {
          console.warn(`[AssignmentCommissionService] Failed to credit company retained fee:`, companyErr.message);
        }
      }
    }

    return {
      success: true,
      totalDistributed,
      companyRetainedAmount,
      settlements
    };
  }

  /**
   * Synchronize and backfill missing company fee credits for any paid invoices or franchise payments.
   */
  static async syncPendingCompanyFeeCredits(): Promise<any> {
    const results: any = { invoicesProcessed: 0, companyCreditedAmount: 0, details: [] };
    try {
      // 1. Fee Invoices: Credit company wallet for paid invoices where company settlement is missing
      const paidInvoices = await FeeInvoice.find({ status: "paid" });
      for (const inv of paidInvoices) {
        const details = inv.commissionSettlementDetails || [];
        const hasCompanySettlement = details.some(
          (d) => d.tier === "company" || d.recipientRole === "company" || (d.recipientId && d.recipientId.toString() === SettlementEngine.COMPANY_ID.toString())
        );

        if (!hasCompanySettlement) {
          const distributed = details.reduce((sum, d) => sum + (d.amount || 0), 0);
          const retained = Math.max(0, (inv.baseAmount || inv.totalAmount || 0) - distributed);

          if (retained > 0) {
            const safeInvNum = (inv.invoiceNumber || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const existingSettlement = await CommissionSettlement.findOne({
              notes: new RegExp(safeInvNum, "i"),
              recipientId: SettlementEngine.COMPANY_ID
            });

            if (!existingSettlement) {
              await WalletEngine.credit(SettlementEngine.COMPANY_ID, retained, {
                category: "Commission",
                source: "company_platform_pool",
                remarks: `Platform retained fee for ${inv.title} (${inv.invoiceNumber})`,
                referenceId: inv._id,
                referenceType: "SYSTEM"
              });

              await CommissionSettlement.create({
                recipientId: SettlementEngine.COMPANY_ID,
                amount: retained,
                settlementType: "company",
                status: "released",
                releaseDate: new Date(),
                released: true,
                walletCredited: true,
                releasedAt: new Date(),
                notes: `Platform retained pool for ${inv.title} (${inv.invoiceNumber})`
              });
            }

            const updatedDetails = [
              ...details,
              {
                recipientId: SettlementEngine.COMPANY_ID,
                recipientRole: "company",
                tier: "company",
                percentage: inv.baseAmount > 0 ? Math.round((retained / inv.baseAmount) * 100) : 100,
                amount: retained,
                status: "completed"
              }
            ];

            await FeeInvoice.findByIdAndUpdate(inv._id, {
              $set: {
                commissionSettlementDetails: updatedDetails,
                commissionSettled: true
              }
            });

            results.invoicesProcessed++;
            results.companyCreditedAmount += retained;
            results.details.push({
              invoiceNumber: inv.invoiceNumber,
              retainedAmount: retained
            });

            console.log(`[AssignmentCommissionService] Successfully synced company retained fee of ₹${retained} for invoice ${inv.invoiceNumber}`);
          }
        }
      }
      return results;
    } catch (err: any) {
      console.error("[AssignmentCommissionService] syncPendingCompanyFeeCredits error:", err.message);
      results.error = err.message;
      return results;
    }
  }
}

export default AssignmentCommissionService;
