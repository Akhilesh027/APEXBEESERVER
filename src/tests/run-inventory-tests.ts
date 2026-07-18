import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';

import { User } from '../models/User';
import Product from '../models/Product';
import { Coupon } from '../models/Coupon';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { PricingService } from '../services/pricingService';
import { InventoryService } from '../services/inventoryService';
import { InsufficientStockError } from '../errors/InsufficientStockError';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runInventoryTests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  // Clean up existing test data
  await User.deleteMany({ email: /@inventorytest\.com$/ });
  await Product.deleteMany({ sku: /^SKU-INVTEST/ });
  await Coupon.deleteMany({ code: /^TESTCOUPON/ });
  
  const testVendorEmail = 'vendor@inventorytest.com';
  const testCustomerEmail = 'customer@inventorytest.com';

  try {
    // ----------------------------------------------------
    // SETUP
    // ----------------------------------------------------
    console.log('1. Setting up users, product, and coupon...');
    
    const vendor = new User({
      name: 'Inv Test Vendor',
      email: testVendorEmail,
      passwordHash: 'hash',
      phone: '1111111111',
      roles: ['vendor', 'customer'],
      isVerified: true,
      status: 'active',
    });
    await vendor.save();

    const customer = new User({
      name: 'Inv Test Customer',
      email: testCustomerEmail,
      passwordHash: 'hash',
      phone: '2222222222',
      roles: ['customer'],
      isVerified: true,
      status: 'active',
    });
    await customer.save();

    const product = new Product({
      name: 'Concurrency Test Item',
      sku: 'SKU-INVTEST-01',
      slug: 'concurrency-test-item',
      sellerId: vendor._id,
      sellerType: 'vendor',
      categoryId: new mongoose.Types.ObjectId(),
      baseMrp: 150,
      baseSellingPrice: 100,
      stock: 10,
      status: 'Live',
      isActive: true,
      adminPricing: {
        mrp: 150,
        sellingPrice: 100,
        shippingCharge: 10,
        packingCharge: 5,
      },
    });
    await product.save();

    const coupon = new Coupon({
      code: 'TESTCOUPON10',
      discountType: 'percentage',
      discountValue: 10,
      minSubtotal: 50,
      expiryDate: '2030-12-31',
      status: 'Active',
      scope: 'platform',
    });
    await coupon.save();

    console.log('Setup complete.');

    // ----------------------------------------------------
    // TEST 1: Pricing Recalculation & Validation
    // ----------------------------------------------------
    console.log('\n2. Testing Pricing Recalculation...');
    
    const pricingResult = await PricingService.calculateCheckoutPricing(
      [{ productId: product._id.toString(), quantity: 2 }],
      'TESTCOUPON10'
    );

    // subtotal = 100 * 2 = 200
    // shippingFee = 10 * 2 = 20
    // packingFee = 5 * 2 = 10
    // discount = 10% of 200 = 20
    // grandTotal = 200 + 20 + 10 - 20 = 210
    assert.strictEqual(pricingResult.orderSummary.subtotal, 200);
    assert.strictEqual(pricingResult.orderSummary.shippingFee, 20);
    assert.strictEqual(pricingResult.orderSummary.packingFee, 10);
    assert.strictEqual(pricingResult.orderSummary.discount, 20);
    assert.strictEqual(pricingResult.orderSummary.grandTotal, 210);
    assert.strictEqual(pricingResult.sellerId, vendor._id.toString());
    
    console.log('Pricing Recalculation: PASS');

    // ----------------------------------------------------
    // TEST 2: Concurrency & Atomic Reservation
    // ----------------------------------------------------
    console.log('\n3. Testing Concurrent Stock Reservations...');
    
    // Seed/Pre-warm inventory record (stock = 10)
    await InventoryService.getOrCreateInventory(product._id.toString());

    const numRequests = 100;
    const orderId = new mongoose.Types.ObjectId();
    const reservationPromises: Promise<any>[] = [];

    // Spin up 100 requests to buy 1 unit each. Exactly 10 must succeed, 90 must throw.
    for (let i = 0; i < numRequests; i++) {
      const mockOrderId = new mongoose.Types.ObjectId();
      reservationPromises.push(
        InventoryService.reserveStock(
          mockOrderId,
          customer._id,
          [{ productId: product._id.toString(), quantity: 1, variantId: null }]
        )
      );
    }

    const results = await Promise.allSettled(reservationPromises);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    console.log(`Concurrent attempts finished: ${fulfilled.length} succeeded, ${rejected.length} failed.`);

    assert.strictEqual(fulfilled.length, 10, 'Exactly 10 stock reservations must succeed.');
    assert.strictEqual(rejected.length, 90, 'Exactly 90 requests must be rejected.');

    // Assert every rejection was indeed an InsufficientStockError
    for (const r of rejected) {
      assert.ok(
        (r as PromiseRejectedResult).reason instanceof InsufficientStockError,
        'Rejection reason must be an instance of InsufficientStockError'
      );
    }

    // Verify Inventory record state
    const finalInv = await Inventory.findOne({ productId: product._id });
    assert.ok(finalInv);
    assert.strictEqual(finalInv.onHand, 10, 'onHand must remain 10 before commit.');
    assert.strictEqual(finalInv.reserved, 10, 'reserved must be exactly 10.');
    assert.strictEqual(finalInv.sold, 0, 'sold must remain 0 before commit.');

    console.log('Concurrent Stock Reservations: PASS');

    // ----------------------------------------------------
    // TEST 3: Stock Commits & Releases (Cancellation flow)
    // ----------------------------------------------------
    console.log('\n4. Testing Commit and Release Actions...');
    
    // Find one active reservation to commit
    const oneRes = await InventoryReservation.findOne({ status: 'active' });
    assert.ok(oneRes);

    await InventoryService.commitStock(oneRes.orderId);
    
    // Check stock after commit
    const invAfterCommit = await Inventory.findOne({ productId: product._id });
    assert.ok(invAfterCommit);
    assert.strictEqual(invAfterCommit.onHand, 9, 'onHand must decrement to 9.');
    assert.strictEqual(invAfterCommit.reserved, 9, 'reserved must decrement to 9.');
    assert.strictEqual(invAfterCommit.sold, 1, 'sold must increment to 1.');

    // Check reservation status
    const resAfterCommit = await InventoryReservation.findById(oneRes._id);
    assert.ok(resAfterCommit);
    assert.strictEqual(resAfterCommit.status, 'committed');

    // Find another active reservation to release
    const anotherRes = await InventoryReservation.findOne({ status: 'active' });
    assert.ok(anotherRes);

    await InventoryService.releaseStock(anotherRes.orderId);

    // Check stock after release
    const invAfterRelease = await Inventory.findOne({ productId: product._id });
    assert.ok(invAfterRelease);
    assert.strictEqual(invAfterRelease.onHand, 9, 'onHand must remain 9 on release.');
    assert.strictEqual(invAfterRelease.reserved, 8, 'reserved must decrement to 8.');
    assert.strictEqual(invAfterRelease.sold, 1, 'sold must remain 1 on release.');

    console.log('Commit and Release Actions: PASS');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n5. Cleaning up test data...');
    await User.deleteMany({ email: /@inventorytest\.com$/ });
    await Product.deleteMany({ sku: /^SKU-INVTEST/ });
    await Coupon.deleteMany({ code: /^TESTCOUPON/ });
    await Inventory.deleteMany({ productId: product._id });
    await InventoryReservation.deleteMany({ userId: customer._id });

    console.log('Cleanup finished.');
    console.log('\n=======================================');
    console.log('ALL INVENTORY INTEGRITY TESTS PASSED! (100%)');
    console.log('=======================================');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST SUITE RUN ENCOUNTERED CRITICAL ERROR:');
    console.error(err);

    // Clean up connections
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runInventoryTests();
