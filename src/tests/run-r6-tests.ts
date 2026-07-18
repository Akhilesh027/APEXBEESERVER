import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import Product from '../models/Product';
import Category from '../models/Category';
import { User } from '../models/User';
import { getAllProducts } from '../controllers/productController';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runR6Tests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  const suffix = `_test_${Date.now()}`;
  const seller = new User({
    name: 'Browse Seller',
    email: `seller_${suffix}@browse.com`,
    passwordHash: 'hash',
    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    roles: ['vendor'],
    isVerified: true,
  });
  await seller.save();

  const category = new Category({
    name: `Electronics-${suffix}`,
    slug: `electronics-${suffix}`,
    level: 1,
    isActive: true,
  });
  await category.save();

  // Create 25 products
  const productsToCreate = Array.from({ length: 25 }, (_, i) => ({
    name: `Product ${i}`,
    sku: `SKU-BROWSE-${i}-${suffix}`,
    slug: `product-${i}-${suffix}`,
    sellerId: seller._id,
    sellerType: 'vendor',
    categoryId: category._id,
    baseMrp: 100,
    baseSellingPrice: 80,
    stock: 10,
    status: 'Live',
    isActive: true,
  }));

  await Product.create(productsToCreate);
  console.log('Seeded 25 test products.');

  try {
    // ----------------------------------------------------
    // TEST 1: Collation case-insensitive category lookup
    // ----------------------------------------------------
    console.log('\n1. Testing Collation case-insensitive category lookup...');

    const mockReqCollation = {
      query: { category: `electronics-${suffix}` },
      headers: {},
    } as any;

    let resBody: any;
    const mockResCollation = {
      json(data: any) {
        resBody = data;
      }
    } as any;

    await getAllProducts(mockReqCollation, mockResCollation);

    assert.ok(resBody.success);
    assert.strictEqual(resBody.products.length, 20, 'Default page limit should fetch 20 items');
    assert.strictEqual(resBody.pagination.totalProducts, 25, 'Total products count should equal 25');

    console.log('Collation category lookup: PASS');

    // ----------------------------------------------------
    // TEST 2: Pagination limits (page 2, limit 10)
    // ----------------------------------------------------
    console.log('\n2. Testing Pagination limits...');

    const mockReqPage = {
      query: { category: `electronics-${suffix}`, page: '2', limit: '10' },
      headers: {},
    } as any;

    let resBodyPage: any;
    const mockResPage = {
      json(data: any) {
        resBodyPage = data;
      }
    } as any;

    await getAllProducts(mockReqPage, mockResPage);

    assert.ok(resBodyPage.success);
    assert.strictEqual(resBodyPage.products.length, 10, 'Page size 10 must fetch 10 items');
    assert.strictEqual(resBodyPage.pagination.page, 2, 'Page field in pagination must equal 2');
    assert.strictEqual(resBodyPage.pagination.totalPages, 3, 'Total pages for 25 items with limit 10 must equal 3');

    console.log('Pagination limits: PASS');

    // Cleanup
    await User.deleteOne({ _id: seller._id });
    await Category.deleteOne({ _id: category._id });
    await Product.deleteMany({ sku: { $regex: `-${suffix}$` } });

    console.log('\n=======================================');
    console.log('ALL RELEASE R6 TESTS PASSED! (100%)');
    console.log('=======================================');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runR6Tests();
