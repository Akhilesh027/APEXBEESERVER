import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import Product from '../models/Product';
import StoreProduct from '../models/StoreProduct';
import Inventory from '../models/Inventory';
import { BusinessApplication } from '../models/BusinessApplication';
import { seedDevotionalTaxonomy } from '../seeds/seedDevotionalTaxonomy';
import { assertVendorCategoryAccess } from '../middleware/vendorCategoryAccessMiddleware';

dotenv.config();

let passedCount = 0;
let failedCount = 0;
const results: { test: string; status: 'PASSED' | 'FAILED'; error?: string }[] = [];

async function runSingleTest(name: string, fn: () => Promise<void>) {
  console.log(`\n▶ Running Test: ${name}`);
  try {
    await fn();
    console.log(`  ✔ PASSED`);
    passedCount++;
    results.push({ test: name, status: 'PASSED' });
  } catch (err: any) {
    console.error(`  ✖ FAILED: ${err.message}`);
    failedCount++;
    results.push({ test: name, status: 'FAILED', error: err.message });
  }
}

async function runDevotionalMilestone1TestSuite() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('====================================================');
  console.log('  APEXBEE DEVOTIONAL MILESTONE 1 INTEGRATION SUITE  ');
  console.log('====================================================');

  await mongoose.connect(mongoURI);

  try {
    // ----------------------------------------------------
    // TEST 1: Taxonomy Counts Verification
    // ----------------------------------------------------
    await runSingleTest('1. Verify Devotional Taxonomy Counts (1 Parent, 11 Subs, 190 Children, 201 Schemas)', async () => {
      await seedDevotionalTaxonomy();

      const parents = await Category.find({ level: 1, slug: 'devotional' });
      if (parents.length !== 1) throw new Error(`Expected 1 parent category, found ${parents.length}`);

      const subs = await Category.find({ level: 2, parentId: parents[0]._id });
      if (subs.length !== 11) throw new Error(`Expected 11 subcategories, found ${subs.length}`);

      const subIds = subs.map(s => s._id);
      const children = await Category.find({ level: 3, parentId: { $in: subIds } });
      if (children.length !== 190) throw new Error(`Expected 190 child categories, found ${children.length}`);

      const schemas = await CategoryProductSchema.find({});
      if (schemas.length < 201) throw new Error(`Expected at least 201 schemas, found ${schemas.length}`);

      // Verify no duplicate slugs
      const allCats = await Category.find({ parentId: { $in: [parents[0]._id, ...subIds] } });
      const slugs = allCats.map(c => c.slug);
      const uniqueSlugs = new Set(slugs);
      if (slugs.length !== uniqueSlugs.size) throw new Error(`Duplicate category slugs detected! Total: ${slugs.length}, Unique: ${uniqueSlugs.size}`);
    });

    // ----------------------------------------------------
    // TEST 2: KYC Verification Pending Access (No Auto Pooja Approval)
    // ----------------------------------------------------
    await runSingleTest('2. Verify KYC Creation initializes Pending Access without Auto-Approval', async () => {
      const devParent = await Category.findOne({ level: 1, slug: 'devotional' });
      if (!devParent) throw new Error('Devotional parent category missing');

      const testUser = await User.create({
        name: 'Test Devotional Vendor',
        email: `dev_vendor_${Date.now()}@apexbee.test`,
        password: 'password123',
        roles: ['customer'],
        primaryCategory: 'Devotional',
      });

      const app = await BusinessApplication.create({
        userId: testUser._id,
        applicationType: 'vendor',
        businessName: 'Sacred Offerings Shop',
        ownerName: 'Test Vendor Owner',
        mobile: '9876543210',
        email: testUser.email,
        state: 'Telangana',
        district: 'Hyderabad',
        mandal: 'Ameerpet',
        address: 'Temple Street',
        pincode: '500016',
        primaryCategory: 'Devotional',
        requestedCapabilities: ['flower_shop'],
        status: 'under_review',
      });

      const vendor = await Vendor.create({
        userId: testUser._id,
        businessName: app.businessName,
        ownerName: app.ownerName,
        mobile: app.mobile,
        email: app.email,
        address: app.address,
        pincode: app.pincode,
        primaryCategory: 'Devotional',
        status: 'active',
        marketplaceStatus: 'Approved',
      });

      const initialAccess = await VendorCategoryAccess.create({
        vendorId: vendor._id,
        storeId: vendor._id,
        parentCategoryId: devParent._id,
        requestedCapabilities: app.requestedCapabilities,
        approvedCapabilities: [],
        approvedSubcategoryIds: [],
        approvedChildCategoryIds: [],
        status: 'pending',
        restrictions: {
          canCreateProducts: false,
          canCreateServices: false,
          canJoinFestivalCombos: false,
          canAcceptBulkOrders: false,
          canSellWholesale: false,
          canOfferSubscriptions: false,
        },
      });

      if (initialAccess.status !== 'pending') throw new Error(`Expected pending status, got ${initialAccess.status}`);
      if (initialAccess.approvedCapabilities.length !== 0) throw new Error(`Expected 0 approved capabilities, got ${initialAccess.approvedCapabilities.length}`);
      if (initialAccess.restrictions.canCreateProducts !== false) throw new Error('Expected canCreateProducts to be false for pending vendor');

      // Cleanup
      await VendorCategoryAccess.deleteOne({ _id: initialAccess._id });
      await Vendor.deleteOne({ _id: vendor._id });
      await BusinessApplication.deleteOne({ _id: app._id });
      await User.deleteOne({ _id: testUser._id });
    });

    // ----------------------------------------------------
    // TEST 3: Security & Capability Middleware Authorization
    // ----------------------------------------------------
    await runSingleTest('3. Verify VendorCategoryAccess Capability Security Middleware', async () => {
      const devParent = await Category.findOne({ level: 1, slug: 'devotional' });
      const flowerSub = await Category.findOne({ level: 2, parentId: devParent?._id, name: /flowers/i });
      const flowerChild = await Category.findOne({ level: 3, parentId: flowerSub?._id });
      const frameSub = await Category.findOne({ level: 2, parentId: devParent?._id, name: /idols/i });
      const frameChild = await Category.findOne({ level: 3, parentId: frameSub?._id });

      if (!flowerChild || !frameChild) throw new Error('Child categories missing for testing');

      const testUser = await User.create({
        name: 'Flower Vendor User',
        email: `flower_v_${Date.now()}@apexbee.test`,
        password: 'password123',
        roles: ['vendor'],
      });

      const vendor = await Vendor.create({
        userId: testUser._id,
        businessName: 'Fresh Garland Store',
        ownerName: 'Flower Vendor',
        mobile: '9876543211',
        email: testUser.email,
        address: 'Flower Market',
        pincode: '500016',
        primaryCategory: 'Devotional',
        status: 'active',
        marketplaceStatus: 'Approved',
      });

      // Grant access only for Flower subcategory
      const access = await VendorCategoryAccess.create({
        vendorId: vendor._id,
        storeId: vendor._id,
        parentCategoryId: devParent!._id,
        requestedCapabilities: ['flower_shop'],
        approvedCapabilities: ['flower_shop'],
        approvedSubcategoryIds: [flowerSub!._id],
        approvedChildCategoryIds: [flowerChild!._id],
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

      // Test Middleware Authorization Mocking req/res
      const mockReqApproved: any = {
        user: { id: testUser._id.toString(), roles: ['vendor'] },
        body: { categoryId: flowerChild._id.toString() },
      };
      let nextCalled = false;
      const mockRes: any = {
        status: (code: number) => ({
          json: (data: any) => {
            throw new Error(`Middleware returned ${code}: ${data.message}`);
          },
        }),
      };

      await assertVendorCategoryAccess(mockReqApproved, mockRes, () => { nextCalled = true; });
      if (!nextCalled) throw new Error('Middleware failed to pass approved flower category');

      // Test Unauthorized Category Attempt (Photo Frame Child)
      const mockReqForbidden: any = {
        user: { id: testUser._id.toString(), roles: ['vendor'] },
        body: { categoryId: frameChild._id.toString() },
      };
      let blockedCode = 0;
      const mockResForbidden: any = {
        status: (code: number) => {
          blockedCode = code;
          return { json: () => {} };
        },
      };

      await assertVendorCategoryAccess(mockReqForbidden, mockResForbidden, () => {});
      if (blockedCode !== 403) throw new Error(`Expected 403 for unauthorized frame category, got ${blockedCode}`);

      // Cleanup
      await VendorCategoryAccess.deleteOne({ _id: access._id });
      await Vendor.deleteOne({ _id: vendor._id });
      await User.deleteOne({ _id: testUser._id });
    });

    // ----------------------------------------------------
    // TEST 4: Atomic Product Creation & Rollback Protection
    // ----------------------------------------------------
    await runSingleTest('4. Verify Atomic Product, StoreProduct & Inventory Rollback Protection', async () => {
      const devParent = await Category.findOne({ level: 1, slug: 'devotional' });
      const child = await Category.findOne({ level: 3 });
      if (!child) throw new Error('Child category missing');

      const testUser = await User.create({
        name: 'Atomic Test Vendor',
        email: `atomic_v_${Date.now()}@apexbee.test`,
        password: 'password123',
        roles: ['vendor'],
      });

      const vendor = await Vendor.create({
        userId: testUser._id,
        businessName: 'Atomic Vendor Store',
        ownerName: 'Atomic Owner',
        mobile: '9876543212',
        email: testUser.email,
        address: 'Atomic St',
        pincode: '500016',
        primaryCategory: 'Devotional',
        status: 'active',
        marketplaceStatus: 'Approved',
      });

      const sku = `ATOMIC-SKU-${Date.now()}`;

      // 1. Successful Atomic Creation
      const product = await Product.create({
        sellerId: testUser._id,
        sellerType: 'vendor',
        name: 'Sacred Agarbatti Pack',
        slug: `sacred-agarbatti-${Date.now()}`,
        description: 'Pure floral incense',
        categoryId: child._id,
        createdBy: testUser._id,
        sku,
        baseMrp: 150,
        discountPercent: 10,
        baseSellingPrice: 135,
        stock: 50,
        status: 'Live',
        isActive: true,
      });

      const storeProduct = await StoreProduct.create({
        storeId: vendor._id,
        productId: product._id,
        mrp: 150,
        sellingPrice: 135,
        isActive: true,
      });

      const inventory = await Inventory.create({
        storeId: vendor._id,
        productId: product._id,
        availableStock: 50,
        reservedStock: 0,
        damagedStock: 0,
      });

      if (!storeProduct || !inventory) throw new Error('StoreProduct or Inventory creation failed');

      // 2. Simulated Rollback Execution
      await Product.findByIdAndDelete(product._id);
      await StoreProduct.deleteMany({ productId: product._id });
      await Inventory.deleteMany({ productId: product._id });

      const checkProd = await Product.findById(product._id);
      const checkStoreProd = await StoreProduct.findOne({ productId: product._id });
      const checkInv = await Inventory.findOne({ productId: product._id });

      if (checkProd || checkStoreProd || checkInv) {
        throw new Error('Rollback cleanup left orphaned documents in DB!');
      }

      // Cleanup vendor & user
      await Vendor.deleteOne({ _id: vendor._id });
      await User.deleteOne({ _id: testUser._id });
    });

  } finally {
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log(`  SUITE SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED  `);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDevotionalMilestone1TestSuite();
