"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSubscriptionService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SubscriptionProduct_1 = require("../models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../models/SubscriptionPrice");
const SubscriptionVendorPricing_1 = require("../models/SubscriptionVendorPricing");
const SubscriptionOverride_1 = require("../models/SubscriptionOverride");
const SubscriptionAuditLog_1 = require("../models/SubscriptionAuditLog");
const SubscriptionLifecycleService_1 = require("./SubscriptionLifecycleService");
class AdminSubscriptionService {
    /**
     * Log administrative audit action
     */
    static async logAudit(action, targetType, targetId, vendorId, reason, performedByUserId, previousValue = {}, newValue = {}) {
        await SubscriptionAuditLog_1.SubscriptionAuditLog.create({
            action,
            targetType,
            targetId: targetId ? new mongoose_1.default.Types.ObjectId(targetId) : undefined,
            vendorId: vendorId ? new mongoose_1.default.Types.ObjectId(vendorId) : undefined,
            reason,
            performedBy: new mongoose_1.default.Types.ObjectId(performedByUserId),
            previousValue,
            newValue
        });
    }
    /**
     * Create or update Subscription Product (Plan / Addon)
     */
    static async upsertProduct(data, adminUserId) {
        let product;
        if (data._id || data.id) {
            const pId = data._id || data.id;
            const prev = await SubscriptionProduct_1.SubscriptionProduct.findById(pId);
            product = await SubscriptionProduct_1.SubscriptionProduct.findByIdAndUpdate(pId, data, { new: true });
            await this.logAudit('UPDATE_PRODUCT', 'PLAN', pId, undefined, 'Admin updated product', adminUserId, prev, product);
        }
        else {
            product = await SubscriptionProduct_1.SubscriptionProduct.create(data);
            await this.logAudit('CREATE_PRODUCT', 'PLAN', product._id.toString(), undefined, 'Admin created product', adminUserId, {}, product);
        }
        return product;
    }
    /**
     * Create new price version for product
     */
    static async addPriceVersion(productId, priceData, adminUserId) {
        const pId = new mongoose_1.default.Types.ObjectId(productId);
        // Increment version
        const latest = await SubscriptionPrice_1.SubscriptionPrice.findOne({ productId: pId, billingCycle: priceData.billingCycle }).sort({ version: -1 });
        const version = latest ? latest.version + 1 : 1;
        const newPrice = await SubscriptionPrice_1.SubscriptionPrice.create({
            ...priceData,
            productId: pId,
            version,
            isActive: true
        });
        await this.logAudit('ADD_PRICE_VERSION', 'PRICE', newPrice._id.toString(), undefined, 'New price version created', adminUserId, {}, newPrice);
        return newPrice;
    }
    /**
     * Assign plan manually to vendor with reason log
     */
    static async assignVendorPlan(vendorId, productId, priceId, reason, adminUserId) {
        const sub = await SubscriptionLifecycleService_1.SubscriptionLifecycleService.activateSubscription(vendorId, productId, priceId, undefined, adminUserId);
        await this.logAudit('MANUAL_VENDOR_ASSIGNMENT', 'ASSIGNMENT', sub._id.toString(), vendorId, reason, adminUserId, {}, sub);
        return sub;
    }
    /**
     * Create Vendor Pricing Override
     */
    static async setVendorPricingOverride(vendorId, productId, overridePrice, reason, adminUserId, validTill) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const pId = new mongoose_1.default.Types.ObjectId(productId);
        const price = await SubscriptionPrice_1.SubscriptionPrice.findOne({ productId: pId, isActive: true }).sort({ version: -1 });
        const originalPrice = price ? price.originalAmount : overridePrice;
        // Deactivate previous overrides
        await SubscriptionVendorPricing_1.SubscriptionVendorPricing.updateMany({ vendorId: vId, productId: pId, status: 'ACTIVE' }, { status: 'INACTIVE' });
        const vendorPricing = await SubscriptionVendorPricing_1.SubscriptionVendorPricing.create({
            vendorId: vId,
            productId: pId,
            originalPrice,
            overridePrice,
            finalPrice: overridePrice,
            reason,
            approvedBy: new mongoose_1.default.Types.ObjectId(adminUserId),
            validFrom: new Date(),
            validTill,
            status: 'ACTIVE'
        });
        await this.logAudit('SET_VENDOR_PRICING', 'VENDOR_PRICING', vendorPricing._id.toString(), vendorId, reason, adminUserId, {}, vendorPricing);
        return vendorPricing;
    }
    /**
     * Individual feature limit override per vendor
     */
    static async setFeatureOverride(vendorId, featureKey, enabled, limitValue, reason, adminUserId, expiresAt) {
        const vId = new mongoose_1.default.Types.ObjectId(vendorId);
        const uppercaseKey = featureKey.toUpperCase();
        const override = await SubscriptionOverride_1.SubscriptionOverride.create({
            vendorId: vId,
            featureKey: uppercaseKey,
            enabled,
            limitValue,
            action: enabled ? 'ENABLE' : 'DISABLE',
            startsAt: new Date(),
            expiresAt,
            reason,
            createdBy: new mongoose_1.default.Types.ObjectId(adminUserId)
        });
        await this.logAudit('SET_FEATURE_OVERRIDE', 'OVERRIDE', override._id.toString(), vendorId, reason, adminUserId, {}, override);
        return override;
    }
}
exports.AdminSubscriptionService = AdminSubscriptionService;
