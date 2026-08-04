"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntitlementService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Vendor_1 = require("../../../models/Vendor");
const VendorSubscription_1 = require("../models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../models/VendorSubscriptionItem");
const SubscriptionProductFeature_1 = require("../models/SubscriptionProductFeature");
const SubscriptionProfileFeature_1 = require("../models/SubscriptionProfileFeature");
const SubscriptionFeature_1 = require("../models/SubscriptionFeature");
const SubscriptionOverride_1 = require("../models/SubscriptionOverride");
const SubscriptionUsage_1 = require("../models/SubscriptionUsage");
class EntitlementService {
    /**
     * Resolves exact entitlement state for a specific feature key for a vendor
     */
    static async getFeatureEntitlement(vendorId, featureKey) {
        const uppercaseKey = featureKey.toUpperCase();
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        // 1. Check Vendor status & suspension
        const vendor = await Vendor_1.Vendor.findById(vId);
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
        const sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId });
        const now = new Date();
        const regDate = vendor.createdAt ? new Date(vendor.createdAt) : now;
        const trialEnd = sub?.trialEnd || new Date(regDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        const isSubActive = sub && (sub.status === 'ACTIVE' ||
            sub.status === 'GRACE_PERIOD' ||
            (sub.status === 'TRIAL' && now <= trialEnd));
        // Fetch Master Feature Definition
        const masterFeature = await SubscriptionFeature_1.SubscriptionFeature.findOne({ key: uppercaseKey });
        if (!masterFeature || masterFeature.status !== 'ACTIVE') {
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
        const override = await SubscriptionOverride_1.SubscriptionOverride.findOne({
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
        const activeAddons = await VendorSubscriptionItem_1.VendorSubscriptionItem.find({
            vendorId: vId,
            productType: 'ADDON',
            status: 'ACTIVE',
            expiryDate: { $gte: new Date() }
        });
        let addonLimit = null;
        let addonEnabled = false;
        if (activeAddons.length > 0) {
            const addonProductIds = activeAddons.map(a => a.productId);
            const addonFeatures = await SubscriptionProductFeature_1.SubscriptionProductFeature.find({
                productId: { $in: addonProductIds },
                featureId: masterFeature._id,
                enabled: true
            });
            for (const af of addonFeatures) {
                addonEnabled = true;
                if (af.limitValue === null) {
                    addonLimit = null; // Unlimited overrides
                    break;
                }
                else if (addonLimit !== null && af.limitValue) {
                    addonLimit += af.limitValue;
                }
                else if (af.limitValue) {
                    addonLimit = af.limitValue;
                }
            }
        }
        // 5. Check Primary Base Plan Features
        let planEnabled = false;
        let planLimit = 0;
        if (sub?.primaryProductId) {
            const planFeature = await SubscriptionProductFeature_1.SubscriptionProductFeature.findOne({
                productId: sub.primaryProductId,
                featureId: masterFeature._id
            }) || await SubscriptionProfileFeature_1.SubscriptionProfileFeature.findOne({
                profileId: sub.primaryProductId,
                $or: [{ featureId: masterFeature._id }, { featureKey: uppercaseKey }]
            });
            if (planFeature) {
                planEnabled = planFeature.enabled;
                planLimit = planFeature.limitValue !== undefined ? planFeature.limitValue : null;
            }
        }
        const finalEnabled = addonEnabled || planEnabled;
        let finalLimit = 0;
        if (addonEnabled && planEnabled) {
            if (addonLimit === null || planLimit === null) {
                finalLimit = null;
            }
            else {
                finalLimit = (planLimit || 0) + (addonLimit || 0);
            }
        }
        else if (addonEnabled) {
            finalLimit = addonLimit;
        }
        else if (planEnabled) {
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
    static async hasFeature(vendorId, featureKey) {
        const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
        return entitlement.enabled;
    }
    static async getFeatureLimit(vendorId, featureKey) {
        const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
        return entitlement.limit;
    }
    static async getFeatureUsage(vendorId, featureKey) {
        const uppercaseKey = featureKey.toUpperCase();
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const now = new Date();
        const activeUsage = await SubscriptionUsage_1.SubscriptionUsage.findOne({
            vendorId: vId,
            featureKey: uppercaseKey,
            periodStart: { $lte: now },
            periodEnd: { $gte: now }
        });
        return activeUsage ? activeUsage.used : 0;
    }
    static async getRemainingLimit(vendorId, featureKey) {
        const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
        return entitlement.remaining;
    }
    static async assertFeature(vendorId, featureKey) {
        const hasAccess = await this.hasFeature(vendorId, featureKey);
        if (!hasAccess) {
            const error = new Error(`Feature '${featureKey}' is not included in your active plan.`);
            error.code = 'FEATURE_NOT_AVAILABLE';
            error.statusCode = 403;
            error.details = { featureKey };
            throw error;
        }
    }
    static async assertWithinLimit(vendorId, featureKey, requestedAmount = 1) {
        await this.assertFeature(vendorId, featureKey);
        const entitlement = await this.getFeatureEntitlement(vendorId, featureKey);
        if (entitlement.limit !== null) {
            if (entitlement.used + requestedAmount > entitlement.limit) {
                if (entitlement.enforcementMode === 'HARD_BLOCK' || !entitlement.enforcementMode) {
                    const error = new Error(`Feature limit reached for '${featureKey}'. Used: ${entitlement.used}/${entitlement.limit}. Requested: ${requestedAmount}.`);
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
    static async consumeUsage(vendorId, featureKey, amount = 1) {
        const uppercaseKey = featureKey.toUpperCase();
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const usageRecord = await SubscriptionUsage_1.SubscriptionUsage.findOneAndUpdate({
            vendorId: vId,
            featureKey: uppercaseKey,
            periodStart: { $lte: now },
            periodEnd: { $gte: now }
        }, {
            $inc: { used: amount },
            $setOnInsert: {
                periodStart: startOfMonth,
                periodEnd: endOfMonth,
                reserved: 0
            }
        }, { new: true, upsert: true });
        return usageRecord.used;
    }
    static async releaseReservedUsage(vendorId, featureKey, amount = 1) {
        const uppercaseKey = featureKey.toUpperCase();
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const now = new Date();
        await SubscriptionUsage_1.SubscriptionUsage.updateOne({
            vendorId: vId,
            featureKey: uppercaseKey,
            periodStart: { $lte: now },
            periodEnd: { $gte: now }
        }, {
            $inc: { reserved: -amount }
        });
    }
    /**
     * Resolves full entitlement payload for vendor portal & dashboards (High-Performance Batch Parallel Resolution)
     */
    static async resolveAllEntitlements(vendorId) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const now = new Date();
        const [vendor, sub, allFeatures, overrides, activeAddons, usageRecords] = await Promise.all([
            Vendor_1.Vendor.findById(vId),
            VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId }),
            SubscriptionFeature_1.SubscriptionFeature.find({ status: 'ACTIVE' }),
            SubscriptionOverride_1.SubscriptionOverride.find({
                vendorId: vId,
                startsAt: { $lte: now },
                $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
            }),
            VendorSubscriptionItem_1.VendorSubscriptionItem.find({
                vendorId: vId,
                productType: 'ADDON',
                status: 'ACTIVE',
                expiryDate: { $gte: now }
            }),
            SubscriptionUsage_1.SubscriptionUsage.find({
                vendorId: vId,
                periodStart: { $lte: now },
                periodEnd: { $gte: now }
            })
        ]);
        const results = {};
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
        const usageMap = new Map();
        for (const u of usageRecords)
            usageMap.set(u.featureKey.toUpperCase(), u.used);
        const overrideMap = new Map();
        for (const o of overrides)
            overrideMap.set(o.featureKey.toUpperCase(), o);
        let planFeatures = [];
        if (sub?.primaryProductId) {
            planFeatures = await SubscriptionProductFeature_1.SubscriptionProductFeature.find({ productId: sub.primaryProductId })
                || [];
            if (planFeatures.length === 0) {
                planFeatures = await SubscriptionProfileFeature_1.SubscriptionProfileFeature.find({ profileId: sub.primaryProductId });
            }
        }
        const planFeatureMap = new Map();
        for (const pf of planFeatures) {
            if (pf.featureId)
                planFeatureMap.set(pf.featureId.toString(), pf);
            if (pf.featureKey)
                planFeatureMap.set(pf.featureKey.toUpperCase(), pf);
        }
        let addonFeatures = [];
        if (activeAddons.length > 0) {
            const addonProductIds = activeAddons.map(a => a.productId);
            addonFeatures = await SubscriptionProductFeature_1.SubscriptionProductFeature.find({
                productId: { $in: addonProductIds },
                enabled: true
            });
        }
        const addonFeatureMap = new Map();
        for (const af of addonFeatures) {
            const key = af.featureId ? af.featureId.toString() : af.featureKey?.toUpperCase();
            if (key) {
                if (!addonFeatureMap.has(key))
                    addonFeatureMap.set(key, []);
                addonFeatureMap.get(key).push(af);
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
            let addonLimit = null;
            for (const af of afList) {
                addonEnabled = true;
                if (af.limitValue === null) {
                    addonLimit = null;
                    break;
                }
                else if (addonLimit !== null && af.limitValue) {
                    addonLimit += af.limitValue;
                }
                else if (af.limitValue) {
                    addonLimit = af.limitValue;
                }
            }
            const pf = planFeatureMap.get(feature._id.toString()) || planFeatureMap.get(uppercaseKey);
            const planEnabled = pf ? pf.enabled : false;
            const planLimit = pf ? (pf.limitValue !== undefined ? pf.limitValue : null) : 0;
            const finalEnabled = addonEnabled || planEnabled;
            let finalLimit = 0;
            if (addonEnabled && planEnabled) {
                finalLimit = (addonLimit === null || planLimit === null) ? null : ((planLimit || 0) + (addonLimit || 0));
            }
            else if (addonEnabled) {
                finalLimit = addonLimit;
            }
            else if (planEnabled) {
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
exports.EntitlementService = EntitlementService;
