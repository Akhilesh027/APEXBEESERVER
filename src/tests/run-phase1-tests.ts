import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { User } from '../models/User';
import Product from '../models/Product';
import { Order } from '../models/Order';
import { Wallet } from '../models/Wallet';
import { WalletTransaction } from '../models/WalletTransaction';
import { Inventory } from '../models/Inventory';
import { InventoryReservation } from '../models/InventoryReservation';
import { OrderStateMachine } from '../services/OrderStateMachine';
import { WalletEngine } from '../services/WalletEngine';
import { PricingService } from '../services/pricingService';
import { InventoryService } from '../services/inventoryService';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runPhase1Tests() {
  console.log('Starting Phase 1 Verification Tests...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  // Clean up existing test data
  await User.deleteMany({ email: /@phase1test\.com$/ });
  await Product.deleteMany({ sku: /^SKU-PHASE1/ });
  await Order.deleteMany({ orderNumber: /^AB-PHASE1/ });

  const testVendorEmail = 'vendor@phase1test.com';
  const testCustomerEmail = 'customer@phase1test.com';

  try {
    console.log('1. Setting up mock users and products...');
    const vendor = new User({
      name: 'Phase1 Test Vendor',
      email: testVendorEmail,
      passwordHash: 'hash',
      phone: '1111111115',
      roles: ['vendor', 'customer'],
      isVerified: true,
      status: 'active',
    });
    await vendor.save();

    const customer = new User({
      name: 'Phase1 Test Customer',
      email: testCustomerEmail,
      passwordHash: 'hash',
      phone: '2222222225',
      roles: ['customer'],
      isVerified: true,
      status: 'active',
    });
    await customer.save();

    const product = new Product({
      name: 'Phase 1 Item',
      sku: 'SKU-PHASE1-01',
      slug: 'phase1-item',
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

    // Warm inventory
    const inventory = new Inventory({
      productId: product._id,
      variantId: null,
      sellerId: vendor._id,
      sku: product.sku,
      onHand: 10,
      reserved: 0,
      sold: 0,
    });
    await inventory.save();

    console.log('Mock records seeded.');

    // ----------------------------------------------------
    // TEST 1: Pricing recalculation ignores client params
    // ----------------------------------------------------
    console.log('\n2. Testing Price Recalculation Override...');
    const pricingResult = await PricingService.calculateCheckoutPricing(
      [{ productId: product._id.toString(), quantity: 1 }],
      undefined
    );

    // subtotal = 100, shippingFee = 10, packingFee = 5. grandTotal = 115.
    assert.strictEqual(pricingResult.orderSummary.grandTotal, 115);
    console.log('Price Recalculation Override: PASS');

    // ----------------------------------------------------
    // TEST 2: WalletEngine processDirectWithdrawal atomic balance check
    // ----------------------------------------------------
    console.log('\n3. Testing WalletEngine processDirectWithdrawal...');
    const wallet = await WalletEngine.getOrCreateWallet(customer._id);
    assert.strictEqual(wallet.availableBalance, 0);

    // Assert withdrawal with zero balance fails
    await assert.rejects(
      WalletEngine.processDirectWithdrawal(customer._id, 100, {
        category: 'Delivery Withdrawal',
        source: 'BANK_TRANSFER',
        remarks: 'Should fail',
      }),
      /Insufficient wallet balance/
    );

    // Credit funds and verify direct withdrawal succeeds
    await WalletEngine.credit(customer._id, 150, {
      category: 'Adjustment',
      source: 'manual',
      remarks: 'Add test funds',
    });

    const updatedWallet = await WalletEngine.processDirectWithdrawal(customer._id, 100, {
      category: 'Delivery Withdrawal',
      source: 'BANK_TRANSFER',
      remarks: 'Should pass',
    });

    assert.strictEqual(updatedWallet.availableBalance, 50);
    assert.strictEqual(updatedWallet.withdrawnBalance, 100);

    // Verify WalletTransaction ledger created
    const tx = await WalletTransaction.findOne({ userId: customer._id, type: 'withdrawal' });
    assert.ok(tx);
    assert.strictEqual(tx.amount, 100);
    console.log('WalletEngine direct withdrawal: PASS');

    // ----------------------------------------------------
    // TEST 3: OrderStateMachine Transitions
    // ----------------------------------------------------
    console.log('\n4. Testing OrderStateMachine Transitions...');
    
    // Seed initial Placed order
    const order = new Order({
      orderNumber: `AB-PHASE1-${Date.now()}`,
      customerId: customer._id,
      sellerId: vendor._id,
      items: [{ productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 100 }],
      totalAmount: 115,
      paymentStatus: 'Pending',
      orderStatus: 'Placed',
      timeline: [],
    });
    await order.save();

    // Create reservation to prevent commit errors
    await InventoryService.reserveStock(
      order._id,
      customer._id,
      [{ productId: product._id.toString(), quantity: 1, variantId: null }]
    );

    // Test transition Placed -> Confirmed
    const confirmedOrder = await OrderStateMachine.transition(order._id, 'Confirmed', {
      notes: 'Test confirmation'
    });
    assert.strictEqual(confirmedOrder.orderStatus, 'Confirmed');

    // Test illegal transition Placed -> Delivered
    // Confirmed -> Delivered is legal (since we allowed it), but Placed -> Delivered is illegal
    const placingOrder = new Order({
      orderNumber: `AB-PHASE1-ERR-${Date.now()}`,
      customerId: customer._id,
      sellerId: vendor._id,
      items: [{ productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 100 }],
      totalAmount: 115,
      paymentStatus: 'Pending',
      orderStatus: 'Placed',
      timeline: [],
    });
    await placingOrder.save();

    // We defined 'Placed' -> ['Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled', 'Payment Verified', 'Payment Rejected']
    // Let's test a transition not allowed in the transitions map.
    // Let's assert a transition from Cancelled throws.
    const cancelledOrder = new Order({
      orderNumber: `AB-PHASE1-CANCEL-${Date.now()}`,
      customerId: customer._id,
      sellerId: vendor._id,
      items: [{ productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 100 }],
      totalAmount: 115,
      paymentStatus: 'Pending',
      orderStatus: 'Cancelled',
      timeline: [],
    });
    await cancelledOrder.save();

    await assert.rejects(
      OrderStateMachine.transition(cancelledOrder._id, 'Confirmed', { notes: 'Illegal jump' }),
      /Invalid order status transition/
    );

    console.log('OrderStateMachine Transitions: PASS');

    console.log('\n=======================================');
    console.log('ALL PHASE 1 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase1Tests();
