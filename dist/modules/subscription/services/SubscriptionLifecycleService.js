"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionLifecycleService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const VendorSubscription_1 = require("../models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../models/VendorSubscriptionItem");
const SubscriptionProduct_1 = require("../models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../models/SubscriptionPrice");
const SubscriptionPlanProfile_1 = require("../models/SubscriptionPlanProfile");
const SubscriptionProfilePrice_1 = require("../models/SubscriptionProfilePrice");
const SubscriptionEvent_1 = require("../models/SubscriptionEvent");
const Vendor_1 = require("../../../models/Vendor");
class SubscriptionLifecycleService {
    /**
     * Activates or renews a primary plan subscription for a vendor
     */
    static async activateSubscription(vendorId, productId, priceId, orderId, performedByUserId) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const vendor = await Vendor_1.Vendor.findById(vId);
        if (!vendor)
            throw new Error('Vendor not found');
        let pId;
        let prId;
        // Resolve Product or Plan Profile ID safely
        if (productId && mongoose_1.default.Types.ObjectId.isValid(productId)) {
            pId = new mongoose_1.default.Types.ObjectId(productId);
        }
        else {
            const storeCategory = (vendor.storeType || 'FOOD_AND_DINING').toUpperCase();
            const matchedProfile = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({
                $or: [{ categoryCode: storeCategory }, { category: storeCategory }],
                tierCode: 'APEXBEE_BUSINESS',
                status: 'ACTIVE'
            })
                || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS', status: 'ACTIVE' })
                || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
            if (!matchedProfile)
                throw new Error('No active subscription plan profile available');
            pId = matchedProfile._id;
        }
        // Resolve Price ID safely
        if (priceId && mongoose_1.default.Types.ObjectId.isValid(priceId)) {
            prId = new mongoose_1.default.Types.ObjectId(priceId);
        }
        else {
            const foundPrice = await SubscriptionPrice_1.SubscriptionPrice.findOne({ productId: pId, isActive: true })
                || await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: pId, isActive: true });
            if (foundPrice) {
                prId = foundPrice._id;
            }
            else {
                prId = new mongoose_1.default.Types.ObjectId();
            }
        }
        let sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId });
        const now = new Date();
        let durationMs = 365 * 24 * 60 * 60 * 1000; // default 1 year
        const product = await SubscriptionProduct_1.SubscriptionProduct.findById(pId);
        if (product && product.status === 'ACTIVE') {
            const price = await SubscriptionPrice_1.SubscriptionPrice.findById(prId);
            if (price) {
                if (price.durationUnit === 'DAY')
                    durationMs = price.durationValue * 24 * 60 * 60 * 1000;
                else if (price.durationUnit === 'MONTH')
                    durationMs = price.durationValue * 30 * 24 * 60 * 60 * 1000;
                else if (price.durationUnit === 'YEAR')
                    durationMs = price.durationValue * 365 * 24 * 60 * 60 * 1000;
            }
        }
        else {
            const profile = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findById(pId) || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
            if (profile) {
                const profilePrice = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findById(prId) || await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: profile._id });
                if (profilePrice && profilePrice.billingCycle === 'MONTHLY') {
                    durationMs = 30 * 24 * 60 * 60 * 1000;
                }
                else {
                    durationMs = 365 * 24 * 60 * 60 * 1000;
                }
            }
        }
        const periodStart = now;
        const periodEnd = new Date(now.getTime() + durationMs);
        const previousState = sub ? sub.toObject() : {};
        if (!sub) {
            sub = new VendorSubscription_1.VendorSubscription({
                vendorId: vId,
                vendorType: vendor.storeType || 'restaurant',
                primaryProductId: pId,
                primaryPriceId: prId,
                status: 'ACTIVE',
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                autoRenew: true
            });
        }
        else {
            sub.primaryProductId = pId;
            sub.primaryPriceId = prId;
            sub.status = 'ACTIVE';
            sub.currentPeriodStart = periodStart;
            sub.currentPeriodEnd = periodEnd;
            sub.gracePeriodEndsAt = undefined;
            sub.cancelledAt = undefined;
            sub.pausedAt = undefined;
        }
        await sub.save();
        // Upsert primary subscription line item
        await VendorSubscriptionItem_1.VendorSubscriptionItem.findOneAndUpdate({
            subscriptionId: sub._id,
            productType: 'PLAN'
        }, {
            vendorId: vId,
            productId: pId,
            priceId: prId,
            productType: 'PLAN',
            quantity: 1,
            status: 'ACTIVE',
            startDate: periodStart,
            expiryDate: periodEnd,
            autoRenew: sub.autoRenew
        }, { upsert: true, new: true });
        // Record Event Audit
        await SubscriptionEvent_1.SubscriptionEvent.create({
            vendorId: vId,
            subscriptionId: sub._id,
            eventType: previousState.status ? 'RENEWED' : 'ACTIVATED',
            previousState,
            newState: sub.toObject(),
            performedByType: performedByUserId ? 'ADMIN' : 'SYSTEM',
            performedBy: performedByUserId ? new mongoose_1.default.Types.ObjectId(performedByUserId) : undefined,
            metadata: { orderId }
        });
        return sub;
    }
    /**
     * Activates or adds an Add-on item for a vendor
     */
    static async activateAddon(vendorId, addonProductId, priceId, quantity = 1) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const pId = new mongoose_1.default.Types.ObjectId(addonProductId);
        const prId = new mongoose_1.default.Types.ObjectId(priceId);
        const sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId });
        if (!sub)
            throw new Error('Active subscription required before purchasing add-on');
        const price = await SubscriptionPrice_1.SubscriptionPrice.findById(prId);
        if (!price)
            throw new Error('Invalid add-on price');
        const now = new Date();
        let durationMs = 30 * 24 * 60 * 60 * 1000;
        if (price.durationUnit === 'DAY')
            durationMs = price.durationValue * 24 * 60 * 60 * 1000;
        if (price.durationUnit === 'MONTH')
            durationMs = price.durationValue * 30 * 24 * 60 * 60 * 1000;
        if (price.durationUnit === 'YEAR')
            durationMs = price.durationValue * 365 * 24 * 60 * 60 * 1000;
        const expiryDate = new Date(now.getTime() + durationMs);
        const item = await VendorSubscriptionItem_1.VendorSubscriptionItem.create({
            subscriptionId: sub._id,
            vendorId: vId,
            productId: pId,
            priceId: prId,
            productType: 'ADDON',
            quantity,
            status: 'ACTIVE',
            startDate: now,
            expiryDate,
            autoRenew: true
        });
        return item;
    }
    /**
     * Calculates upgrade proration credit for moving from current plan to upgraded plan
     */
    static async calculateUpgradeProration(vendorId) {
        const sub = await VendorSubscription_1.VendorSubscription.findOne({
            vendorId: new mongoose_1.default.Types.ObjectId(vendorId),
            status: 'ACTIVE'
        });
        if (!sub || !sub.currentPeriodEnd || !sub.currentPeriodStart || !sub.primaryPriceId) {
            return 0;
        }
        const now = new Date();
        if (sub.currentPeriodEnd <= now)
            return 0;
        const currentPrice = await SubscriptionPrice_1.SubscriptionPrice.findById(sub.primaryPriceId);
        if (!currentPrice)
            return 0;
        const totalDays = Math.max(1, Math.ceil((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)));
        const remainingDays = Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const remainingValue = Math.round((currentPrice.originalAmount * remainingDays) / totalDays);
        return remainingValue;
    }
    /**
     * Pauses a subscription (freezing remaining validity days)
     */
    static async pauseSubscription(vendorId, reason, adminUserId) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId, status: 'ACTIVE' });
        if (!sub)
            throw new Error('Active subscription not found to pause');
        const now = new Date();
        const remainingDays = sub.currentPeriodEnd
            ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
        const prev = sub.toObject();
        sub.status = 'PAUSED';
        sub.pausedAt = now;
        sub.pauseReason = reason;
        sub.remainingDaysAtPause = remainingDays;
        await sub.save();
        await SubscriptionEvent_1.SubscriptionEvent.create({
            vendorId: vId,
            subscriptionId: sub._id,
            eventType: 'PAUSED',
            previousState: prev,
            newState: sub.toObject(),
            performedByType: adminUserId ? 'ADMIN' : 'VENDOR',
            performedBy: adminUserId ? new mongoose_1.default.Types.ObjectId(adminUserId) : undefined,
            metadata: { reason }
        });
        return sub;
    }
    /**
     * Resumes a paused subscription and recalculates expiry date
     */
    static async resumeSubscription(vendorId, adminUserId) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vId, status: 'PAUSED' });
        if (!sub)
            throw new Error('Paused subscription not found to resume');
        const now = new Date();
        const addMs = (sub.remainingDaysAtPause || 0) * 24 * 60 * 60 * 1000;
        const prev = sub.toObject();
        sub.status = 'ACTIVE';
        sub.currentPeriodStart = now;
        sub.currentPeriodEnd = new Date(now.getTime() + addMs);
        sub.pausedAt = undefined;
        sub.pauseReason = undefined;
        sub.remainingDaysAtPause = 0;
        await sub.save();
        await SubscriptionEvent_1.SubscriptionEvent.create({
            vendorId: vId,
            subscriptionId: sub._id,
            eventType: 'RESUMED',
            previousState: prev,
            newState: sub.toObject(),
            performedByType: adminUserId ? 'ADMIN' : 'VENDOR',
            performedBy: adminUserId ? new mongoose_1.default.Types.ObjectId(adminUserId) : undefined
        });
        return sub;
    }
}
exports.SubscriptionLifecycleService = SubscriptionLifecycleService;
