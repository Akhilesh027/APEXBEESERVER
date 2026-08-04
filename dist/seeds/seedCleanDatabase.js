"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCleanDatabase = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const seedCoreTaxonomies_1 = require("./seedCoreTaxonomies");
const seedThreeTierSubscriptionSystem_1 = require("./seedThreeTierSubscriptionSystem");
const seedSubscriptionData_1 = require("./seedSubscriptionData");
const removeSeededProducts_1 = require("../scripts/removeSeededProducts");
dotenv_1.default.config();
const seedCleanDatabase = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(mongoURI);
            console.log('[seedCleanDatabase] Connected to MongoDB.');
        }
        console.log('\n======================================================');
        console.log('🚀 SEEDING CLEAN APEXBEE DATABASE (NO MOCK PRODUCTS)');
        console.log('======================================================\n');
        // 1. Seed Core Category Taxonomies (Restaurant, Grocery, Devotional, Services, Academy, Shopping)
        console.log('📦 Step 1: Seeding Category Taxonomies & Schemas...');
        await (0, seedCoreTaxonomies_1.seedCoreTaxonomies)({ dryRun: false });
        // 2. Seed 3-Tier Subscription Profiles & Entitlements
        console.log('\n💳 Step 2: Seeding 3-Tier Vendor Subscription Profiles & Entitlements...');
        await (0, seedThreeTierSubscriptionSystem_1.seedThreeTierSubscriptionSystem)();
        await (0, seedSubscriptionData_1.seedSubscriptionData)();
        // 3. Purge any stray seeded products
        console.log('\n🧹 Step 3: Purging dummy/seeded products...');
        await (0, removeSeededProducts_1.removeSeededProducts)();
        console.log('\n======================================================');
        console.log('✅ CLEAN DATABASE SEEDING COMPLETED SUCCESSFULLY!');
        console.log('   - Essential Categories & Taxonomies Ready');
        console.log('   - 3-Tier Subscription System Active');
        console.log('   - Zero Dummy Products in Database');
        console.log('======================================================\n');
        return { success: true };
    }
    catch (err) {
        console.error('[seedCleanDatabase Error]:', err);
        return { success: false, error: err.message };
    }
};
exports.seedCleanDatabase = seedCleanDatabase;
const runCLI = async () => {
    if (require.main === module) {
        const result = await (0, exports.seedCleanDatabase)();
        process.exit(result.success ? 0 : 1);
    }
};
runCLI();
