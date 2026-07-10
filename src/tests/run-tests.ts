import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';

import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import { WalletEngine } from '../services/WalletEngine';
import { SettlementEngine } from '../services/SettlementEngine';
import { CommissionSettlement } from '../models/CommissionSettlement';
import { Order } from '../models/Order';
import Product from '../models/Product';
import { BusinessRelationship } from '../models/BusinessRelationship';
import { ReferralSettings } from '../models/ReferralSettings';
import { ReferralTransaction } from '../models/ReferralTransaction';
import '../models/Franchise';
import '../models/Entrepreneur';
import '../models/Vendor';
import '../models/ServiceProvider';
import '../models/Wholesaler';
import '../models/Manufacturer';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runTests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected. Clearing test data...');

  const testSuffix = `_test_${Date.now()}`;
  const testEmail = `user${testSuffix}@test.com`;

  // Clean up existing test data if any (SCOPED to test users only — never wipe real data)
  const existingTestUsers = await User.find({ email: /@test\.com$/ }).select('_id');
  const testUserIds = existingTestUsers.map(u => u._id);
  if (testUserIds.length > 0) {
    await Wallet.deleteMany({ userId: { $in: testUserIds } });
    await CommissionSettlement.deleteMany({ recipientId: { $in: testUserIds } });
    await ReferralTransaction.deleteMany({ $or: [
      { recipientUserId: { $in: testUserIds } },
      { referredUserId: { $in: testUserIds } }
    ]});
  }
  await User.deleteMany({ email: /@test\.com$/ });
  await Product.deleteMany({ sku: /^SKU-TEST/ });
  await Order.deleteMany({ orderNumber: /^ORD-TEST/ });

  try {
    // ----------------------------------------------------
    // SETUP TEST ENTITIES
    // ----------------------------------------------------
    console.log('1. Setting up test entities...');
    const user = new User({
      name: 'Test Vendor User',
      email: testEmail,
      passwordHash: 'test_hash',
      phone: '1234567890',
      roles: ['vendor', 'customer'],
      status: 'active',
      isVerified: true
    });
    await user.save();

    const product = new Product({
      sellerId: user._id,
      sellerType: 'vendor',
      name: 'Test Product',
      slug: `test-product-${Date.now()}`,
      description: 'Test product description',
      categoryId: new mongoose.Types.ObjectId(),
      sku: `SKU-TEST-${Date.now()}`,
      baseMrp: 100,
      discountPercent: 0,
      baseSellingPrice: 100,
      stock: 50,
      status: 'Live',
      isActive: true,
      adminPricing: {
        mrp: 100,
        sellingPrice: 100,
        platformFeePercent: 10,
        platformFeeAmount: 10,
        shippingCharge: 0,
        packingCharge: 0,
        commissionShares: [
          { type: 'state', label: 'State Franchise Share', percent: 5, amount: 5, isActive: true },
          { type: 'district', label: 'District Franchise Share', percent: 3, amount: 3, isActive: true }
        ],
        totalCommissionAmount: 10,
        finalSellerAmount: 90,
        customerSellingAmount: 100,
        platformNetProfit: 10
      }
    });
    await product.save();

    const order = new Order({
      orderNumber: `ORD-TEST-${Date.now()}`,
      customerId: user._id,
      sellerId: user._id,
      items: [
        { productId: product._id, productName: product.name, sku: product.sku, quantity: 2, price: 100 }
      ],
      totalAmount: 200,
      paymentStatus: 'Paid',
      orderStatus: 'Placed',
      orderItems: [
        {
          productId: product._id.toString(),
          name: product.name,
          price: 100,
          originalPrice: 100,
          image: '/placeholder.png',
          quantity: 2,
          color: 'default',
          size: 'One Size',
          vendorId: user._id.toString(),
          itemTotal: 200,
          deliveryFee: 0
        }
      ],
      shippingAddress: { name: 'Test User', phone: '1234567890', address: '123 Test St', city: 'Test City', state: 'Test State', pincode: '123456' },
      paymentDetails: { method: 'upi', status: 'completed', amount: 200 },
      orderSummary: { total: 200, subtotal: 200, grandTotal: 200 }
    });
    await order.save();

    // Setup Business Relationship for split logic
    const rel = new BusinessRelationship({
      userId: user._id,
      businessId: user._id,
      businessType: 'vendor',
      status: 'active',
      stateFranchiseId: SettlementEngine.COMPANY_ID, // Use Company system wallet for convenience
      districtFranchiseId: SettlementEngine.COMPANY_ID,
      mandalFranchiseId: SettlementEngine.COMPANY_ID,
      entrepreneurId: SettlementEngine.COMPANY_ID
    });
    await rel.save();

    console.log('Setup completed successfully.');

    // ====================================================
    // WALLET ENGINE TESTS
    // ====================================================
    console.log('\n2. Running WalletEngine tests...');

    // A. credit
    console.log(' - Testing WalletEngine.credit()');
    let wallet = await WalletEngine.credit(user._id, 100, {
      category: 'Test Credit',
      source: 'test',
      remarks: 'Credit test remarks'
    });
    assert.strictEqual(wallet.availableBalance, 100);
    assert.strictEqual(wallet.ledgerEntries.length, 1);
    assert.strictEqual(wallet.ledgerEntries[0]?.type, 'credit');
    assert.strictEqual(wallet.ledgerEntries[0]?.amount, 100);
    assert.strictEqual(wallet.ledgerEntries[0]?.status, 'completed');
    assert.ok(wallet.ledgerEntries[0]?.transactionId?.startsWith('TXN_'));

    // B. hold
    console.log(' - Testing WalletEngine.hold()');
    wallet = await WalletEngine.hold(user._id, 50, {
      category: 'Test Hold',
      source: 'test',
      remarks: 'Hold test remarks'
    });
    assert.strictEqual(wallet.availableBalance, 100);
    assert.strictEqual(wallet.pendingBalance, 50);
    assert.strictEqual(wallet.ledgerEntries.length, 2);
    assert.strictEqual(wallet.ledgerEntries[1]?.status, 'pending');

    // C. release
    console.log(' - Testing WalletEngine.release()');
    wallet = await WalletEngine.release(user._id, 30, {
      category: 'Test Release',
      source: 'test',
      remarks: 'Release test remarks',
      referenceId: order._id // using order ID mock
    });
    assert.strictEqual(wallet.availableBalance, 130);
    assert.strictEqual(wallet.pendingBalance, 20); // 50 - 30

    // D. reverse
    console.log(' - Testing WalletEngine.reverse()');
    wallet = await WalletEngine.reverse(user._id, 20, {
      category: 'Test Reverse',
      source: 'test',
      remarks: 'Reverse test remarks'
    });
    assert.strictEqual(wallet.availableBalance, 130);
    assert.strictEqual(wallet.pendingBalance, 0); // 20 - 20

    // E. debit
    console.log(' - Testing WalletEngine.debit()');
    wallet = await WalletEngine.debit(user._id, 40, {
      category: 'Test Debit',
      source: 'test',
      remarks: 'Debit test remarks'
    });
    assert.strictEqual(wallet.availableBalance, 90); // 130 - 40

    console.log('WalletEngine tests: PASS');

    // ====================================================
    // SETTLEMENT ENGINE TESTS
    // ====================================================
    console.log('\n3. Running SettlementEngine tests...');

    // A. createSettlements
    console.log(' - Testing SettlementEngine.createSettlements()');
    await SettlementEngine.createSettlements(order);
    
    // Query settlements generated
    const settlements = await CommissionSettlement.find({ orderId: order._id });
    assert.ok(settlements.length > 0);
    
    // Check vendor settlement exists
    const vendorSettlement = settlements.find(s => s.settlementType === 'vendor');
    assert.ok(vendorSettlement);
    assert.strictEqual(vendorSettlement.status, 'placed');
    // finalSellerAmount = 90 * quantity 2 = 180
    assert.strictEqual(vendorSettlement.amount, 180);

    // B. pendSettlements
    console.log(' - Testing SettlementEngine.pendSettlements()');
    await SettlementEngine.pendSettlements(order._id);
    
    const pendedSettlements = await CommissionSettlement.find({ orderId: order._id });
    assert.ok(pendedSettlements.every(s => s.status === 'pending'));
    
    // Check wallet pending balances (should increase by settlement amounts)
    const vendorWallet = await Wallet.findOne({ userId: user._id });
    assert.ok(vendorWallet);
    // Previous pending balance was 0. Vendor settlement pending = 180.
    assert.strictEqual(vendorWallet.pendingBalance, 180);

    // C. releaseEligibleSettlements
    console.log(' - Testing SettlementEngine.releaseEligibleSettlements()');
    // Artificially change releaseDate of settlements to past so they are eligible
    await CommissionSettlement.updateMany({ orderId: order._id }, { $set: { releaseDate: new Date(Date.now() - 3600000) } });
    
    const releaseStats = await SettlementEngine.releaseEligibleSettlements();
    assert.ok(releaseStats.releasedSettlements > 0);
    
    const releasedSettlements = await CommissionSettlement.find({ orderId: order._id });
    assert.ok(releasedSettlements.every(s => s.status === 'released'));
    
    const vendorWalletReleased = await Wallet.findOne({ userId: user._id });
    assert.ok(vendorWalletReleased);
    // pendingBalance should decrease to 0, availableBalance should increase by 180 (90 + 180 = 270)
    assert.strictEqual(vendorWalletReleased.pendingBalance, 0);
    assert.strictEqual(vendorWalletReleased.availableBalance, 270);

    // D. cancelSettlements
    console.log(' - Testing SettlementEngine.cancelSettlements()');
    // Let's create another order and settlements to cancel
    const order2 = new Order({
      orderNumber: `ORD-TEST-2-${Date.now()}`,
      customerId: user._id,
      sellerId: user._id,
      items: [
        { productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 100 }
      ],
      totalAmount: 100,
      paymentStatus: 'Paid',
      orderStatus: 'Placed',
      orderItems: [
        { productId: product._id.toString(), name: product.name, price: 100, quantity: 1, vendorId: user._id.toString(), itemTotal: 100, deliveryFee: 0 }
      ],
      shippingAddress: { name: 'Test User', phone: '1234567890', address: '123 Test St', city: 'Test City', state: 'Test State', pincode: '123456' },
      paymentDetails: { method: 'upi', status: 'completed', amount: 100 },
      orderSummary: { total: 100, subtotal: 100, grandTotal: 100 }
    });
    await order2.save();
    
    await SettlementEngine.createSettlements(order2);
    await SettlementEngine.pendSettlements(order2._id);
    
    // Cancel the second order settlements
    await SettlementEngine.cancelSettlements(order2._id);
    
    const cancelledSettlements = await CommissionSettlement.find({ orderId: order2._id });
    assert.ok(cancelledSettlements.every(s => s.status === 'cancelled'));

    // E. Product-defined First Purchase Commission Test
    console.log(' - Testing product-defined first order commission');
    
    // Create a referrer user
    const referrer = new User({
      name: 'Test Referrer User',
      email: `referrer${testSuffix}@test.com`,
      passwordHash: 'test_hash',
      phone: '1234567800',
      roles: ['customer'],
      status: 'active',
      isVerified: true
    });
    await referrer.save();

    // Create a referred user with a hierarchy
    const referredCustomer = new User({
      name: 'Test Referred Customer',
      email: `referred${testSuffix}@test.com`,
      passwordHash: 'test_hash',
      phone: '1234567801',
      roles: ['customer'],
      status: 'active',
      isVerified: true,
      referralHierarchy: {
        level1UserId: referrer._id
      }
    });
    await referredCustomer.save();

    // Create a product with firstPurchase commission share configured to ₹22.5
    const productFirstPurchase = new Product({
      sellerId: user._id,
      sellerType: 'vendor',
      name: 'First Purchase Promo Product',
      slug: `first-purchase-promo-${Date.now()}`,
      description: 'Test first purchase promo',
      categoryId: new mongoose.Types.ObjectId(),
      sku: `SKU-TEST-FP-${Date.now()}`,
      baseMrp: 100,
      discountPercent: 0,
      baseSellingPrice: 100,
      stock: 50,
      status: 'Live',
      isActive: true,
      adminPricing: {
        mrp: 100,
        sellingPrice: 100,
        platformFeePercent: 10,
        platformFeeAmount: 10,
        shippingCharge: 0,
        packingCharge: 0,
        commissionShares: [
          { type: 'firstPurchase', label: 'First Purchase Share', percent: 0, amount: 22.5, isActive: true }
        ],
        totalCommissionAmount: 22.5,
        finalSellerAmount: 77.5,
        customerSellingAmount: 100,
        platformNetProfit: 10
      }
    });
    await productFirstPurchase.save();

    // Save referral settings to be enabled
    let refSettings = await ReferralSettings.findOne({});
    if (!refSettings) {
      refSettings = new ReferralSettings({ enabled: true, firstOrderRewards: { level1: 50, level2: 25, level3: 15 } });
    } else {
      refSettings.enabled = true;
      refSettings.firstOrderRewards = { level1: 50, level2: 25, level3: 15 };
    }
    await refSettings.save();

    // Create first order for referred customer
    const orderFP = new Order({
      orderNumber: `ORD-TEST-FP-${Date.now()}`,
      customerId: referredCustomer._id,
      sellerId: user._id,
      items: [
        { productId: productFirstPurchase._id, productName: productFirstPurchase.name, sku: productFirstPurchase.sku, quantity: 1, price: 100 }
      ],
      totalAmount: 100,
      paymentStatus: 'Paid',
      orderStatus: 'Placed',
      orderItems: [
        {
          productId: productFirstPurchase._id.toString(),
          name: productFirstPurchase.name,
          price: 100,
          originalPrice: 100,
          image: '/placeholder.png',
          quantity: 1,
          color: 'default',
          size: 'One Size',
          vendorId: user._id.toString(),
          itemTotal: 100,
          deliveryFee: 0
        }
      ],
      shippingAddress: { name: 'Test User', phone: '1234567890', address: '123 Test St', city: 'Test City', state: 'Test State', pincode: '123456' },
      paymentDetails: { method: 'upi', status: 'completed', amount: 100 },
      orderSummary: { total: 100, subtotal: 100, grandTotal: 100 }
    });
    await orderFP.save();

    // Create settlements
    await SettlementEngine.createSettlements(orderFP);

    // Verify first purchase commission created is exactly ₹22.5 (from product configuration)
    const fpTx = await ReferralTransaction.findOne({
      referredUserId: referredCustomer._id,
      recipientUserId: referrer._id,
      transactionType: 'first_purchase_product_commission'
    });
    assert.ok(fpTx);
    assert.strictEqual(fpTx.amount, 22.5);

    // Verify direct referral bonus of ₹50 also created
    const directBonusTx = await ReferralTransaction.findOne({
      referredUserId: referredCustomer._id,
      recipientUserId: referrer._id,
      transactionType: 'first_order_bonus'
    });
    assert.ok(directBonusTx);
    assert.strictEqual(directBonusTx.amount, 50);

    // F. Fallback First Purchase Commission Test
    console.log(' - Testing product first order fallback to settings');
    // Create another referred user
    const referredCustomerFallback = new User({
      name: 'Test Referred Customer Fallback',
      email: `referred-fb${testSuffix}@test.com`,
      passwordHash: 'test_hash',
      phone: '1234567802',
      roles: ['customer'],
      status: 'active',
      isVerified: true,
      referralHierarchy: {
        level1UserId: referrer._id
      }
    });
    await referredCustomerFallback.save();

    // Create order with fallback (the original product has NO firstPurchase configuration in adminPricing)
    const orderFallback = new Order({
      orderNumber: `ORD-TEST-FB-${Date.now()}`,
      customerId: referredCustomerFallback._id,
      sellerId: user._id,
      items: [
        { productId: product._id, productName: product.name, sku: product.sku, quantity: 1, price: 100 }
      ],
      totalAmount: 100,
      paymentStatus: 'Paid',
      orderStatus: 'Placed',
      orderItems: [
        {
          productId: product._id.toString(),
          name: product.name,
          price: 100,
          originalPrice: 100,
          image: '/placeholder.png',
          quantity: 1,
          color: 'default',
          size: 'One Size',
          vendorId: user._id.toString(),
          itemTotal: 100,
          deliveryFee: 0
        }
      ],
      shippingAddress: { name: 'Test User', phone: '1234567890', address: '123 Test St', city: 'Test City', state: 'Test State', pincode: '123456' },
      paymentDetails: { method: 'upi', status: 'completed', amount: 100 },
      orderSummary: { total: 100, subtotal: 100, grandTotal: 100 }
    });
    await orderFallback.save();

    await SettlementEngine.createSettlements(orderFallback);

    // Verify first purchase commission is fallback ₹50
    const fbTx = await ReferralTransaction.findOne({
      referredUserId: referredCustomerFallback._id,
      recipientUserId: referrer._id,
      transactionType: 'first_order_bonus'
    });
    assert.ok(fbTx);
    assert.strictEqual(fbTx.amount, 50);

    // Clean up our extra users, products and transactions from this test
    await User.deleteMany({ email: { $in: [`referrer${testSuffix}@test.com`, `referred${testSuffix}@test.com`, `referred-fb${testSuffix}@test.com`] } });
    await Product.deleteOne({ _id: productFirstPurchase._id });
    await Order.deleteMany({ _id: { $in: [orderFP._id, orderFallback._id] } });
    await ReferralTransaction.deleteMany({ referredUserId: { $in: [referredCustomer._id, referredCustomerFallback._id] } });

    console.log('SettlementEngine tests: PASS');

    // ====================================================
    // WITHDRAWAL TESTS (APPROVE & REJECT)
    // ====================================================
    console.log('\n4. Running Withdrawal flow tests...');

    // Reset wallet available balance to 500 for clean test
    await Wallet.findOneAndUpdate({ userId: user._id }, { $set: { availableBalance: 500, pendingBalance: 0, withdrawnBalance: 0, ledgerEntries: [] } });

    // Request a withdrawal via WalletEngine.debit in pending status
    let testWallet = await WalletEngine.debit(user._id, 200, {
      category: 'Withdrawal',
      source: 'withdrawal',
      remarks: 'Withdrawal test',
      status: 'pending',
      referenceType: 'WITHDRAWAL'
    });
    assert.strictEqual(testWallet.availableBalance, 300);
    assert.strictEqual(testWallet.pendingBalance, 200);

    const withdrawalEntry = testWallet.ledgerEntries[0]!;
    assert.ok(withdrawalEntry);
    assert.strictEqual(withdrawalEntry.status, 'pending');

    // Test Approve Withdrawal
    console.log(' - Testing approveWithdrawal()');
    testWallet = await WalletEngine.approveWithdrawal(user._id, (withdrawalEntry as any)._id);
    assert.strictEqual(testWallet.availableBalance, 300);
    assert.strictEqual(testWallet.pendingBalance, 0);
    assert.strictEqual(testWallet.withdrawnBalance, 200);
    assert.strictEqual(testWallet.ledgerEntries[0]?.status, 'completed');

    // Test Reject Withdrawal
    console.log(' - Testing rejectWithdrawal()');
    // Trigger another pending withdrawal of 100
    testWallet = await WalletEngine.debit(user._id, 100, {
      category: 'Withdrawal',
      source: 'withdrawal',
      remarks: 'Withdrawal test 2',
      status: 'pending',
      referenceType: 'WITHDRAWAL'
    });
    assert.strictEqual(testWallet.availableBalance, 200); // 300 - 100
    assert.strictEqual(testWallet.pendingBalance, 100);

    const withdrawalEntry2 = testWallet.ledgerEntries.find(e => e.remarks === 'Withdrawal test 2')!;
    assert.ok(withdrawalEntry2);
    
    testWallet = await WalletEngine.rejectWithdrawal(user._id, (withdrawalEntry2 as any)._id);
    assert.strictEqual(testWallet.availableBalance, 300); // Reversed (200 + 100)
    assert.strictEqual(testWallet.pendingBalance, 0);

    const reversedRefundEntry = testWallet.ledgerEntries.find(e => e.category === 'Refund');
    assert.ok(reversedRefundEntry);
    assert.strictEqual(reversedRefundEntry.amount, 100);

    console.log('Withdrawal tests: PASS');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n5. Cleaning up test documents...');
    await User.deleteMany({ email: testEmail });
    await Wallet.deleteMany({ userId: user._id });
    await Product.deleteMany({ sellerId: user._id });
    await Order.deleteMany({ customerId: user._id });
    await CommissionSettlement.deleteMany({ orderId: { $in: [order._id, order2._id] } });
    await BusinessRelationship.deleteMany({ businessId: user._id });

    console.log('Cleanup completed successfully.');
    console.log('\n=======================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (100% PASS)');
    console.log('=======================================');
    
    await mongoose.disconnect();
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST SUITE FAILED CONSTRAINTS OR FAILURE ENCOUNTERED:');
    console.error(err);
    
    // Ensure database disconnection on error
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runTests();
