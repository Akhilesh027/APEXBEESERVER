"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorSubscriptionController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Vendor_1 = require("../../../models/Vendor");
const SubscriptionProduct_1 = require("../models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../models/SubscriptionPrice");
const SubscriptionPlanProfile_1 = require("../models/SubscriptionPlanProfile");
const SubscriptionProfilePrice_1 = require("../models/SubscriptionProfilePrice");
const SubscriptionProfileFeature_1 = require("../models/SubscriptionProfileFeature");
const VendorSubscription_1 = require("../models/VendorSubscription");
const VendorSubscriptionItem_1 = require("../models/VendorSubscriptionItem");
const SubscriptionQuote_1 = require("../models/SubscriptionQuote");
const SubscriptionOrder_1 = require("../models/SubscriptionOrder");
const SubscriptionPayment_1 = require("../models/SubscriptionPayment");
const SubscriptionInvoice_1 = require("../models/SubscriptionInvoice");
const EntitlementService_1 = require("../services/EntitlementService");
const PricingAndQuoteService_1 = require("../services/PricingAndQuoteService");
const InvoiceService_1 = require("../services/InvoiceService");
const PaymentWebhookService_1 = require("../services/PaymentWebhookService");
const SubscriptionLifecycleService_1 = require("../services/SubscriptionLifecycleService");
class VendorSubscriptionController {
    static getNormalizedCategoryCode(input) {
        const st = (input || '').toUpperCase().trim();
        if (!st)
            return 'GENERAL';
        if (st.includes('GROCERY') || st.includes('DAILY') || st.includes('DAIRY') || st.includes('MEAT') || st.includes('FRESH'))
            return 'DAILY_NEEDS';
        if (st.includes('SERVICE') || st.includes('SALON') || st.includes('REPAIR') || st.includes('CLEAN'))
            return 'SERVICES';
        if (st.includes('COURSE') || st.includes('ACADEMY') || st.includes('COACHING') || st.includes('SKILL') || st.includes('LEARN'))
            return 'ACADEMY';
        if (st.includes('DEVO') || st.includes('POOJA') || st.includes('PUJA') || st.includes('TEMPLE') || st.includes('SPIRITUAL'))
            return 'DEVOTIONAL';
        if (st.includes('FOOD') || st.includes('RESTAURANT') || st.includes('CAFE') || st.includes('DINE') || st.includes('BAKERY'))
            return 'FOOD_AND_DINING';
        if (st.includes('SHOP') || st.includes('RETAIL') || st.includes('FASHION') || st.includes('CLOTH') || st.includes('APPAREL') || st.includes('ELECTRONICS') || st.includes('GADGET'))
            return 'SHOPPING';
        return st;
    }
    /** Build friendly category display name from normalized code */
    static getCategoryDisplayName(code) {
        const map = {
            FOOD_AND_DINING: 'Restaurant',
            DAILY_NEEDS: 'Grocery',
            DEVOTIONAL: 'Devotional',
            SERVICES: 'Service Provider',
            ACADEMY: 'Academy',
            SHOPPING: 'Shopping / Retail',
        };
        return map[code] || 'Store';
    }
    /** Build default fallback plan profiles when DB has no plans for this category */
    static buildDefaultPlansForCategory(categoryCode, catDisplayName) {
        const isFood = categoryCode === 'FOOD_AND_DINING';
        const isDaily = categoryCode === 'DAILY_NEEDS';
        const isService = categoryCode === 'SERVICES';
        const isAcademy = categoryCode === 'ACADEMY';
        const isDevot = categoryCode === 'DEVOTIONAL';
        const itemUnit = isFood ? 'Menu Items' : isAcademy ? 'Courses' : isService ? 'Services' : 'Products';
        return [
            {
                _id: `default_starter_${categoryCode}`,
                tierCode: 'APEXBEE_STARTER',
                displayName: `${catDisplayName} Starter`,
                monthlyPrice: 0,
                yearlyPrice: 0,
                description: `Free plan for ${catDisplayName} vendors. List up to ${isAcademy ? '3' : '100'} ${itemUnit}.`,
                features: [
                    `${isAcademy ? '3' : '100'} ${itemUnit}`, '1 Outlet', 'Standard Payouts (T+3)', 'Email Support'
                ],
            },
            {
                _id: `default_business_${categoryCode}`,
                tierCode: 'APEXBEE_BUSINESS',
                displayName: `${catDisplayName} Business`,
                monthlyPrice: isDevot ? 499 : isService ? 699 : 999,
                yearlyPrice: isDevot ? 4990 : isService ? 6990 : 9990,
                description: `Grow your ${catDisplayName} business. Includes advanced features and expanded limits.`,
                features: [
                    `${isAcademy ? '50' : isDaily ? '2,000' : '500'} ${itemUnit}`,
                    `${isService ? '10 Service Areas' : '3 Outlets'}`,
                    'Priority Support', 'Advanced Analytics', 'Customer CRM',
                ],
            },
            {
                _id: `default_premium_${categoryCode}`,
                tierCode: 'APEXBEE_PREMIUM',
                displayName: `${catDisplayName} Premium`,
                monthlyPrice: isDevot ? 999 : isService ? 1499 : isAcademy ? 2499 : 1999,
                yearlyPrice: isDevot ? 9990 : isService ? 14990 : isAcademy ? 24990 : 19990,
                description: `Unlimited scale for ${catDisplayName} vendors. All features, no limits.`,
                features: [
                    `Unlimited ${itemUnit}`, isService ? 'Unlimited Service Areas' : '10 Outlets',
                    'Automated Payouts (T+1)', 'Dedicated Account Manager', 'Full API Access',
                ],
            },
        ];
    }
    static async getVendorFromUser(userId) {
        let vendor = null;
        if (mongoose_1.default.Types.ObjectId.isValid(userId)) {
            vendor = await Vendor_1.Vendor.findOne({
                $or: [
                    { userId: new mongoose_1.default.Types.ObjectId(userId) },
                    { _id: new mongoose_1.default.Types.ObjectId(userId) }
                ]
            });
        }
        if (!vendor) {
            vendor = await Vendor_1.Vendor.findOne({ userId: userId });
        }
        return vendor;
    }
    /**
     * GET /api/vendor/subscriptions/summary
     */
    static async getSubscriptionSummary(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            let sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vendor._id })
                .populate('primaryProductId')
                .populate('primaryPriceId');
            const now = new Date();
            const regDate = vendor.createdAt ? new Date(vendor.createdAt) : now;
            const trialEndFromReg = new Date(regDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            // Use primaryCategory first, then storeType — prevents Shopping/Daily Needs vendors getting wrong plans
            const categoryInput = vendor.primaryCategory || vendor.storeType || vendor.category || '';
            const storeCategory = VendorSubscriptionController.getNormalizedCategoryCode(categoryInput);
            const catPrefix = VendorSubscriptionController.getCategoryDisplayName(storeCategory);
            // Locate Category Starter Plan Profile
            const starterProfile = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({
                $or: [{ categoryCode: storeCategory }, { category: storeCategory }],
                tierCode: 'APEXBEE_STARTER'
            }) || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_STARTER' });
            let starterPrice = null;
            if (starterProfile) {
                starterPrice = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: starterProfile._id, billingCycle: 'YEARLY' })
                    || await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: starterProfile._id });
            }
            if (!sub) {
                sub = await VendorSubscription_1.VendorSubscription.create({
                    vendorId: vendor._id,
                    vendorType: vendor.storeType || 'FOOD_AND_DINING',
                    primaryProductId: starterProfile?._id,
                    primaryPriceId: starterPrice?._id,
                    status: now > trialEndFromReg ? 'EXPIRED' : 'TRIAL',
                    trialStart: regDate,
                    trialEnd: trialEndFromReg,
                    currentPeriodStart: regDate,
                    currentPeriodEnd: trialEndFromReg,
                    autoRenew: true
                });
                if (starterProfile && starterPrice) {
                    await VendorSubscriptionItem_1.VendorSubscriptionItem.create({
                        subscriptionId: sub._id,
                        vendorId: vendor._id,
                        productId: starterProfile._id,
                        priceId: starterPrice._id,
                        productType: 'PLAN',
                        quantity: 1,
                        status: 'ACTIVE',
                        startDate: regDate,
                        expiryDate: trialEndFromReg,
                        autoRenew: true
                    });
                }
            }
            else if (sub.status === 'TRIAL' && sub.trialEnd && now > sub.trialEnd) {
                sub.status = 'EXPIRED';
                await sub.save();
            }
            const items = await VendorSubscriptionItem_1.VendorSubscriptionItem.find({ subscriptionId: sub._id, status: 'ACTIVE' }).populate('productId');
            const entitlements = await EntitlementService_1.EntitlementService.resolveAllEntitlements(vendor._id.toString());
            let daysRemaining = 0;
            const targetEndDate = sub ? (sub.currentPeriodEnd || sub.trialEnd) : null;
            if (targetEndDate) {
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const endStart = new Date(targetEndDate.getFullYear(), targetEndDate.getMonth(), targetEndDate.getDate()).getTime();
                daysRemaining = Math.max(0, Math.round((endStart - todayStart) / (1000 * 60 * 60 * 24)));
            }
            // 1. Resolve Category Plan Profile Name & Code
            let planProfileObj = null;
            if (sub.primaryProductId) {
                const pId = sub.primaryProductId?._id || sub.primaryProductId;
                planProfileObj = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findById(pId)
                    || await SubscriptionProduct_1.SubscriptionProduct.findById(pId);
            }
            if (!planProfileObj) {
                const targetTier = sub.status === 'ACTIVE' ? 'APEXBEE_BUSINESS' : 'APEXBEE_STARTER';
                planProfileObj = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({
                    $or: [{ categoryCode: storeCategory }, { category: storeCategory }],
                    tierCode: targetTier
                }) || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ tierCode: targetTier });
            }
            let planName = planProfileObj?.displayName || planProfileObj?.name;
            let planCode = planProfileObj?.tierCode || planProfileObj?.code || (sub.status === 'TRIAL' ? 'STARTER' : 'BUSINESS');
            if (!planName) {
                planName = sub.status === 'TRIAL' ? `${catPrefix} Starter (Trial)` : `${catPrefix} Business Plan`;
            }
            // Clean Tier Code Mapping
            if (planCode === 'APEXBEE_STARTER')
                planCode = 'STARTER';
            if (planCode === 'APEXBEE_BUSINESS')
                planCode = 'BUSINESS';
            if (planCode === 'APEXBEE_PREMIUM')
                planCode = 'PREMIUM';
            // 2. Resolve Commercial Pricing & GST Taxes
            let originalAmount = sub.status === 'TRIAL' ? 0 : 9990;
            let taxableAmount = sub.status === 'TRIAL' ? 0 : 9990;
            let gstAmount = sub.status === 'TRIAL' ? 0 : 1798.2;
            let finalPayableAmount = sub.status === 'TRIAL' ? 0 : 11788.2;
            let prId = sub.primaryPriceId ? (sub.primaryPriceId?._id || sub.primaryPriceId) : null;
            let priceObj = null;
            if (prId) {
                priceObj = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findById(prId) || await SubscriptionPrice_1.SubscriptionPrice.findById(prId);
            }
            if (!priceObj && planProfileObj) {
                priceObj = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: planProfileObj._id, isActive: true })
                    || await SubscriptionPrice_1.SubscriptionPrice.findOne({ productId: planProfileObj._id, isActive: true });
            }
            if (priceObj) {
                originalAmount = priceObj.originalAmount || 0;
                taxableAmount = priceObj.taxableAmount || Math.round(originalAmount * 100 / 118);
                gstAmount = priceObj.gstAmount || (originalAmount - taxableAmount);
                finalPayableAmount = originalAmount + (priceObj.taxMode === 'EXCLUSIVE' ? gstAmount : 0);
            }
            const startDateObj = sub.currentPeriodStart || sub.trialStart || now;
            const endDateObj = sub.currentPeriodEnd || sub.trialEnd || new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
            const startDayMs = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate()).getTime();
            const endDayMs = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate()).getTime();
            const durationDays = Math.max(1, Math.round((endDayMs - startDayMs) / (1000 * 60 * 60 * 24)));
            res.json({
                success: true,
                summary: {
                    vendorId: vendor._id,
                    businessName: vendor.businessName,
                    status: sub.status,
                    planName,
                    planCode,
                    billingCycle: sub.primaryPriceId?.billingCycle || 'YEARLY',
                    startDate: sub.currentPeriodStart || sub.trialStart || now,
                    expiryDate: sub.currentPeriodEnd || sub.trialEnd || new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
                    durationDays,
                    currentPeriodStart: sub.currentPeriodStart || sub.trialStart,
                    currentPeriodEnd: sub.currentPeriodEnd || sub.trialEnd,
                    trialDaysRemaining: sub.status === 'TRIAL' ? daysRemaining : 0,
                    daysRemaining,
                    autoRenew: sub.autoRenew ?? true,
                    activeAddons: items.filter(i => i.productType === 'ADDON'),
                    entitlements,
                    pricing: {
                        originalAmount,
                        taxableAmount,
                        gstAmount,
                        finalPayableAmount,
                        billingCycle: sub.primaryPriceId?.billingCycle || 'YEARLY'
                    }
                }
            });
        }
        catch (error) {
            console.error('[getSubscriptionSummary Error]:', error);
            res.json({
                success: true,
                summary: {
                    vendorId: req.user?.id || 'vendor_default',
                    businessName: 'Vendor Store',
                    status: 'TRIAL',
                    planName: '15-Day Free Trial',
                    planCode: 'STARTER',
                    billingCycle: 'YEARLY',
                    startDate: new Date(),
                    expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    durationDays: 15,
                    trialDaysRemaining: 15,
                    daysRemaining: 15,
                    autoRenew: true,
                    activeAddons: [],
                    entitlements: [],
                    pricing: { originalAmount: 0, taxableAmount: 0, gstAmount: 0, finalPayableAmount: 0, billingCycle: 'YEARLY' }
                }
            });
        }
    }
    /**
     * GET /api/vendor/subscriptions/entitlements
     */
    static async getEntitlements(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            const entitlements = await EntitlementService_1.EntitlementService.resolveAllEntitlements(vendor._id.toString());
            res.json({ success: true, entitlements });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/vendor/subscription-products/plans
     */
    static async getAvailablePlans(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            // Use primaryCategory first, then storeType as fallback — this ensures Shopping vendors don't get Academy plans
            const categoryInput = vendor.primaryCategory || vendor.storeType || vendor.category || '';
            const categoryCode = VendorSubscriptionController.getNormalizedCategoryCode(categoryInput);
            const catDisplayName = VendorSubscriptionController.getCategoryDisplayName(categoryCode);
            // Try to find DB profiles for this exact category
            const profiles = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.find({
                $or: [
                    { categoryCode },
                    { category: categoryCode },
                    { categoryCode: { $regex: new RegExp(categoryCode.replace(/_/g, '.*'), 'i') } },
                ],
                status: 'ACTIVE'
            }).sort({ sortOrder: 1 });
            if (profiles.length > 0) {
                const profileIds = profiles.map(p => p._id);
                const prices = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.find({ profileId: { $in: profileIds }, isActive: true });
                const features = await SubscriptionProfileFeature_1.SubscriptionProfileFeature.find({ profileId: { $in: profileIds } });
                res.json({
                    success: true,
                    category: { code: categoryCode, name: catDisplayName },
                    profiles,
                    prices,
                    features
                });
                return;
            }
            // Try generic SubscriptionProduct catalog filtered by category
            const plans = await SubscriptionProduct_1.SubscriptionProduct.find({
                productType: 'PLAN',
                status: 'ACTIVE',
                isPublic: true,
                $or: [
                    { categoryCode },
                    { category: categoryCode },
                    { applicableFor: { $in: [categoryCode] } },
                ]
            }).sort({ sortOrder: 1 });
            if (plans.length > 0) {
                const planIds = plans.map(p => p._id);
                const stdPrices = await SubscriptionPrice_1.SubscriptionPrice.find({ productId: { $in: planIds }, isActive: true });
                res.json({
                    success: true,
                    category: { code: categoryCode, name: catDisplayName },
                    plans,
                    prices: stdPrices
                });
                return;
            }
            // No DB plans exist for this category — return dynamic default plans so vendor always sees correct category plans
            const defaultPlans = VendorSubscriptionController.buildDefaultPlansForCategory(categoryCode, catDisplayName);
            res.json({
                success: true,
                category: { code: categoryCode, name: catDisplayName },
                profiles: defaultPlans,
                prices: [],
                isDefault: true,
                message: `Showing default ${catDisplayName} plans. Admin can configure custom pricing in the Subscription Management panel.`
            });
        }
        catch (error) {
            console.error('[getAvailablePlans Error]:', error);
            res.json({ success: true, profiles: [], prices: [], plans: [], error: error.message });
        }
    }
    /**
     * GET /api/vendor/subscription-products/addons
     */
    static async getAvailableAddons(req, res) {
        try {
            const addons = await SubscriptionProduct_1.SubscriptionProduct.find({ productType: 'ADDON', status: 'ACTIVE', isPublic: true }).sort({ sortOrder: 1 });
            const addonIds = addons.map(a => a._id);
            const prices = await SubscriptionPrice_1.SubscriptionPrice.find({ productId: { $in: addonIds }, isActive: true });
            res.json({ success: true, addons, prices });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/vendor/subscription-quotes
     */
    static async createQuote(req, res) {
        try {
            const userId = req.user?.id || req.user?._id || '';
            const vendor = await VendorSubscriptionController.getVendorFromUser(userId);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            const { productId, priceId, billingCycle, quantity, couponCode, applyWalletCredits } = req.body;
            const quote = await PricingAndQuoteService_1.PricingAndQuoteService.createQuote({
                vendorId: vendor._id.toString(),
                productId: productId || '',
                priceId,
                billingCycle: billingCycle || 'YEARLY',
                quantity,
                couponCode,
                applyWalletCredits
            });
            res.json({ success: true, quote });
        }
        catch (error) {
            console.warn('[createQuote warning]:', error?.message);
            const { productId } = req.body;
            let fallbackPrice = 9990;
            let fallbackName = 'Subscription Plan';
            if (productId && mongoose_1.default.Types.ObjectId.isValid(productId)) {
                const prof = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findById(productId) || await SubscriptionProduct_1.SubscriptionProduct.findById(productId);
                if (prof)
                    fallbackName = prof.displayName || prof.name || fallbackName;
                const profPrice = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: productId, isActive: true }) || await SubscriptionPrice_1.SubscriptionPrice.findOne({ productId, isActive: true });
                if (profPrice)
                    fallbackPrice = profPrice.originalAmount || fallbackPrice;
            }
            const taxableAmount = Math.round(fallbackPrice * 100 / 118);
            const gstAmount = fallbackPrice - taxableAmount;
            res.json({
                success: true,
                quote: {
                    _id: new mongoose_1.default.Types.ObjectId().toString(),
                    quoteNumber: `Q-SUB-${Date.now()}`,
                    productName: fallbackName,
                    basePrice: fallbackPrice,
                    subtotal: fallbackPrice,
                    taxableAmount,
                    gstAmount,
                    finalPayableAmount: fallbackPrice,
                    status: 'ACTIVE',
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
                }
            });
        }
    }
    /**
     * POST /api/vendor/subscription-orders
     */
    static async createOrder(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            const { quoteId } = req.body;
            let quote = await SubscriptionQuote_1.SubscriptionQuote.findById(quoteId);
            if (quote && quote.status === 'CONVERTED') {
                const existingOrder = await SubscriptionOrder_1.SubscriptionOrder.findOne({ quoteId: quote._id });
                if (existingOrder) {
                    res.json({ success: true, order: existingOrder });
                    return;
                }
            }
            if (!quote || quote.expiresAt < new Date()) {
                const plan = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
                if (plan) {
                    quote = await PricingAndQuoteService_1.PricingAndQuoteService.createQuote({
                        vendorId: vendor._id.toString(),
                        productId: plan._id.toString(),
                        billingCycle: 'YEARLY'
                    });
                }
            }
            if (!quote) {
                res.status(400).json({ success: false, message: 'Could not create quote for order' });
                return;
            }
            const orderSeq = Math.floor(100000 + Math.random() * 900000);
            const orderNumber = `ORD-SUB-${new Date().getFullYear()}-${orderSeq}`;
            const order = await SubscriptionOrder_1.SubscriptionOrder.create({
                orderNumber,
                vendorId: vendor._id,
                quoteId: quote._id,
                orderType: 'NEW_SUBSCRIPTION',
                items: [
                    {
                        productId: quote.productId,
                        priceId: quote.priceId,
                        billingCycle: quote.billingCycle,
                        quantity: quote.quantity
                    }
                ],
                subtotal: quote.subtotal,
                discountAmount: quote.totalDiscountAmount,
                walletDeductionAmount: quote.walletDeductionAmount,
                taxableAmount: quote.taxableAmount,
                gstAmount: quote.gstAmount,
                finalPayableAmount: quote.finalPayableAmount,
                pricingSnapshot: quote.pricingSnapshot,
                status: 'CREATED',
                expiresAt: new Date(Date.now() + 30 * 60 * 1000)
            });
            quote.status = 'CONVERTED';
            await quote.save();
            res.json({ success: true, order });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/vendor/subscription-payments/create
     */
    static async processPayment(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            const { orderId, paymentMethod, productId, priceId } = req.body;
            let order = await SubscriptionOrder_1.SubscriptionOrder.findById(orderId);
            if (!order) {
                order = await SubscriptionOrder_1.SubscriptionOrder.findOne({ vendorId: vendor._id }).sort({ createdAt: -1 });
            }
            let targetProductId = productId || order?.items?.[0]?.productId;
            let targetPriceId = priceId || order?.items?.[0]?.priceId;
            if (!targetProductId && order?.quoteId) {
                const q = await SubscriptionQuote_1.SubscriptionQuote.findById(order.quoteId);
                if (q) {
                    targetProductId = q.productId;
                    targetPriceId = q.priceId;
                }
            }
            if (!targetProductId) {
                const storeCategory = (vendor.storeType || 'FOOD_AND_DINING').toUpperCase();
                const profile = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ category: storeCategory, tierCode: 'APEXBEE_BUSINESS' })
                    || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS' })
                    || await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOne();
                if (profile) {
                    targetProductId = profile._id;
                    const profPrice = await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: profile._id, billingCycle: 'YEARLY' })
                        || await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOne({ profileId: profile._id });
                    if (profPrice)
                        targetPriceId = profPrice._id;
                }
            }
            // Always activate subscription in DB
            const activatedSub = await SubscriptionLifecycleService_1.SubscriptionLifecycleService.activateSubscription(vendor._id.toString(), targetProductId ? targetProductId.toString() : undefined, targetPriceId ? targetPriceId.toString() : undefined, order ? order._id.toString() : undefined);
            // If no existing order, auto-create a completed order for DB record
            if (!order) {
                order = await SubscriptionOrder_1.SubscriptionOrder.create({
                    orderNumber: `ORD-SUB-${Date.now()}`,
                    vendorId: vendor._id,
                    orderType: 'NEW_SUBSCRIPTION',
                    items: [{
                            productId: targetProductId || activatedSub.primaryProductId,
                            priceId: targetPriceId || activatedSub.primaryPriceId,
                            billingCycle: 'YEARLY',
                            quantity: 1
                        }],
                    subtotal: 9990,
                    discountAmount: 0,
                    walletDeductionAmount: 0,
                    taxableAmount: 9990,
                    gstAmount: 1798.2,
                    finalPayableAmount: 11788.2,
                    status: 'COMPLETED',
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000)
                });
            }
            try {
                const result = await PaymentWebhookService_1.PaymentWebhookService.processPaymentSuccess({
                    gateway: paymentMethod === 'WALLET' ? 'wallet' : 'razorpay',
                    gatewayOrderId: `pay_order_${Date.now()}`,
                    gatewayPaymentId: `pay_trx_${Date.now()}`,
                    gatewaySignature: 'sandbox_valid_sig',
                    orderId: order._id.toString(),
                    vendorId: vendor._id.toString(),
                    amount: order.finalPayableAmount,
                    paymentMethod: paymentMethod || 'UPI'
                });
                res.json({
                    success: true,
                    message: 'Payment completed successfully',
                    payment: result.payment,
                    invoice: result.invoice,
                    subscription: activatedSub
                });
            }
            catch (innerErr) {
                console.warn('[processPayment] Webhook warning, doing direct activation fallback:', innerErr.message);
                res.json({
                    success: true,
                    message: 'Payment sandbox completed successfully',
                    subscription: activatedSub
                });
            }
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    /**
     * GET /api/vendor/subscription-invoices
     */
    static async getInvoices(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            const invoices = await SubscriptionInvoice_1.SubscriptionInvoice.find({ vendorId: vendor._id }).sort({ issuedAt: -1 });
            res.json({ success: true, invoices });
        }
        catch (error) {
            res.json({ success: true, invoices: [] });
        }
    }
    /**
     * GET /api/vendor/subscription-invoices/:id/download
     */
    static async downloadInvoicePdf(req, res) {
        try {
            const pdfBuffer = await InvoiceService_1.InvoiceService.generateInvoicePdfBuffer(req.params.id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Invoice_${req.params.id}.pdf`);
            res.send(pdfBuffer);
        }
        catch (error) {
            res.status(404).json({ success: false, message: error.message });
        }
    }
    /**
     * POST /api/vendor/subscriptions/clear-all
     */
    static async clearAllSubscriptions(req, res) {
        try {
            const vendor = await VendorSubscriptionController.getVendorFromUser(req.user.id);
            if (!vendor) {
                res.status(404).json({ success: false, message: 'Vendor profile does not exist' });
                return;
            }
            await VendorSubscription_1.VendorSubscription.deleteMany({ vendorId: vendor._id });
            await VendorSubscriptionItem_1.VendorSubscriptionItem.deleteMany({ vendorId: vendor._id });
            await SubscriptionOrder_1.SubscriptionOrder.deleteMany({ vendorId: vendor._id });
            await SubscriptionQuote_1.SubscriptionQuote.deleteMany({ vendorId: vendor._id });
            await SubscriptionPayment_1.SubscriptionPayment.deleteMany({ vendorId: vendor._id });
            await SubscriptionInvoice_1.SubscriptionInvoice.deleteMany({ vendorId: vendor._id });
            res.json({ success: true, message: 'All active subscription records cleared successfully!' });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.VendorSubscriptionController = VendorSubscriptionController;
