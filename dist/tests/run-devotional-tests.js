"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const assert_1 = __importDefault(require("assert"));
const Category_1 = __importDefault(require("../models/Category"));
const VendorCategoryAccess_1 = __importDefault(require("../models/VendorCategoryAccess"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const Product_1 = __importDefault(require("../models/Product"));
const seedDevotionalTaxonomy_1 = require("../seeds/seedDevotionalTaxonomy");
const schemaResolutionService_1 = require("../services/devotional/schemaResolutionService");
const backfillVendorCategoryAccess_1 = require("../seeds/backfillVendorCategoryAccess");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runDevotionalTests() {
    const startTime = Date.now();
    console.log('======================================================');
    console.log('DEVOTIONAL VERTICAL MILESTONE 1 AUTOMATED TEST SUITE');
    console.log('======================================================');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Connecting to database: ${MONGO_URI}\n`);
    await mongoose_1.default.connect(MONGO_URI);
    let executedCount = 0;
    let passedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const testResults = [];
    const runSingleTest = async (name, fn) => {
        executedCount++;
        const t0 = Date.now();
        try {
            await fn();
            passedCount++;
            const durationMs = Date.now() - t0;
            testResults.push({ name, status: 'PASS', durationMs });
            console.log(`[PASS] ${name} (${durationMs}ms)`);
        }
        catch (err) {
            failedCount++;
            const durationMs = Date.now() - t0;
            testResults.push({ name, status: 'FAIL', durationMs, error: err.message });
            console.error(`[FAIL] ${name} (${durationMs}ms)`);
            console.error(`       Error: ${err.message}`);
        }
    };
    try {
        // TEST 1: Seed Devotional Taxonomy & Verify Counts
        await runSingleTest('1. Seed Devotional Taxonomy (1 Parent, 11 Subcategories, 190 Child Categories)', async () => {
            const res = await (0, seedDevotionalTaxonomy_1.seedDevotionalTaxonomy)();
            assert_1.default.strictEqual(res.parentCount, 1);
            assert_1.default.strictEqual(res.subCount, 11);
            assert_1.default.strictEqual(res.childCount, 190);
            const parentDoc = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            assert_1.default.ok(parentDoc);
            const subDocs = await Category_1.default.find({ parentId: parentDoc._id, level: 2 });
            assert_1.default.strictEqual(subDocs.length, 11);
            const subIds = subDocs.map(s => s._id);
            const childDocs = await Category_1.default.find({ parentId: { $in: subIds }, level: 3 });
            assert_1.default.strictEqual(childDocs.length, 190);
        });
        // TEST 2: Seed Rerun Idempotency Check
        await runSingleTest('2. Verify Taxonomy Seed Rerun Idempotency', async () => {
            await (0, seedDevotionalTaxonomy_1.seedDevotionalTaxonomy)();
            const parentDoc = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            const subDocs = await Category_1.default.find({ parentId: parentDoc?._id, level: 2 });
            const subIds = subDocs.map(s => s._id);
            const childDocs = await Category_1.default.find({ parentId: { $in: subIds }, level: 3 });
            assert_1.default.strictEqual(subDocs.length, 11);
            assert_1.default.strictEqual(childDocs.length, 190);
        });
        // TEST 3: Category Schema Resolution & Inheritance
        await runSingleTest('3. Test CategoryProductSchema Resolution & Inheritance', async () => {
            const childDoc = await Category_1.default.findOne({ slug: 'devotional-pooja-essentials-agarbatti' });
            assert_1.default.ok(childDoc);
            const resolved = await (0, schemaResolutionService_1.resolveCategorySchema)(childDoc._id.toString());
            assert_1.default.ok(resolved);
            assert_1.default.strictEqual(resolved.productMode, 'standard');
            const fragranceAttr = resolved.attributes.find(a => a.key === 'fragrance');
            assert_1.default.ok(fragranceAttr);
            assert_1.default.strictEqual(fragranceAttr.required, true);
        });
        // TEST 4: Category Payload Attribute Validation
        await runSingleTest('4. Validate Payload Against Schema (Required Attribute Check)', async () => {
            const childDoc = await Category_1.default.findOne({ slug: 'devotional-pooja-essentials-agarbatti' });
            assert_1.default.ok(childDoc);
            const resolved = await (0, schemaResolutionService_1.resolveCategorySchema)(childDoc._id.toString());
            assert_1.default.ok(resolved, 'Schema should be resolved for this test category');
            // Missing required 'fragrance'
            const invalidPayload = { pack_count: 10 };
            const valFail = (0, schemaResolutionService_1.validatePayloadAgainstSchema)(invalidPayload, resolved);
            assert_1.default.strictEqual(valFail.isValid, false);
            assert_1.default.ok(valFail.errors.some(e => e.includes('fragrance')));
            // Valid payload
            const validPayload = { fragrance: 'Sandalwood', pack_count: 50 };
            const valPass = (0, schemaResolutionService_1.validatePayloadAgainstSchema)(validPayload, resolved);
            assert_1.default.strictEqual(valPass.isValid, true);
        });
        // TEST 5: VendorCategoryAccess Permission & Capability Guards
        await runSingleTest('5. Verify VendorCategoryAccess Capability Restriction Guards', async () => {
            const testUser = new User_1.User({
                name: 'Devotional Test Vendor',
                email: `dev_vendor_${Date.now()}@test.com`,
                passwordHash: 'hash',
                phone: '9999999999',
                roles: ['vendor'],
            });
            await testUser.save();
            const testVendor = new Vendor_1.Vendor({
                userId: testUser._id,
                businessName: 'Flower Shop Only Store',
                ownerName: 'Test Owner',
                mobile: '9999999999',
                email: testUser.email,
                address: '123 Temple St',
                pincode: '500001',
                primaryCategory: 'devotional',
                storeType: 'devotional',
            });
            await testVendor.save();
            const devParent = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            assert_1.default.ok(devParent);
            // Create access record approved ONLY for flower_shop
            const flowerSub = await Category_1.default.findOne({ slug: 'devotional-flowers-garlands' });
            assert_1.default.ok(flowerSub);
            const access = new VendorCategoryAccess_1.default({
                vendorId: testVendor._id,
                storeId: testVendor._id,
                parentCategoryId: devParent._id,
                requestedCapabilities: ['flower_shop'],
                approvedCapabilities: ['flower_shop'],
                approvedSubcategoryIds: [flowerSub._id],
                approvedChildCategoryIds: [],
                approvedItemTypes: ['product'],
                status: 'approved',
                restrictions: {
                    canCreateProducts: true,
                    canCreateServices: false,
                    canJoinFestivalCombos: true,
                    canAcceptBulkOrders: false,
                    canSellWholesale: false,
                    canOfferSubscriptions: false,
                },
            });
            await access.save();
            // Verify vendor has access to flower subcategory
            const checkAccess = await VendorCategoryAccess_1.default.findOne({ vendorId: testVendor._id, status: 'approved' });
            assert_1.default.ok(checkAccess);
            assert_1.default.strictEqual(checkAccess.approvedCapabilities.includes('flower_shop'), true);
            assert_1.default.strictEqual(checkAccess.approvedCapabilities.includes('photo_frame_shop'), false);
            // Cleanup test vendor documents
            await VendorCategoryAccess_1.default.deleteOne({ _id: access._id });
            await Vendor_1.Vendor.deleteOne({ _id: testVendor._id });
            await User_1.User.deleteOne({ _id: testUser._id });
        });
        // TEST 6: Vendor Access Backfill Script
        await runSingleTest('6. Execute Vendor Category Access Backfill Script', async () => {
            const result = await (0, backfillVendorCategoryAccess_1.backfillVendorCategoryAccess)(true); // dry-run
            assert_1.default.ok(result.inspected >= 0);
            assert_1.default.strictEqual(result.isDryRun, true);
        });
        // TEST 7: Devotional Product Masters Seeding
        await runSingleTest('7. Seed Devotional Product Masters & Catalogue Variants', async () => {
            const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
            const res = await seedDevotionalProducts();
            assert_1.default.strictEqual(res.success, true);
            assert_1.default.ok(res.totalDefinitions >= 40);
            assert_1.default.strictEqual(res.duplicateSeedKeys, 0);
            assert_1.default.strictEqual(res.orphanProducts, 0);
            assert_1.default.strictEqual(res.accidentalStoreProducts, 0);
            const systemCount = await Product_1.default.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });
            assert_1.default.ok(systemCount >= 40);
        });
        // TEST 8: Devotional Product Seeding Idempotency Check (Second Run)
        await runSingleTest('8. Verify Devotional Product Seeding Idempotency (Second Run)', async () => {
            const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
            const countBefore = await Product_1.default.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });
            const res = await seedDevotionalProducts();
            assert_1.default.strictEqual(res.success, true);
            assert_1.default.strictEqual(res.insertedProducts, 0); // 0 new inserts on rerun!
            assert_1.default.strictEqual(res.duplicateSeedKeys, 0);
            const countAfter = await Product_1.default.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });
            assert_1.default.strictEqual(countBefore, countAfter);
        });
        // TEST 9: Preserving Existing Data / Vendor Price & Stock Integrity
        await runSingleTest('9. Verify Preservation of Vendor-Controlled Prices and Stock', async () => {
            const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
            // Create a vendor store product with custom pricing
            const devParent = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            assert_1.default.ok(devParent);
            const testVendorProd = new Product_1.default({
                name: 'Vendor Custom Agarbatti Pack',
                slug: `vendor-custom-agarbatti-${Date.now()}`,
                description: 'Vendor specific custom listing',
                categoryId: devParent._id,
                subcategoryId: devParent._id,
                sku: `SKU-VENDOR-${Date.now()}`,
                baseMrp: 199,
                baseSellingPrice: 149,
                stock: 50,
                catalogueSource: 'vendor',
                isCatalogueMaster: false,
                isStoreProduct: true,
            });
            await testVendorProd.save();
            // Run product seed again
            await seedDevotionalProducts();
            // Verify vendor product pricing and stock remain intact
            const fetchedVendorProd = await Product_1.default.findById(testVendorProd._id);
            assert_1.default.ok(fetchedVendorProd);
            assert_1.default.strictEqual(fetchedVendorProd.baseMrp, 199);
            assert_1.default.strictEqual(fetchedVendorProd.baseSellingPrice, 149);
            assert_1.default.strictEqual(fetchedVendorProd.stock, 50);
            // Cleanup
            await Product_1.default.deleteOne({ _id: testVendorProd._id });
        });
        console.log('\n======================================================');
        console.log('DEVOTIONAL VERTICAL TEST SUITE EXECUTION SUMMARY');
        console.log('======================================================');
        console.log(`Total Executed: ${executedCount}`);
        console.log(`Passed:         ${passedCount}`);
        console.log(`Failed:         ${failedCount}`);
        console.log(`Skipped:        ${skippedCount}`);
        console.log(`Total Duration: ${Date.now() - startTime}ms`);
        console.log('======================================================');
        if (failedCount > 0) {
            process.exit(1);
        }
        else {
            process.exit(0);
        }
    }
    catch (err) {
        console.error('Fatal Test Runner Error:', err);
        process.exit(1);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
runDevotionalTests();
