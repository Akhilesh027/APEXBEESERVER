"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSubscriptionData = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const SubscriptionProduct_1 = require("../modules/subscription/models/SubscriptionProduct");
const SubscriptionPrice_1 = require("../modules/subscription/models/SubscriptionPrice");
const SubscriptionFeature_1 = require("../modules/subscription/models/SubscriptionFeature");
const SubscriptionProductFeature_1 = require("../modules/subscription/models/SubscriptionProductFeature");
const SubscriptionDiscount_1 = require("../modules/subscription/models/SubscriptionDiscount");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apexbee';
const seedSubscriptionData = async () => {
    try {
        if (mongoose_1.default.connection.readyState !== 1) {
            await mongoose_1.default.connect(MONGODB_URI);
            console.log('Connected to MongoDB for Subscription Seeding.');
        }
        console.log('Seeding Master Subscription Features...');
        const masterFeatures = [
            { key: 'POS_ACCESS', name: 'POS Software Access', category: 'POS', valueType: 'BOOLEAN', resetCycle: 'NEVER' },
            { key: 'MAX_BRANCHES', name: 'Maximum Branches Allowed', category: 'BRANCHES', valueType: 'COUNT', resetCycle: 'NEVER' },
            { key: 'MAX_PRODUCTS', name: 'Maximum Menu/Catalog Products', category: 'CATALOGUE', valueType: 'COUNT', resetCycle: 'NEVER' },
            { key: 'MAX_STAFF_USERS', name: 'Maximum Staff User Accounts', category: 'STAFF', valueType: 'COUNT', resetCycle: 'NEVER' },
            { key: 'MAX_POS_DEVICES', name: 'Maximum POS Terminals/Devices', category: 'POS', valueType: 'COUNT', resetCycle: 'NEVER' },
            { key: 'MONTHLY_ORDER_LIMIT', name: 'Monthly Order Processing Limit', category: 'ORDERS', valueType: 'COUNT', resetCycle: 'MONTHLY' },
            { key: 'ADVANCED_REPORTS', name: 'Advanced BI Analytics & Reports', category: 'REPORTS', valueType: 'BOOLEAN', resetCycle: 'NEVER' },
            { key: 'KITCHEN_DISPLAY_SYSTEM', name: 'Kitchen Display System (KDS)', category: 'POS', valueType: 'BOOLEAN', resetCycle: 'NEVER' },
            { key: 'CUSTOMER_CRM', name: 'Customer CRM & Marketing Engine', category: 'CRM', valueType: 'BOOLEAN', resetCycle: 'NEVER' },
            { key: 'LOYALTY_PROGRAM', name: 'Customer Loyalty & Points', category: 'MARKETING', valueType: 'BOOLEAN', resetCycle: 'NEVER' },
            { key: 'WHATSAPP_CREDITS', name: 'Monthly WhatsApp Message Credits', category: 'COMMUNICATION', valueType: 'CREDITS', resetCycle: 'MONTHLY' },
            { key: 'SMS_CREDITS', name: 'Monthly SMS Notification Credits', category: 'COMMUNICATION', valueType: 'CREDITS', resetCycle: 'MONTHLY' },
            { key: 'AI_POSTER_CREDITS', name: 'AI Marketing Poster Generations', category: 'AI', valueType: 'CREDITS', resetCycle: 'MONTHLY' },
            { key: 'CUSTOM_DOMAIN', name: 'Custom Website Domain', category: 'CORE', valueType: 'BOOLEAN', resetCycle: 'NEVER' }
        ];
        const featureDocMap = {};
        for (const f of masterFeatures) {
            const feat = await SubscriptionFeature_1.SubscriptionFeature.findOneAndUpdate({ key: f.key }, { ...f, status: 'ACTIVE' }, { upsert: true, new: true });
            featureDocMap[f.key] = feat._id;
        }
        console.log('Seeding Subscription Products (Plans & Addons)...');
        // 1. Restaurant Free Plan
        const freePlan = await SubscriptionProduct_1.SubscriptionProduct.findOneAndUpdate({ code: 'REST_FREE' }, {
            code: 'REST_FREE',
            name: 'Restaurant Free',
            slug: 'restaurant-free',
            productType: 'PLAN',
            description: 'Starter plan for small standalone eateries & food stalls',
            shortDescription: 'Free forever starter plan',
            supportedVendorTypes: ['restaurant'],
            isPublic: true,
            sortOrder: 1,
            status: 'ACTIVE'
        }, { upsert: true, new: true });
        const freePrice = await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: freePlan._id, billingCycle: 'MONTHLY' }, {
            productId: freePlan._id,
            billingCycle: 'MONTHLY',
            durationValue: 1,
            durationUnit: 'MONTH',
            originalAmount: 0,
            gstRate: 0,
            taxMode: 'NOT_APPLICABLE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        // 2. Restaurant Basic Plan
        const basicPlan = await SubscriptionProduct_1.SubscriptionProduct.findOneAndUpdate({ code: 'REST_BASIC' }, {
            code: 'REST_BASIC',
            name: 'Restaurant Basic',
            slug: 'restaurant-basic',
            productType: 'PLAN',
            description: 'Ideal for growing restaurants needing multi-staff & order processing',
            shortDescription: 'Essential restaurant management tool',
            supportedVendorTypes: ['restaurant'],
            isPublic: true,
            sortOrder: 2,
            status: 'ACTIVE'
        }, { upsert: true, new: true });
        const basicPriceMonthly = await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: basicPlan._id, billingCycle: 'MONTHLY' }, {
            productId: basicPlan._id,
            billingCycle: 'MONTHLY',
            durationValue: 1,
            durationUnit: 'MONTH',
            originalAmount: 1499,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        const basicPriceYearly = await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: basicPlan._id, billingCycle: 'YEARLY' }, {
            productId: basicPlan._id,
            billingCycle: 'YEARLY',
            durationValue: 1,
            durationUnit: 'YEAR',
            originalAmount: 14990,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        // 3. Restaurant Premium Plan
        const premiumPlan = await SubscriptionProduct_1.SubscriptionProduct.findOneAndUpdate({ code: 'REST_PREMIUM' }, {
            code: 'REST_PREMIUM',
            name: 'Restaurant Premium',
            slug: 'restaurant-premium',
            productType: 'PLAN',
            description: 'Complete suite with Advanced POS, KDS, CRM & WhatsApp marketing',
            shortDescription: 'Most popular plan for full-service restaurants',
            supportedVendorTypes: ['restaurant'],
            isPublic: true,
            isFeatured: true,
            sortOrder: 3,
            status: 'ACTIVE'
        }, { upsert: true, new: true });
        const premiumPriceMonthly = await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: premiumPlan._id, billingCycle: 'MONTHLY' }, {
            productId: premiumPlan._id,
            billingCycle: 'MONTHLY',
            durationValue: 1,
            durationUnit: 'MONTH',
            originalAmount: 4999,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        const premiumPriceYearly = await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: premiumPlan._id, billingCycle: 'YEARLY' }, {
            productId: premiumPlan._id,
            billingCycle: 'YEARLY',
            durationValue: 1,
            durationUnit: 'YEAR',
            originalAmount: 49990,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        // 4. Restaurant Enterprise Plan
        const enterprisePlan = await SubscriptionProduct_1.SubscriptionProduct.findOneAndUpdate({ code: 'REST_ENTERPRISE' }, {
            code: 'REST_ENTERPRISE',
            name: 'Restaurant Enterprise',
            slug: 'restaurant-enterprise',
            productType: 'PLAN',
            description: 'Custom multi-location chain & franchise suite with dedicated SLA',
            shortDescription: 'For restaurant chains & franchises',
            supportedVendorTypes: ['restaurant'],
            isPublic: true,
            sortOrder: 4,
            status: 'ACTIVE'
        }, { upsert: true, new: true });
        await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: enterprisePlan._id, billingCycle: 'YEARLY' }, {
            productId: enterprisePlan._id,
            billingCycle: 'YEARLY',
            durationValue: 1,
            durationUnit: 'YEAR',
            originalAmount: 99990,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        // 5. Addons
        const whatsappAddon = await SubscriptionProduct_1.SubscriptionProduct.findOneAndUpdate({ code: 'ADDON_WA_MARKETING' }, {
            code: 'ADDON_WA_MARKETING',
            name: 'WhatsApp Marketing Pack',
            slug: 'whatsapp-marketing-pack',
            productType: 'ADDON',
            description: '5,000 monthly WhatsApp notification & promotional credits',
            shortDescription: '5,000 WhatsApp Credits',
            supportedVendorTypes: ['restaurant', 'grocery', 'retail'],
            isPublic: true,
            sortOrder: 1,
            status: 'ACTIVE'
        }, { upsert: true, new: true });
        await SubscriptionPrice_1.SubscriptionPrice.findOneAndUpdate({ productId: whatsappAddon._id, billingCycle: 'MONTHLY' }, {
            productId: whatsappAddon._id,
            billingCycle: 'MONTHLY',
            durationValue: 1,
            durationUnit: 'MONTH',
            originalAmount: 999,
            gstRate: 18,
            taxMode: 'EXCLUSIVE',
            version: 1,
            isActive: true
        }, { upsert: true, new: true });
        // Feature Mappings
        console.log('Seeding Product Feature Mappings...');
        // Free Plan Mappings
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: freePlan._id, featureId: featureDocMap['POS_ACCESS'] }, { productId: freePlan._id, featureId: featureDocMap['POS_ACCESS'], enabled: true }, { upsert: true });
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: freePlan._id, featureId: featureDocMap['MAX_BRANCHES'] }, { productId: freePlan._id, featureId: featureDocMap['MAX_BRANCHES'], enabled: true, limitValue: 1 }, { upsert: true });
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: freePlan._id, featureId: featureDocMap['MAX_STAFF_USERS'] }, { productId: freePlan._id, featureId: featureDocMap['MAX_STAFF_USERS'], enabled: true, limitValue: 2 }, { upsert: true });
        // Premium Plan Mappings
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: premiumPlan._id, featureId: featureDocMap['POS_ACCESS'] }, { productId: premiumPlan._id, featureId: featureDocMap['POS_ACCESS'], enabled: true }, { upsert: true });
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: premiumPlan._id, featureId: featureDocMap['MAX_BRANCHES'] }, { productId: premiumPlan._id, featureId: featureDocMap['MAX_BRANCHES'], enabled: true, limitValue: 5 }, { upsert: true });
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: premiumPlan._id, featureId: featureDocMap['MAX_STAFF_USERS'] }, { productId: premiumPlan._id, featureId: featureDocMap['MAX_STAFF_USERS'], enabled: true, limitValue: 25 }, { upsert: true });
        await SubscriptionProductFeature_1.SubscriptionProductFeature.findOneAndUpdate({ productId: premiumPlan._id, featureId: featureDocMap['ADVANCED_REPORTS'] }, { productId: premiumPlan._id, featureId: featureDocMap['ADVANCED_REPORTS'], enabled: true }, { upsert: true });
        // Sample Launch Coupon
        await SubscriptionDiscount_1.SubscriptionDiscount.findOneAndUpdate({ code: 'APEXWELCOME' }, {
            name: 'Welcome 20% Discount',
            code: 'APEXWELCOME',
            discountType: 'PERCENTAGE',
            discountValue: 20,
            maximumDiscountAmount: 2000,
            scope: 'COUPON',
            status: 'ACTIVE'
        }, { upsert: true });
        console.log('Subscription Seeding Completed Successfully.');
        return true;
    }
    catch (error) {
        console.error('Error seeding subscription data:', error);
        throw error;
    }
};
exports.seedSubscriptionData = seedSubscriptionData;
if (require.main === module) {
    (0, exports.seedSubscriptionData)().then(() => process.exit(0)).catch(() => process.exit(1));
}
