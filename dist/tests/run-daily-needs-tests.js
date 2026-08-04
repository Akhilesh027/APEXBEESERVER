"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyNeedsTests = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Category_1 = __importDefault(require("../models/Category"));
const seedDailyNeedsTaxonomy_1 = require("../seeds/seedDailyNeedsTaxonomy");
const seedCoreTaxonomies_1 = require("../seeds/seedCoreTaxonomies");
const verifyDailyNeedsTaxonomy_1 = require("../seeds/verifyDailyNeedsTaxonomy");
const schemaResolutionService_1 = require("../services/catalogue/schemaResolutionService");
const pricingService_1 = require("../services/catalogue/pricingService");
dotenv_1.default.config();
let passedCount = 0;
let failedCount = 0;
const assert = (condition, message) => {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passedCount++;
    }
    else {
        console.error(`  ❌ FAIL: ${message}`);
        failedCount++;
    }
};
const runDailyNeedsTests = async () => {
    console.log('=====================================================================');
    console.log('[Test Suite] ApexBee Daily Needs Category & Schema Verification');
    console.log('=====================================================================');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose_1.default.connect(mongoURI);
    console.log('Connected to MongoDB for testing.');
    // 1. Run Seed Daily Needs Taxonomy
    console.log('\n--- Test 1: Daily Needs Seeding Execution ---');
    const seedResult = await (0, seedDailyNeedsTaxonomy_1.seedDailyNeedsTaxonomy)();
    assert(seedResult.parentCount === 1, 'Daily Needs Parent count = 1');
    assert(seedResult.subCount === 6, 'Daily Needs Subcategories = 6');
    assert(seedResult.childCount === 78, 'Daily Needs Child Categories = 78');
    assert(seedResult.schemaCount === 84, 'Daily Needs CategoryProductSchemas = 84');
    // 2. Daily Needs Verification Script Integrity
    console.log('\n--- Test 2: Daily Needs Verification Script ---');
    const verification = await (0, verifyDailyNeedsTaxonomy_1.verifyDailyNeedsTaxonomy)();
    assert(verification.parentCount === 1, 'Verification script confirmed parent count = 1');
    assert(verification.subCount === 6, 'Verification script confirmed subcategory count = 6');
    assert(verification.childCount === 78, 'Verification script confirmed child category count = 78');
    assert(verification.schemaCount === 84, 'Verification script confirmed schema count = 84');
    assert(verification.duplicateSlugs === 0, 'Verification script confirmed zero duplicate slugs');
    assert(verification.orphans === 0, 'Verification script confirmed zero orphan categories');
    // 3. Core Combined Taxonomy Seeding & Verification
    console.log('\n--- Test 3: Combined Core Taxonomies Seeding (Devotional + Restaurant + Daily Needs) ---');
    await (0, seedCoreTaxonomies_1.seedCoreTaxonomies)();
    const coreResult = await (0, seedCoreTaxonomies_1.verifyCoreTaxonomies)();
    assert(coreResult.passed, 'Combined core verification passed');
    assert(coreResult.combined.parents === 3, `Combined Parents = 3 (actual: ${coreResult.combined.parents})`);
    assert(coreResult.combined.subcategories === 28, `Combined Subcategories = 28 (actual: ${coreResult.combined.subcategories})`);
    assert(coreResult.combined.childCategories === 384, `Combined Child Categories = 384 (actual: ${coreResult.combined.childCategories})`);
    assert(coreResult.combined.schemas === 412, `Combined Category Schemas = 412 (actual: ${coreResult.combined.schemas})`);
    // 4. Idempotency Verification
    console.log('\n--- Test 4: Idempotency Verification ---');
    const parentBefore = await Category_1.default.findOne({ slug: 'daily-needs' });
    await (0, seedDailyNeedsTaxonomy_1.seedDailyNeedsTaxonomy)();
    const parentAfter = await Category_1.default.findOne({ slug: 'daily-needs' });
    assert(parentBefore?._id.toString() === parentAfter?._id.toString(), 'Daily Needs Parent ID preserved across consecutive seeder runs');
    // 5. Dynamic Schema Resolution Tests across sample child categories
    console.log('\n--- Test 5: Dynamic Schema Resolution for Daily Needs Families ---');
    const testChildren = [
        { name: 'Leafy Greens', expectedMode: 'fresh' },
        { name: 'Cow Milk', expectedMode: 'fresh' },
        { name: 'Rice and Grains', expectedMode: 'standard' },
        { name: 'Returnable Water Cans', expectedMode: 'standard' },
        { name: 'Cold Pressed Oils', expectedMode: 'standard' },
        { name: 'Fresh Eggs', expectedMode: 'fresh' },
        { name: 'Chicken Cuts', expectedMode: 'fresh' },
        { name: 'Freshwater Fish', expectedMode: 'fresh' },
        { name: 'Prawns and Shrimp', expectedMode: 'fresh' },
        { name: 'Wholesale Fresh Produce', expectedMode: 'wholesale' },
        { name: 'Subscription Essentials', expectedMode: 'subscription' },
    ];
    for (const item of testChildren) {
        const cat = await Category_1.default.findOne({ name: item.name, level: 3 });
        assert(cat !== null, `Child category '${item.name}' exists in DB`);
        if (cat) {
            const resolved = await (0, schemaResolutionService_1.resolveCategorySchema)(cat._id.toString()).catch(() => null);
            assert(resolved !== null, `Schema resolved for '${item.name}'`);
            if (resolved) {
                assert(resolved.productMode === item.expectedMode, `Product mode for '${item.name}' matches '${item.expectedMode}' (got '${resolved.productMode}')`);
                assert(resolved.attributes.length > 0, `'${item.name}' resolved schema has non-empty attributes (${resolved.attributes.length})`);
            }
        }
    }
    // 6. Schema Payload Validation Tests
    console.log('\n--- Test 6: Payload Validation Tests ---');
    const chickenCat = await Category_1.default.findOne({ name: 'Chicken Cuts', level: 3 });
    if (chickenCat) {
        const schema = await (0, schemaResolutionService_1.resolveCategorySchema)(chickenCat._id.toString());
        const validPayload = {
            meat_or_seafood_type: 'Chicken',
            fresh_or_frozen: 'Fresh (Chilled)',
            selling_unit: '500 g',
            storage_temperature: 'chilled',
            cut_type: 'Curry Cut',
        };
        const validCheck = (0, schemaResolutionService_1.validatePayloadAgainstSchema)(validPayload, schema);
        assert(validCheck.isValid, 'Valid Chicken Cuts payload passed schema validation');
        const invalidPayload = {
            meat_or_seafood_type: 'Pork', // invalid option
            fresh_or_frozen: 'Fresh (Chilled)',
        };
        const invalidCheck = (0, schemaResolutionService_1.validatePayloadAgainstSchema)(invalidPayload, schema);
        assert(!invalidCheck.isValid, 'Invalid Chicken Cuts payload correctly rejected');
    }
    // 7. Server-Side Weight Pricing Recalculation Tests
    console.log('\n--- Test 7: Server-Side Weight & Deposit Pricing Calculation ---');
    // Weight pricing: ₹60 per kg for 750 g => ₹45
    const weightCalc = (0, pricingService_1.calculateServerSidePrice)({
        pricingMode: 'weight',
        unitPrice: 60,
        baseUnit: 'kg',
        selectedQuantity: 750,
        selectedUnit: 'g',
    });
    assert(weightCalc.isValid, 'Weight pricing calculation is valid');
    assert(weightCalc.finalPrice === 45, `Weight pricing: 750g @ ₹60/kg = ₹45 (actual: ₹${weightCalc.finalPrice})`);
    // Deposit pricing: ₹80 per 20L can + ₹150 deposit = ₹230 total per can for 2 cans => ₹460
    const depositCalc = (0, pricingService_1.calculateServerSidePrice)({
        pricingMode: 'deposit_plus_product',
        unitPrice: 80,
        selectedQuantity: 2,
        depositAmount: 150,
    });
    assert(depositCalc.isValid, 'Deposit pricing calculation is valid');
    assert(depositCalc.finalPrice === 460, `Deposit pricing: 2 cans @ (₹80 product + ₹150 deposit) = ₹460 (actual: ₹${depositCalc.finalPrice})`);
    assert(depositCalc.depositAmount === 300, `Deposit component = ₹300 (actual: ₹${depositCalc.depositAmount})`);
    console.log('=====================================================================');
    console.log(`[Test Suite Completed] Total Passed: ${passedCount}, Total Failed: ${failedCount}`);
    console.log('=====================================================================');
    return { passedCount, failedCount };
};
exports.runDailyNeedsTests = runDailyNeedsTests;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const res = await (0, exports.runDailyNeedsTests)();
            process.exit(res.failedCount === 0 ? 0 : 1);
        }
        catch (err) {
            console.error('Test execution error:', err);
            process.exit(1);
        }
    }
};
runDirect();
