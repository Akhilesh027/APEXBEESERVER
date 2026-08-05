import mongoose from 'mongoose';
import { Vendor } from '../../../models/Vendor';
import { VendorSubscription } from '../models/VendorSubscription';
import { VendorSubscriptionItem } from '../models/VendorSubscriptionItem';
import { SubscriptionProductFeature } from '../models/SubscriptionProductFeature';
import { SubscriptionProfileFeature } from '../models/SubscriptionProfileFeature';
import { SubscriptionFeature } from '../models/SubscriptionFeature';
import { SubscriptionOverride } from '../models/SubscriptionOverride';
import { SubscriptionUsage } from '../models/SubscriptionUsage';

export interface IFeatureEntitlementResult {
  featureKey: string;
  enabled: boolean;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null;
  resetCycle?: string;
  enforcementMode?: string;
  source: 'SUSPENDED' | 'EXPIRED' | 'ADMIN_OVERRIDE' | 'VENDOR_OVERRIDE' | 'ADDON' | 'BASE_PLAN' | 'DEFAULT';
}

export class EntitlementService {
  /**
   * Resolves exact entitlement state for a specific feature key for a vendor
   */
  public static async getFeatureEntitlement(
    vendorId: string,
    featureKey: string
  ): Promise<IFeatureEntitlementResult> {
    const uppercaseKey = featureKey.toUpperCase();
    const vId = new mongoose.Types.ObjectId(vendorId);

    // 1. Check Vendor status & suspension
    const vendor = await Vendor.findById(vId);
    if (!vendor || vendor.marketplaceStatus === 'Suspended' || vendor.status === 'suspended') {
      return {
        featureKey: uppercaseKey,
        enabled: false,
        limit: 0,
        used: 0,
        remaining: 0,
        source: 'SUSPENDED'
      };
    }

    // 2. Check Subscription status
    const sub = await VendorSubscription.findOne({ vendorId: vId });
    const now = new Date();
    const regDate = vendor.createdAt ? new Date(vendor.createdAt) : now;
    const trialEnd = sub?.trialEnd || new Date(regDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    const isSubActive =
      !sub || // Default active vendors without explicit sub document get base/trial access
      sub.status === 'ACTIVE' ||
      sub.status === 'GRACE_PERIOD' ||
      (sub.status === 'TRIAL' && now <= trialEnd);

    const isCoreProductFeature = uppercaseKey === 'MAX_PRODUCTS' || uppercaseKey === 'MAX_MENU_ITEMS' || uppercaseKey === 'PRODUCT_CREATION';

    // Fetch Master Feature Definition
    const masterFeature = await SubscriptionFeature.findOne({ key: uppercaseKey });
    if (!masterFeature || masterFeature.status !== 'ACTIVE') {
      if (isCoreProductFeature && (vendor.status === 'active' || !vendor.status)) {
        return {
          featureKey: uppercaseKey,
          enabled: true,
          limit: null,
          used: await this.getFeatureUsage(vendorId, uppercaseKey),
          remaining: null,
          source: 'DEFAULT'
        };
      }
      return {
        featureKey: uppercaseKey,
        enabled: false,
        limit: 0,
        used: 0,
        remaining: 0,
        source: 'DEFAULT'
      };
    }

    // 3. Check Vendor/Admin Override
    const override = await SubscriptionOverride.findOne({
      vendorId: vId,
      featureKey: uppercaseKey,
      startsAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    }).sort({ createdAt: -1 });

    if (override) {
      const usage = await this.getFeatureUsage(vendorId, uppercaseKey);
      const limit = override.limitValue !== undefined ? override.limitValue : null;
      const remaining = limit === null ? null : Math.max(0, limit - usage);

      return {
        featureKey: uppercaseKey,
        enabled: override.enabled !== undefined ? override.enabled : true,
        limit,
        used: usage,
        remaining,
        resetCycle: masterFeature.resetCycle,
        enforcementMode: masterFeature.enforcementMode,
        source: 'VENDOR_OVERRIDE'
      };
    }

    // If subscription is not active, paid features return false / limit 0
    if (!isSubActive) {
      if (isCoreProductFeature && (vendor.status === 'active' || !vendor.status)) {
        return {
          featureKey: uppercaseKey,
          enabled: true,
          limit: 500,
          used: await this.getFeatureUsage(vendorId, uppercaseKey),
          remaining: 500,
          resetCycle: masterFeature.resetCycle,
          enforcementMode: masterFeature.enforcementMode,
          source: 'DEFAULT'
        };
      }
      return {
        featureKey: uppercaseKey,
        enabled: false,
        limit: 0,
        used: 0,
        remaining: 0,
        resetCycle: masterFeature.resetCycle,
        enforcementMode: masterFeature.enforcementMode,
        source: 'EXPIRED'
      };
    }

    // 4. Check Active Add-ons
    const activeAddons = await VendorSubscriptionItem.find({
      vendorId: vId,
      productType: 'ADDON',
      status: 'ACTIVE',
      expiryDate: { $gte: new Date() }
    });

    let addonLimit: number | null = null;
    let addonEnabled = false;

    if (activeAddons.length > 0) {
      const addonProductIds = activeAddons.map(a => a.productId);
      const addonFeatures = await SubscriptionProductFeature.find({
        productId: { $in: addonProductIds },
        featureId: masterFeature._id,
        enabled: true
      });

      for (const af of addonFeatures) {
        addonEnabled = true;
        if (af.limitValue === null) {
          addonLimit = null; // Unlimited overrides
          break;
        } else if (addonLimit !== null && af.limitValue) {
          addonLimit += af.limitValue;
        } else if (af.limitValue) {
          addonLimit = af.limitValue;
        }
      }
    }

    // 5. Check Primary Base Plan Features
    let planEnabled = false;
    let planLimit: number | null = 0;

    if (sub?.primaryProductId) {
      const planFeature: any = await SubscriptionProductFeature.findOne({
        productId: sub.primaryProductId,
        featureId: masterFeature._id
      }) || await SubscriptionProfileFeature.findOne({
        profileId: sub.primaryProductId,
        $or: [{ featureId: masterFeature._id }, { featureKey: uppercaseKey }]
      });

      if (planFeature) {
        planEnabled = planFeature.enabled;
        planLimit = planFeature.limitValue !== undefined ? planFeature.limitValue : null;
      }
    }

    const finalEnabled = addonEnabled || planEnabled;
    let finalLimit: number | null = 0;

    if (addonEnabled && planEnabled) {
      if (addonLimit === null || planLimit === null) {
        finalLimit = null;
      } else {
        finalLimit = (planLimit || 0) + (addonLimit || 0);
      }
    } else if (addonEnabled) {
      finalLimit = addonLimit;
    } else if (planEnabled) {
      finalLimit = planLimit;
    }

    const currentUsage = await this.getFeatureUsage(vendorId, uppercaseKey);
    const remaining = finalLimit === null ? null : Math.max(0, finalLimit - currentUsage);

    return {
      featureKey: uppercaseKey,
      enabled: finalEnabled,
      limit: finalLimit,
      used: currentUsage,
      remaining,
      resetCycle: masterFeature.resetCycle,
      enforcementMode: masterFeature.enforcementMode,
      source: addonEnabled ? 'ADDON' : 'BASE_PLAN'
    };
  }

  public static async hasFeature(vendorId: string, featureKey: string): Promise<boolean> {
    const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
    return entitlement.enabled;
  }

  public static async getFeatureLimit(vendorId: string, featureKey: string): Promise<number | null> {
    const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
    return entitlement.limit;
  }

  public static async getFeatureUsage(vendorId: string, featureKey: string): Promise<number> {
    const uppercaseKey = featureKey.toUpperCase();
    const vId = new mongoose.Types.ObjectId(vendorId);

    const now = new Date();
    const activeUsage = await SubscriptionUsage.findOne({
      vendorId: vId,
      featureKey: uppercaseKey,
      periodStart: { $lte: now },
      periodEnd: { $gte: now }
    });

    return activeUsage ? activeUsage.used : 0;
  }

  public static async getRemainingLimit(vendorId: string, featureKey: string): Promise<number | null> {
    const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
    return entitlement.remaining;
  }

  public static async assertFeature(vendorId: string, featureKey: string): Promise<void> {
    const hasAccess = await this.hasFeature(vendorId, featureKey);
    if (!hasAccess) {
      const error: any = new Error(`Feature '${featureKey}' is not included in your active plan.`);
      error.code = 'FEATURE_NOT_AVAILABLE';
      error.statusCode = 403;
      error.details = { featureKey };
      throw error;
    }
  }

  public static async assertWithinLimit(
    vendorId: string,
    featureKey: string,
    requestedAmount: number = 1
  ): Promise<void> {
    await this.assertFeature(vendorId, featureKey);
    const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);

    if (entitlement.limit !== null) {
      if (entitlement.used + requestedAmount > entitlement.limit) {
        if (entitlement.enforcementMode === 'HARD_BLOCK' || !entitlement.enforcementMode) {
          const error: any = new Error(
            `Feature limit reached for '${featureKey}'. Used: ${entitlement.used}/${entitlement.limit}. Requested: ${requestedAmount}.`
          );
          error.code = 'FEATURE_LIMIT_REACHED';
          error.statusCode = 403;
          error.details = {
            featureKey,
            used: entitlement.used,
            limit: entitlement.limit,
            upgradeAvailable: true
          };
          throw error;
        }
      }
    }
  }

  /**
   * Consumes usage atomically in SubscriptionUsage collection
   */
  public static async consumeUsage(
    vendorId: string,
    featureKey: string,
    amount: number = 1
  ): Promise<number> {
    const uppercaseKey = featureKey.toUpperCase();
    const vId = new mongoose.Types.ObjectId(vendorId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const usageRecord = await SubscriptionUsage.findOneAndUpdate(
      {
        vendorId: vId,
        featureKey: uppercaseKey,
        periodStart: { $lte: now },
        periodEnd: { $gte: now }
      },
      {
        $inc: { used: amount },
        $setOnInsert: {
          periodStart: startOfMonth,
          periodEnd: endOfMonth,
          reserved: 0
        }
      },
      { new: true, upsert: true }
    );

    return usageRecord.used;
  }

  public static async releaseReservedUsage(
    vendorId: string,
    featureKey: string,
    amount: number = 1
  ): Promise<void> {
    const uppercaseKey = featureKey.toUpperCase();
    const vId = new mongoose.Types.ObjectId(vendorId);

    const now = new Date();
    await SubscriptionUsage.updateOne(
      {
        vendorId: vId,
        featureKey: uppercaseKey,
        periodStart: { $lte: now },
        periodEnd: { $gte: now }
      },
      {
        $inc: { reserved: -amount }
      }
    );
  }

  /**
   * Resolves full entitlement payload for vendor portal & dashboards (High-Performance Batch Parallel Resolution)
   */
  public static async resolveAllEntitlements(vendorId: string): Promise<Record<string, IFeatureEntitlementResult>> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const now = new Date();

    const [vendor, sub, allFeatures, overrides, activeAddons, usageRecords] = await Promise.all([
      Vendor.findById(vId),
      VendorSubscription.findOne({ vendorId: vId }),
      SubscriptionFeature.find({ status: 'ACTIVE' }),
      SubscriptionOverride.find({
        vendorId: vId,
        startsAt: { $lte: now },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
      }),
      VendorSubscriptionItem.find({
        vendorId: vId,
        productType: 'ADDON',
        status: 'ACTIVE',
        expiryDate: { $gte: now }
      }),
      SubscriptionUsage.find({
        vendorId: vId,
        periodStart: { $lte: now },
        periodEnd: { $gte: now }
      })
    ]);

    const results: Record<string, IFeatureEntitlementResult> = {};
    if (!vendor || vendor.marketplaceStatus === 'Suspended' || vendor.status === 'suspended') {
      for (const feature of allFeatures) {
        results[feature.key] = {
          featureKey: feature.key,
          enabled: false,
          limit: 0,
          used: 0,
          remaining: 0,
          source: 'SUSPENDED'
        };
      }
      return results;
    }

    const regDate = vendor.createdAt ? new Date(vendor.createdAt) : now;
    const trialEnd = sub?.trialEnd || new Date(regDate.getTime() + 15 * 24 * 60 * 60 * 1000);
    const isSubActive = sub && (sub.status === 'ACTIVE' || sub.status === 'GRACE_PERIOD' || (sub.status === 'TRIAL' && now <= trialEnd));

    const usageMap = new Map<string, number>();
    for (const u of usageRecords) usageMap.set(u.featureKey.toUpperCase(), u.used);

    const overrideMap = new Map<string, any>();
    for (const o of overrides) overrideMap.set(o.featureKey.toUpperCase(), o);

    let planFeatures: any[] = [];
    if (sub?.primaryProductId) {
      planFeatures = await SubscriptionProductFeature.find({ productId: sub.primaryProductId })
        || [];
      if (planFeatures.length === 0) {
        planFeatures = await SubscriptionProfileFeature.find({ profileId: sub.primaryProductId });
      }
    }

    const planFeatureMap = new Map<string, any>();
    for (const pf of planFeatures) {
      if (pf.featureId) planFeatureMap.set(pf.featureId.toString(), pf);
      if (pf.featureKey) planFeatureMap.set(pf.featureKey.toUpperCase(), pf);
    }

    let addonFeatures: any[] = [];
    if (activeAddons.length > 0) {
      const addonProductIds = activeAddons.map(a => a.productId);
      addonFeatures = await SubscriptionProductFeature.find({
        productId: { $in: addonProductIds },
        enabled: true
      });
    }

    const addonFeatureMap = new Map<string, any[]>();
    for (const af of addonFeatures) {
      const key = af.featureId ? af.featureId.toString() : af.featureKey?.toUpperCase();
      if (key) {
        if (!addonFeatureMap.has(key)) addonFeatureMap.set(key, []);
        addonFeatureMap.get(key)!.push(af);
      }
    }

    for (const feature of allFeatures) {
      const uppercaseKey = feature.key.toUpperCase();
      const usage = usageMap.get(uppercaseKey) || 0;
      const override = overrideMap.get(uppercaseKey);

      if (override) {
        const limit = override.limitValue !== undefined ? override.limitValue : null;
        results[feature.key] = {
          featureKey: uppercaseKey,
          enabled: override.enabled !== undefined ? override.enabled : true,
          limit,
          used: usage,
          remaining: limit === null ? null : Math.max(0, limit - usage),
          resetCycle: feature.resetCycle,
          enforcementMode: feature.enforcementMode,
          source: 'VENDOR_OVERRIDE'
        };
        continue;
      }

      if (!isSubActive) {
        results[feature.key] = {
          featureKey: uppercaseKey,
          enabled: false,
          limit: 0,
          used: 0,
          remaining: 0,
          resetCycle: feature.resetCycle,
          enforcementMode: feature.enforcementMode,
          source: 'EXPIRED'
        };
        continue;
      }

      const afList = addonFeatureMap.get(feature._id.toString()) || addonFeatureMap.get(uppercaseKey) || [];
      let addonEnabled = false;
      let addonLimit: number | null = null;
      for (const af of afList) {
        addonEnabled = true;
        if (af.limitValue === null) {
          addonLimit = null;
          break;
        } else if (addonLimit !== null && af.limitValue) {
          addonLimit += af.limitValue;
        } else if (af.limitValue) {
          addonLimit = af.limitValue;
        }
      }

      const pf = planFeatureMap.get(feature._id.toString()) || planFeatureMap.get(uppercaseKey);
      const planEnabled = pf ? pf.enabled : false;
      const planLimit: number | null = pf ? (pf.limitValue !== undefined ? pf.limitValue : null) : 0;

      const finalEnabled = addonEnabled || planEnabled;
      let finalLimit: number | null = 0;

      if (addonEnabled && planEnabled) {
        finalLimit = (addonLimit === null || planLimit === null) ? null : ((planLimit || 0) + (addonLimit || 0));
      } else if (addonEnabled) {
        finalLimit = addonLimit;
      } else if (planEnabled) {
        finalLimit = planLimit;
      }

      results[feature.key] = {
        featureKey: uppercaseKey,
        enabled: finalEnabled,
        limit: finalLimit,
        used: usage,
        remaining: finalLimit === null ? null : Math.max(0, finalLimit - usage),
        resetCycle: feature.resetCycle,
        enforcementMode: feature.enforcementMode,
        source: addonEnabled ? 'ADDON' : 'BASE_PLAN'
      };
    }

    return results;
  }
}
