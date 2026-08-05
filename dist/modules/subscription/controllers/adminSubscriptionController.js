"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSubscriptionController = void 0;
const SubscriptionProduct_1 = require("../models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../models/SubscriptionPrice");
const SubscriptionFeature_1 = require("../models/SubscriptionFeature");
const SubscriptionProductFeature_1 = require("../models/SubscriptionProductFeature");
const SubscriptionProfileFeature_1 = require("../models/SubscriptionProfileFeature");
const SubscriptionPlanProfile_1 = require("../models/SubscriptionPlanProfile");
const SubscriptionProfilePrice_1 = require("../models/SubscriptionProfilePrice");
const SubscriptionDiscount_1 = require("../models/SubscriptionDiscount");
const SubscriptionVendorPricing_1 = require("../models/SubscriptionVendorPricing");
const SubscriptionVendorAgreement_1 = require("../models/SubscriptionVendorAgreement");
const SubscriptionVendorTypeOverride_1 = require("../models/SubscriptionVendorTypeOverride");
const SubscriptionCustomerTypePricing_1 = require("../models/SubscriptionCustomerTypePricing");
const SubscriptionUsage_1 = require("../models/SubscriptionUsage");
const SubscriptionOverride_1 = require("../models/SubscriptionOverride");
const VendorSubscription_1 = require("../models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../models/VendorSubscriptionItem");
const SubscriptionOrder_1 = require("../models/SubscriptionOrder");
const SubscriptionInvoice_1 = require("../models/SubscriptionInvoice");
const SubscriptionPayment_1 = require("../models/SubscriptionPayment");
const SubscriptionQuote_1 = require("../models/SubscriptionQuote");
const SubscriptionEvent_1 = require("../models/SubscriptionEvent");
const SubscriptionAuditLog_1 = require("../models/SubscriptionAuditLog");
const SubscriptionPlanTier_1 = require("../models/SubscriptionPlanTier");
const AdminSubscriptionService_1 = require("../services/AdminSubscriptionService");
const SubscriptionAnalyticsService_1 = require("../services/SubscriptionAnalyticsService");
const SubscriptionLifecycleService_1 = require("../services/SubscriptionLifecycleService");
class AdminSubscriptionController {
    /**
     * GET /api/admin/subscriptions/dashboard
     */
    static async getDashboardStats(req, res) {
        try {
            const analytics = await SubscriptionAnalyticsService_1.SubscriptionAnalyticsService.getAnalytics();
            res.json({ success: true, analytics });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/subscription-products
     */
    static async upsertProduct(req, res) {
        try {
            const product = await AdminSubscriptionService_1.AdminSubscriptionService.upsertProduct(req.body, req.user.id);
            res.json({ success: true, product });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/admin/subscription-products
     */
    static async getAllProducts(req, res) {
        try {
            const products = await SubscriptionProduct_1.SubscriptionProduct.find().sort({ sortOrder: 1, createdAt: -1 });
            const productIds = products.map(p => p._id);
            const prices = await SubscriptionPrice_1.SubscriptionPrice.find({ productId: { $in: productIds } });
            const features = await SubscriptionProductFeature_1.SubscriptionProductFeature.find({ productId: { $in: productIds } }).populate('featureId');
            res.json({ success: true, products, prices, features });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/subscription-products/:id/prices
     */
    static async addPriceVersion(req, res) {
        try {
            const price = await AdminSubscriptionService_1.AdminSubscriptionService.addPriceVersion(req.params.id, req.body, req.user.id);
            res.json({ success: true, price });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/admin/subscription-features
     */
    static async getFeatures(req, res) {
        try {
            const features = await SubscriptionFeature_1.SubscriptionFeature.find().sort({ category: 1, name: 1 });
            res.json({ success: true, features });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/subscription-features
     */
    static async createFeature(req, res) {
        try {
            const feature = await SubscriptionFeature_1.SubscriptionFeature.create(req.body);
            await AdminSubscriptionService_1.AdminSubscriptionService.logAudit('CREATE_FEATURE', 'FEATURE', feature._id.toString(), undefined, 'Created feature', req.user.id, {}, feature);
            res.json({ success: true, feature });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * PUT /api/admin/subscription-products/:id/features
     */
    static async assignProductFeatures(req, res) {
        try {
            const productId = req.params.id;
            const { features } = req.body; // Array of { featureId, enabled, limitValue, enforcementMode }
            await SubscriptionProductFeature_1.SubscriptionProductFeature.deleteMany({ productId });
            const mappings = (features || []).map((f) => ({
                productId,
                featureId: f.featureId,
                enabled: f.enabled ?? true,
                limitValue: f.limitValue !== undefined ? f.limitValue : null,
                enforcementMode: f.enforcementMode || 'HARD_BLOCK'
            }));
            const created = await SubscriptionProductFeature_1.SubscriptionProductFeature.insertMany(mappings);
            await AdminSubscriptionService_1.AdminSubscriptionService.logAudit('ASSIGN_PRODUCT_FEATURES', 'PLAN', productId, undefined, 'Assigned plan features', req.user.id, {}, created);
            res.json({ success: true, mappings: created });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/subscription-discounts
     */
    static async createDiscount(req, res) {
        try {
            const discount = await SubscriptionDiscount_1.SubscriptionDiscount.create({ ...req.body, createdBy: req.user.id });
            await AdminSubscriptionService_1.AdminSubscriptionService.logAudit('CREATE_DISCOUNT', 'DISCOUNT', discount._id.toString(), undefined, 'Created discount', req.user.id, {}, discount);
            res.json({ success: true, discount });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/admin/subscription-discounts
     */
    static async getDiscounts(req, res) {
        try {
            const discounts = await SubscriptionDiscount_1.SubscriptionDiscount.find().sort({ createdAt: -1 });
            res.json({ success: true, discounts });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/vendor-pricing
     */
    static async setVendorPricingOverride(req, res) {
        try {
            const { vendorId, productId, overridePrice, reason, validTill } = req.body;
            const override = await AdminSubscriptionService_1.AdminSubscriptionService.setVendorPricingOverride(vendorId, productId, overridePrice, reason, req.user.id, validTill);
            res.json({ success: true, override });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/admin/vendor-pricing
     */
    static async getVendorPricings(req, res) {
        try {
            const pricings = await SubscriptionVendorPricing_1.SubscriptionVendorPricing.find().populate('vendorId').populate('productId').sort({ createdAt: -1 });
            res.json({ success: true, pricings });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/vendor-subscriptions/assign
     */
    static async assignVendorPlan(req, res) {
        try {
            const { vendorId, productId, priceId, reason } = req.body;
            const sub = await AdminSubscriptionService_1.AdminSubscriptionService.assignVendorPlan(vendorId, productId, priceId, reason || 'Admin manual assignment', req.user.id);
            res.json({ success: true, subscription: sub });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/vendor-subscriptions/:id/pause
     */
    static async pauseSubscription(req, res) {
        try {
            const { reason } = req.body;
            const sub = await SubscriptionLifecycleService_1.SubscriptionLifecycleService.pauseSubscription(req.params.id, reason || 'Admin pause', req.user.id);
            res.json({ success: true, subscription: sub });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/admin/vendor-subscriptions/:id/resume
     */
    static async resumeSubscription(req, res) {
        try {
            const sub = await SubscriptionLifecycleService_1.SubscriptionLifecycleService.resumeSubscription(req.params.id, req.user.id);
            res.json({ success: true, subscription: sub });
        }
        catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/admin/subscription-audit-logs
     */
    static async getAuditLogs(req, res) {
        try {
            const logs = await SubscriptionAuditLog_1.SubscriptionAuditLog.find().populate('performedBy').populate('vendorId').sort({ createdAt: -1 }).limit(100);
            res.json({ success: true, logs });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * DELETE /api/admin/subscription-data/clear-all
     * Clears all subscription plans, fees, features, prices, and vendor subscription data.
     * Use this to reset the subscription system before entering new plan data.
     */
    static async clearAllSubscriptionData(req, res) {
        try {
            const models = [
                { name: 'SubscriptionPlanTier', model: SubscriptionPlanTier_1.SubscriptionPlanTier },
                { name: 'SubscriptionProduct', model: SubscriptionProduct_1.SubscriptionProduct },
                { name: 'SubscriptionPrice', model: SubscriptionPrice_1.SubscriptionPrice },
                { name: 'SubscriptionFeature', model: SubscriptionFeature_1.SubscriptionFeature },
                { name: 'SubscriptionProductFeature', model: SubscriptionProductFeature_1.SubscriptionProductFeature },
                { name: 'SubscriptionProfileFeature', model: SubscriptionProfileFeature_1.SubscriptionProfileFeature },
                { name: 'SubscriptionPlanProfile', model: SubscriptionPlanProfile_1.SubscriptionPlanProfile },
                { name: 'SubscriptionProfilePrice', model: SubscriptionProfilePrice_1.SubscriptionProfilePrice },
                { name: 'SubscriptionVendorPricing', model: SubscriptionVendorPricing_1.SubscriptionVendorPricing },
                { name: 'SubscriptionVendorAgreement', model: SubscriptionVendorAgreement_1.SubscriptionVendorAgreement },
                { name: 'SubscriptionVendorTypeOverride', model: SubscriptionVendorTypeOverride_1.SubscriptionVendorTypeOverride },
                { name: 'SubscriptionCustomerTypePricing', model: SubscriptionCustomerTypePricing_1.SubscriptionCustomerTypePricing },
                { name: 'SubscriptionDiscount', model: SubscriptionDiscount_1.SubscriptionDiscount },
                { name: 'SubscriptionUsage', model: SubscriptionUsage_1.SubscriptionUsage },
                { name: 'SubscriptionOverride', model: SubscriptionOverride_1.SubscriptionOverride },
                { name: 'VendorSubscription', model: VendorSubscription_1.VendorSubscription },
                { name: 'VendorSubscriptionItem', model: VendorSubscriptionItem_1.VendorSubscriptionItem },
                { name: 'SubscriptionOrder', model: SubscriptionOrder_1.SubscriptionOrder },
                { name: 'SubscriptionInvoice', model: SubscriptionInvoice_1.SubscriptionInvoice },
                { name: 'SubscriptionPayment', model: SubscriptionPayment_1.SubscriptionPayment },
                { name: 'SubscriptionQuote', model: SubscriptionQuote_1.SubscriptionQuote },
                { name: 'SubscriptionEvent', model: SubscriptionEvent_1.SubscriptionEvent },
                { name: 'SubscriptionAuditLog', model: SubscriptionAuditLog_1.SubscriptionAuditLog },
            ];
            const results = {};
            for (const item of models) {
                const r = await item.model.deleteMany({});
                results[item.name] = r.deletedCount || 0;
            }
            console.log('[AdminSubscription] All subscription data cleared by admin:', req.user?.id, results);
            res.json({
                success: true,
                message: 'All subscription plans, fees, features, prices and vendor subscription data cleared successfully. You may now add fresh data.',
                cleared: results,
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.AdminSubscriptionController = AdminSubscriptionController;
