import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';

import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import Product from '../models/Product';
import { seedDevotionalTaxonomy, DEVOTIONAL_TAXONOMY } from '../seeds/seedDevotionalTaxonomy';
import { resolveCategorySchema, validatePayloadAgainstSchema } from '../services/devotional/schemaResolutionService';
import { backfillVendorCategoryAccess } from '../seeds/backfillVendorCategoryAccess';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runDevotionalTests() {
  const startTime = Date.now();
  console.log('======================================================');
  console.log('DEVOTIONAL VERTICAL MILESTONE 1 AUTOMATED TEST SUITE');
  console.log('======================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Connecting to database: ${MONGO_URI}\n`);

  await mongoose.connect(MONGO_URI);

  let executedCount = 0;
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const testResults: Array<{ name: string; status: 'PASS' | 'FAIL' | 'SKIP'; durationMs: number; error?: string }> = [];

  const runSingleTest = async (name: string, fn: () => Promise<void>) => {
    executedCount++;
    const t0 = Date.now();
    try {
      await fn();
      passedCount++;
      const durationMs = Date.now() - t0;
      testResults.push({ name, status: 'PASS', durationMs });
      console.log(`[PASS] ${name} (${durationMs}ms)`);
    } catch (err: any) {
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
      const res = await seedDevotionalTaxonomy();
      assert.strictEqual(res.parentCount, 1);
      assert.strictEqual(res.subCount, 11);
      assert.strictEqual(res.childCount, 190);

      const parentDoc = await Category.findOne({ slug: 'devotional', level: 1 });
      assert.ok(parentDoc);

      const subDocs = await Category.find({ parentId: parentDoc._id, level: 2 });
      assert.strictEqual(subDocs.length, 11);

      const subIds = subDocs.map(s => s._id);
      const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
      assert.strictEqual(childDocs.length, 190);
    });

    // TEST 2: Seed Rerun Idempotency Check
    await runSingleTest('2. Verify Taxonomy Seed Rerun Idempotency', async () => {
      await seedDevotionalTaxonomy();
      const parentDoc = await Category.findOne({ slug: 'devotional', level: 1 });
      const subDocs = await Category.find({ parentId: parentDoc?._id, level: 2 });
      const subIds = subDocs.map(s => s._id);
      const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });

      assert.strictEqual(subDocs.length, 11);
      assert.strictEqual(childDocs.length, 190);
    });

    // TEST 3: Category Schema Resolution & Inheritance
    await runSingleTest('3. Test CategoryProductSchema Resolution & Inheritance', async () => {
      const childDoc = await Category.findOne({ slug: 'devotional-pooja-essentials-agarbatti' });
      assert.ok(childDoc);

      const resolved = await resolveCategorySchema(childDoc._id.toString());
      assert.ok(resolved);
      assert.strictEqual(resolved.productMode, 'standard');

      const fragranceAttr = resolved.attributes.find(a => a.key === 'fragrance');
      assert.ok(fragranceAttr);
      assert.strictEqual(fragranceAttr.required, true);
    });

    // TEST 4: Category Payload Attribute Validation
    await runSingleTest('4. Validate Payload Against Schema (Required Attribute Check)', async () => {
      const childDoc = await Category.findOne({ slug: 'devotional-pooja-essentials-agarbatti' });
      assert.ok(childDoc);
      const resolved = await resolveCategorySchema(childDoc._id.toString());

      // Missing required 'fragrance'
      const invalidPayload = { pack_count: 10 };
      const valFail = validatePayloadAgainstSchema(invalidPayload, resolved);
      assert.strictEqual(valFail.isValid, false);
      assert.ok(valFail.errors.some(e => e.includes('fragrance')));

      // Valid payload
      const validPayload = { fragrance: 'Sandalwood', pack_count: 50 };
      const valPass = validatePayloadAgainstSchema(validPayload, resolved);
      assert.strictEqual(valPass.isValid, true);
    });

    // TEST 5: VendorCategoryAccess Permission & Capability Guards
    await runSingleTest('5. Verify VendorCategoryAccess Capability Restriction Guards', async () => {
      const testUser = new User({
        name: 'Devotional Test Vendor',
        email: `dev_vendor_${Date.now()}@test.com`,
        passwordHash: 'hash',
        phone: '9999999999',
        roles: ['vendor'],
      });
      await testUser.save();

      const testVendor = new Vendor({
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

      const devParent = await Category.findOne({ slug: 'devotional', level: 1 });
      assert.ok(devParent);

      // Create access record approved ONLY for flower_shop
      const flowerSub = await Category.findOne({ slug: 'devotional-flowers-garlands' });
      assert.ok(flowerSub);

      const access = new VendorCategoryAccess({
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
      const checkAccess = await VendorCategoryAccess.findOne({ vendorId: testVendor._id, status: 'approved' });
      assert.ok(checkAccess);
      assert.strictEqual(checkAccess.approvedCapabilities.includes('flower_shop'), true);
      assert.strictEqual(checkAccess.approvedCapabilities.includes('photo_frame_shop'), false);

      // Cleanup test vendor documents
      await VendorCategoryAccess.deleteOne({ _id: access._id });
      await Vendor.deleteOne({ _id: testVendor._id });
      await User.deleteOne({ _id: testUser._id });
    });

    // TEST 6: Vendor Access Backfill Script
    await runSingleTest('6. Execute Vendor Category Access Backfill Script', async () => {
      const result = await backfillVendorCategoryAccess(true); // dry-run
      assert.ok(result.inspected >= 0);
      assert.strictEqual(result.isDryRun, true);
    });

    // TEST 7: Devotional Product Masters Seeding
    await runSingleTest('7. Seed Devotional Product Masters & Catalogue Variants', async () => {
      const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');
      const res = await seedDevotionalProducts();
      assert.strictEqual(res.success, true);
      assert.ok(res.totalDefinitions >= 40);
      assert.strictEqual(res.duplicateSeedKeys, 0);
      assert.strictEqual(res.orphanProducts, 0);
      assert.strictEqual(res.accidentalStoreProducts, 0);

      const systemCount = await Product.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });
      assert.ok(systemCount >= 40);
    });

    // TEST 8: Devotional Product Seeding Idempotency Check (Second Run)
    await runSingleTest('8. Verify Devotional Product Seeding Idempotency (Second Run)', async () => {
      const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');
      const countBefore = await Product.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });

      const res = await seedDevotionalProducts();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.insertedProducts, 0); // 0 new inserts on rerun!
      assert.strictEqual(res.duplicateSeedKeys, 0);

      const countAfter = await Product.countDocuments({ catalogueSource: 'system', isCatalogueMaster: true });
      assert.strictEqual(countBefore, countAfter);
    });

    // TEST 9: Preserving Existing Data / Vendor Price & Stock Integrity
    await runSingleTest('9. Verify Preservation of Vendor-Controlled Prices and Stock', async () => {
      const { seedDevotionalProducts } = await import('../seeds/seedDevotionalProducts');

      // Create a vendor store product with custom pricing
      const devParent = await Category.findOne({ slug: 'devotional', level: 1 });
      assert.ok(devParent);

      const testVendorProd = new Product({
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
      const fetchedVendorProd = await Product.findById(testVendorProd._id);
      assert.ok(fetchedVendorProd);
      assert.strictEqual(fetchedVendorProd.baseMrp, 199);
      assert.strictEqual(fetchedVendorProd.baseSellingPrice, 149);
      assert.strictEqual(fetchedVendorProd.stock, 50);

      // Cleanup
      await Product.deleteOne({ _id: testVendorProd._id });
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
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runDevotionalTests();
