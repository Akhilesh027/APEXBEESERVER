"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedThreeTierSubscriptionSystem = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const SubscriptionPlanTier_1 = require("../modules/subscription/models/SubscriptionPlanTier");
const SubscriptionPlanProfile_1 = require("../modules/subscription/models/SubscriptionPlanProfile");
const SubscriptionProfilePrice_1 = require("../modules/subscription/models/SubscriptionProfilePrice");
const SubscriptionFeature_1 = require("../modules/subscription/models/SubscriptionFeature");
const SubscriptionProfileFeature_1 = require("../modules/subscription/models/SubscriptionProfileFeature");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apexbee';
const seedThreeTierSubscriptionSystem = async () => {
    try {
        if (mongoose_1.default.connection.readyState !== 1) {
            await mongoose_1.default.connect(MONGODB_URI);
            console.log('[Seed] Connected to MongoDB for Three-Tier Subscription Seeding.');
        }
        console.log('[Seed Step 1] Seeding Master Features for all 15 Business Categories...');
        const masterFeatureDefs = [
            // Common
            { key: 'BUSINESS_PROFILE', name: 'Digital Storefront & Business Profile', category: 'CORE', valueType: 'BOOLEAN' },
            { key: 'MAX_BRANCHES', name: 'Maximum Business Locations / Outlets', category: 'BRANCHES', valueType: 'COUNT' },
            { key: 'MAX_STAFF_USERS', name: 'Maximum Staff User Accounts', category: 'STAFF', valueType: 'COUNT' },
            { key: 'MONTHLY_TRANSACTIONS', name: 'Monthly Transaction Limit', category: 'ORDERS', valueType: 'COUNT' },
            { key: 'ADVANCED_REPORTS', name: 'Advanced BI Analytics & Reports', category: 'REPORTS', valueType: 'BOOLEAN' },
            { key: 'CUSTOMER_CRM', name: 'Customer Relationship Management (CRM)', category: 'CRM', valueType: 'BOOLEAN' },
            // Food & Dining
            { key: 'MAX_MENU_ITEMS', name: 'Maximum Restaurant Menu Items', category: 'POS', valueType: 'COUNT' },
            { key: 'KITCHEN_DISPLAY_SYSTEM', name: 'Kitchen Display System (KDS)', category: 'POS', valueType: 'BOOLEAN' },
            { key: 'TABLE_MANAGEMENT', name: 'Table Reservation & Floor Management', category: 'POS', valueType: 'BOOLEAN' },
            { key: 'MONTHLY_RESTAURANT_ORDERS', name: 'Monthly Restaurant Orders', category: 'ORDERS', valueType: 'COUNT' },
            // Daily Needs & Grocery
            { key: 'MAX_PRODUCTS', name: 'Maximum Product Listings', category: 'CATALOGUE', valueType: 'COUNT' },
            { key: 'BARCODE_MANAGEMENT', name: 'Barcode Generator & Scanner POS', category: 'POS', valueType: 'BOOLEAN' },
            { key: 'SUBSCRIPTION_DELIVERY', name: 'Daily Subscription Delivery Engine', category: 'DELIVERY', valueType: 'BOOLEAN' },
            { key: 'BATCH_EXPIRY_TRACKING', name: 'Batch & Expiry Date Tracking', category: 'CATALOGUE', valueType: 'BOOLEAN' },
            // Devotional
            { key: 'POOJA_KITS_BUILDER', name: 'Custom Pooja Kit Builder', category: 'CATALOGUE', valueType: 'BOOLEAN' },
            { key: 'FESTIVAL_COMBOS', name: 'Festival Combo Management', category: 'CATALOGUE', valueType: 'BOOLEAN' },
            // Services
            { key: 'MAX_SERVICE_LISTINGS', name: 'Maximum Service Offerings', category: 'CORE', valueType: 'COUNT' },
            { key: 'APPOINTMENT_SLOTS', name: 'Online Booking & Time Slot Engine', category: 'CORE', valueType: 'BOOLEAN' },
            // Academy
            { key: 'MAX_COURSES', name: 'Maximum Online Courses', category: 'CORE', valueType: 'COUNT' },
            { key: 'VIDEO_STORAGE_MB', name: 'Video Hosting Storage (MB)', category: 'STORAGE', valueType: 'STORAGE' },
            { key: 'LIVE_CLASS_ACCESS', name: 'Live Video Class Integration', category: 'CORE', valueType: 'BOOLEAN' }
        ];
        const featureIdMap = {};
        for (const f of masterFeatureDefs) {
            const feat = await SubscriptionFeature_1.SubscriptionFeature.findOneAndUpdate({ key: f.key }, { ...f, status: 'ACTIVE' }, { upsert: true, new: true });
            featureIdMap[f.key] = feat._id;
        }
        console.log('[Seed Step 2] Seeding Three Master Tiers (Starter, Business, Premium)...');
        const tiers = [
            { code: 'APEXBEE_STARTER', name: 'Starter', tierLevel: 1, description: 'Essential tools for new and small vendors on ApexBee', sortOrder: 1 },
            { code: 'APEXBEE_BUSINESS', name: 'Business', tierLevel: 2, description: 'Comprehensive tools for growing vendors with regular activity', sortOrder: 2 },
            { code: 'APEXBEE_PREMIUM', name: 'Premium', tierLevel: 3, description: 'Advanced multi-location automation suite for enterprise vendors', sortOrder: 3 }
        ];
        const tierIdMap = {};
        for (const t of tiers) {
            const tierDoc = await SubscriptionPlanTier_1.SubscriptionPlanTier.findOneAndUpdate({ code: t.code }, { ...t, status: 'ACTIVE' }, { upsert: true, new: true });
            tierIdMap[t.code] = tierDoc._id;
        }
        console.log('[Seed Step 3] Seeding Category Plan Profiles and Prices for 15 Categories...');
        const categoryDefinitions = [
            {
                code: 'FOOD_AND_DINING',
                displayNamePrefix: 'Restaurant',
                prices: { starter: { m: 0, y: 0 }, business: { m: 999, y: 9990 }, premium: { m: 1999, y: 19990 } },
                starterLimits: { MAX_BRANCHES: 1, MAX_STAFF_USERS: 2, MAX_MENU_ITEMS: 50, MONTHLY_RESTAURANT_ORDERS: 100 },
                businessLimits: { MAX_BRANCHES: 2, MAX_STAFF_USERS: 10, MAX_MENU_ITEMS: 500, MONTHLY_RESTAURANT_ORDERS: 3000, KITCHEN_DISPLAY_SYSTEM: true, TABLE_MANAGEMENT: true },
                premiumLimits: { MAX_BRANCHES: 5, MAX_STAFF_USERS: 50, MAX_MENU_ITEMS: null, MONTHLY_RESTAURANT_ORDERS: 20000, KITCHEN_DISPLAY_SYSTEM: true, TABLE_MANAGEMENT: true, ADVANCED_REPORTS: true, CUSTOMER_CRM: true }
            },
            {
                code: 'DAILY_NEEDS',
                displayNamePrefix: 'Grocery',
                prices: { starter: { m: 0, y: 0 }, business: { m: 999, y: 9990 }, premium: { m: 1999, y: 19990 } },
                starterLimits: { MAX_BRANCHES: 1, MAX_STAFF_USERS: 2, MAX_PRODUCTS: 100, MONTHLY_TRANSACTIONS: 200 },
                businessLimits: { MAX_BRANCHES: 3, MAX_STAFF_USERS: 15, MAX_PRODUCTS: 2000, MONTHLY_TRANSACTIONS: 5000, BARCODE_MANAGEMENT: true, SUBSCRIPTION_DELIVERY: true },
                premiumLimits: { MAX_BRANCHES: 10, MAX_STAFF_USERS: 75, MAX_PRODUCTS: null, MONTHLY_TRANSACTIONS: 30000, BARCODE_MANAGEMENT: true, SUBSCRIPTION_DELIVERY: true, BATCH_EXPIRY_TRACKING: true, ADVANCED_REPORTS: true }
            },
            {
                code: 'DEVOTIONAL',
                displayNamePrefix: 'Devotional',
                prices: { starter: { m: 0, y: 0 }, business: { m: 499, y: 4990 }, premium: { m: 999, y: 9990 } },
                starterLimits: { MAX_BRANCHES: 1, MAX_STAFF_USERS: 2, MAX_PRODUCTS: 50, MONTHLY_TRANSACTIONS: 100 },
                businessLimits: { MAX_BRANCHES: 2, MAX_STAFF_USERS: 10, MAX_PRODUCTS: 750, MONTHLY_TRANSACTIONS: 2500, POOJA_KITS_BUILDER: true, FESTIVAL_COMBOS: true },
                premiumLimits: { MAX_BRANCHES: 5, MAX_STAFF_USERS: 40, MAX_PRODUCTS: null, MONTHLY_TRANSACTIONS: 15000, POOJA_KITS_BUILDER: true, FESTIVAL_COMBOS: true, ADVANCED_REPORTS: true }
            },
            {
                code: 'SERVICES',
                displayNamePrefix: 'Service Provider',
                prices: { starter: { m: 0, y: 0 }, business: { m: 699, y: 6990 }, premium: { m: 1499, y: 14990 } },
                starterLimits: { MAX_BRANCHES: 1, MAX_STAFF_USERS: 2, MAX_SERVICE_LISTINGS: 20, MONTHLY_TRANSACTIONS: 100 },
                businessLimits: { MAX_BRANCHES: 3, MAX_STAFF_USERS: 20, MAX_SERVICE_LISTINGS: 250, MONTHLY_TRANSACTIONS: 3000, APPOINTMENT_SLOTS: true },
                premiumLimits: { MAX_BRANCHES: 10, MAX_STAFF_USERS: 100, MAX_SERVICE_LISTINGS: null, MONTHLY_TRANSACTIONS: 20000, APPOINTMENT_SLOTS: true, ADVANCED_REPORTS: true, CUSTOMER_CRM: true }
            },
            {
                code: 'ACADEMY',
                displayNamePrefix: 'Academy',
                prices: { starter: { m: 0, y: 0 }, business: { m: 999, y: 9990 }, premium: { m: 2499, y: 24990 } },
                starterLimits: { MAX_BRANCHES: 1, MAX_STAFF_USERS: 2, MAX_COURSES: 3, VIDEO_STORAGE_MB: 2048 },
                businessLimits: { MAX_BRANCHES: 2, MAX_STAFF_USERS: 20, MAX_COURSES: 50, VIDEO_STORAGE_MB: 102400, LIVE_CLASS_ACCESS: true },
                premiumLimits: { MAX_BRANCHES: 5, MAX_STAFF_USERS: 100, MAX_COURSES: null, VIDEO_STORAGE_MB: 1048576, LIVE_CLASS_ACCESS: true, ADVANCED_REPORTS: true }
            }
        ];
        for (const cat of categoryDefinitions) {
            for (const tierCode of ['APEXBEE_STARTER', 'APEXBEE_BUSINESS', 'APEXBEE_PREMIUM']) {
                const tierName = tierCode === 'APEXBEE_STARTER' ? 'Starter' : tierCode === 'APEXBEE_BUSINESS' ? 'Business' : 'Premium';
                const displayName = `${cat.displayNamePrefix} ${tierName}`;
                const profile = await SubscriptionPlanProfile_1.SubscriptionPlanProfile.findOneAndUpdate({ tierCode, categoryCode: cat.code }, {
                    tierId: tierIdMap[tierCode],
                    tierCode,
                    categoryCode: cat.code,
                    displayName,
                    shortDescription: `${displayName} for ${cat.displayNamePrefix} Vendors`,
                    isPublic: true,
                    status: 'ACTIVE'
                }, { upsert: true, new: true });
                // Prices
                const pKey = tierCode === 'APEXBEE_STARTER' ? 'starter' : tierCode === 'APEXBEE_BUSINESS' ? 'business' : 'premium';
                const priceInfo = cat.prices[pKey];
                await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOneAndUpdate({ profileId: profile._id, billingCycle: 'MONTHLY' }, {
                    profileId: profile._id,
                    billingCycle: 'MONTHLY',
                    originalAmount: priceInfo.m,
                    gstRate: priceInfo.m > 0 ? 18 : 0,
                    taxMode: priceInfo.m > 0 ? 'EXCLUSIVE' : 'NOT_APPLICABLE',
                    isActive: true
                }, { upsert: true });
                await SubscriptionProfilePrice_1.SubscriptionProfilePrice.findOneAndUpdate({ profileId: profile._id, billingCycle: 'YEARLY' }, {
                    profileId: profile._id,
                    billingCycle: 'YEARLY',
                    originalAmount: priceInfo.y,
                    gstRate: priceInfo.y > 0 ? 18 : 0,
                    taxMode: priceInfo.y > 0 ? 'EXCLUSIVE' : 'NOT_APPLICABLE',
                    isActive: true
                }, { upsert: true });
                // Features & Limits
                const limitsObj = tierCode === 'APEXBEE_STARTER' ? cat.starterLimits : tierCode === 'APEXBEE_BUSINESS' ? cat.businessLimits : cat.premiumLimits;
                for (const [featKey, val] of Object.entries(limitsObj)) {
                    if (featureIdMap[featKey]) {
                        await SubscriptionProfileFeature_1.SubscriptionProfileFeature.findOneAndUpdate({ profileId: profile._id, featureId: featureIdMap[featKey] }, {
                            profileId: profile._id,
                            featureId: featureIdMap[featKey],
                            featureKey: featKey,
                            enabled: val === false ? false : true,
                            limitValue: typeof val === 'number' ? val : null
                        }, { upsert: true });
                    }
                }
            }
        }
        console.log('[Seed] Universal Three-Plan Seed System Completed Successfully.');
        return true;
    }
    catch (error) {
        console.error('[Seed Error] Failed seeding three-tier subscription system:', error);
        throw error;
    }
};
exports.seedThreeTierSubscriptionSystem = seedThreeTierSubscriptionSystem;
if (require.main === module) {
    (0, exports.seedThreeTierSubscriptionSystem)().then(() => process.exit(0)).catch(() => process.exit(1));
}
