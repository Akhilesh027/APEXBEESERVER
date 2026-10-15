import mongoose from "mongoose";
import { User } from "../models/User";
import { Franchise } from "../models/Franchise";
import { WalletEngine } from "./WalletEngine";
import { CommissionSettlement } from "../models/CommissionSettlement";
import { SettlementEngine } from "./SettlementEngine";
import { FeeInvoice } from "../models/FeeInvoice";

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
   * Resolve territory franchise users for state, district, and mandal.
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

    // 1. Mandal Franchiser
    if (mandal) {
      const mandalFranchise = await Franchise.findOne({
        franchiseLevel: "mandal",
        mandal: { $regex: new RegExp(`^${mandal}$`, "i") },
        status: { $in: ["active", "Approved", "approved", "verified"] }
      });
      if (mandalFranchise && mandalFranchise.userId) {
        if (!excludeUserId || mandalFranchise.userId.toString() !== excludeUserId.toString()) {
          mandalFranchiseUserId = mandalFranchise.userId as any;
        }
      } else {
        const mandalUser = await User.findOne({
          roles: { $in: ["mandal_franchise", "franchise"] },
          "territory.mandal": { $regex: new RegExp(`^${mandal}$`, "i") }
        });
        if (mandalUser && (!excludeUserId || mandalUser._id.toString() !== excludeUserId.toString())) {
          mandalFranchiseUserId = mandalUser._id as any;
        }
      }
    }

    // 2. District Franchiser
    if (district) {
      const distFranchise = await Franchise.findOne({
        franchiseLevel: "district",
        district: { $regex: new RegExp(`^${district}$`, "i") },
        status: { $in: ["active", "Approved", "approved", "verified"] }
      });
      if (distFranchise && distFranchise.userId) {
        if (!excludeUserId || distFranchise.userId.toString() !== excludeUserId.toString()) {
          districtFranchiseUserId = distFranchise.userId as any;
        }
      } else {
        const distUser = await User.findOne({
          roles: { $in: ["district_franchise", "franchise"] },
          "territory.district": { $regex: new RegExp(`^${district}$`, "i") }
        });
        if (distUser && (!excludeUserId || distUser._id.toString() !== excludeUserId.toString())) {
          districtFranchiseUserId = distUser._id as any;
        }
      }
    }

    // 3. State Franchiser
    if (state) {
      const stateFranchise = await Franchise.findOne({
        franchiseLevel: "state",
        state: { $regex: new RegExp(`^${state}$`, "i") },
        status: { $in: ["active", "Approved", "approved", "verified"] }
      });
      if (stateFranchise && stateFranchise.userId) {
        if (!excludeUserId || stateFranchise.userId.toString() !== excludeUserId.toString()) {
          stateFranchiseUserId = stateFranchise.userId as any;
        }
      } else {
        const stateUser = await User.findOne({
          roles: { $in: ["state_franchise", "franchise"] },
          "territory.state": { $regex: new RegExp(`^${state}$`, "i") }
        });
        if (stateUser && (!excludeUserId || stateUser._id.toString() !== excludeUserId.toString())) {
          stateFranchiseUserId = stateUser._id as any;
        }
      }
    }

    // Fallback: If not resolved by exact state, find any active state franchise
    if (!stateFranchiseUserId) {
      const anyState = await Franchise.findOne({ franchiseLevel: "state", status: { $in: ["active", "Approved", "approved", "verified"] } });
      if (anyState && anyState.userId && (!excludeUserId || anyState.userId.toString() !== excludeUserId.toString())) {
        stateFranchiseUserId = anyState.userId as any;
      }
    }

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

    // 2. Resolve territory franchisers
    const franchisers = await this.resolveTerritoryFranchisers(location, sourceUserId);

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
          await WalletEngine.credit(share.recipientId, shareAmount, {
            category: "Commission",
            source: `${share.tier}_commission`,
            remarks: notes || `Fee Commission for ${serviceKey || 'enrollment'} (${share.tier})`,
            referenceId: referenceId || new mongoose.Types.ObjectId(),
            referenceType: "SYSTEM"
          });

          await CommissionSettlement.create({
            recipientId: share.recipientId,
            amount: shareAmount,
            settlementType: share.role,
            status: "released",
            releaseDate: new Date(),
            released: true,
            walletCredited: true,
            releasedAt: new Date(),
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
