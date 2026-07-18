import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { User } from '../models/User';
import Product from '../models/Product';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { InventoryService } from '../services/inventoryService';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runPhase5Tests() {
  console.log('Starting Phase 5 Inventory Expiry Verification Tests...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  // Clean up existing test data
  await User.deleteMany({ email: /@phase5test\.com$/ });
  await Product.deleteMany({ sku: /^SKU-PHASE5/ });
  await InventoryReservation.deleteMany({});

  const testVendorEmail = 'vendor@phase5test.com';
  const testCustomerEmail = 'customer@phase5test.com';

  try {
    console.log('1. Setting up mock users, products, and inventory...');
    const vendor = new User({
      name: 'Phase5 Test Vendor',
      email: testVendorEmail,
      passwordHash: 'hash',
      phone: '1111111155',
      roles: ['vendor', 'customer'],
      isVerified: true,
      status: 'active',
    });
    await vendor.save();

    const customer = new User({
      name: 'Phase5 Test Customer',
      email: testCustomerEmail,
      passwordHash: 'hash',
      phone: '2222222255',
      roles: ['customer'],
      isVerified: true,
      status: 'active',
    });
    await customer.save();

    const product = new Product({
      name: 'Phase 5 Item',
      sku: 'SKU-PHASE5-01',
      slug: 'phase5-item',
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

    // Setup inventory with 10 onHand, 2 reserved
    const inventory = new Inventory({
      productId: product._id,
      variantId: null,
      sellerId: vendor._id,
      sku: product.sku,
      onHand: 10,
      reserved: 2,
      sold: 0,
      version: 0,
    });
    await inventory.save();

    // Create an expired reservation for 2 units
    const expiredRes = new InventoryReservation({
      reservationId: 'RES-PHASE5-EXP',
      orderId: new mongoose.Types.ObjectId(),
      userId: customer._id,
      productId: product._id,
      quantity: 2,
      variantId: null,
      status: 'active',
      expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
    });
    await expiredRes.save();

    console.log('Mock setup complete.');

    // ----------------------------------------------------
    // TEST 1: Expiry Sweep Safely Releases Expired Stock
    // ----------------------------------------------------
    console.log('\n2. Running Reservation Expiry Sweep...');
    
    const invBefore = await Inventory.findOne({ productId: product._id });
    console.log('Inventory before sweep:', invBefore);

    const releasedCount = await InventoryService.cleanupExpiredReservations();
    assert.strictEqual(releasedCount, 1, 'Exactly 1 expired reservation must be swept and released');

    // Verify reservation status is updated
    const updatedRes = await InventoryReservation.findOne({ reservationId: 'RES-PHASE5-EXP' });
    assert.ok(updatedRes);
    assert.strictEqual(updatedRes.status, 'expired', 'Reservation status must transition to expired');

    // Verify inventory counts and version changes
    const updatedInv = await Inventory.findOne({ productId: product._id });
    assert.ok(updatedInv);
    assert.strictEqual(updatedInv.reserved, 0, 'Reserved stock count must be decremented to 0');
    assert.strictEqual(updatedInv.onHand, 10, 'OnHand stock count must remain 10');
    assert.strictEqual(updatedInv.version, 1, 'Inventory version must be incremented by 1');

    console.log('Reservation Expiry Sweep: PASS');

    // ----------------------------------------------------
    // TEST 2: Concurrent/Duplicate sweeps are skipped
    // ----------------------------------------------------
    console.log('\n3. Verifying subsequent sweeps skip already expired items...');
    
    const rerunReleasedCount = await InventoryService.cleanupExpiredReservations();
    assert.strictEqual(rerunReleasedCount, 0, 'No reservations should be released on rerun');

    console.log('Duplicate sweeps skipped: PASS');

    console.log('\n=======================================');
    console.log('ALL PHASE 5 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase5Tests();
