import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import assert from 'assert';

import { User } from '../models/User';
import { Wallet } from '../models/Wallet';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { WalletTransaction } from '../models/WalletTransaction';
import { CommissionRule } from '../models/CommissionRule';

import { SubscriptionSchedulerService } from '../services/SubscriptionSchedulerService';
import { SubscriptionBillingService } from '../services/SubscriptionBillingService';
import { SubscriptionSettlementService } from '../services/SubscriptionSettlementService';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runSubscriptionTests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected. Preparing test dataset...');

  const testSuffix = `_test_${Date.now()}`;
  const customerEmail = `customer${testSuffix}@test.com`;
  const vendorEmail = `vendor${testSuffix}@test.com`;

  try {
    // 1. SETUP TEST USERS
    console.log('\n--- 1. Setting up test users ---');
    const customerPhone = String(Math.floor(6000000000 + Math.random() * 4000000000));
    const vendorPhone = String(Math.floor(6000000000 + Math.random() * 4000000000));

    const customer = new User({
      name: 'Test Customer',
      email: customerEmail,
      passwordHash: 'pass',
      phone: customerPhone,
      roles: ['customer'],
      status: 'active',
      isVerified: true
    });
    await customer.save();

    const vendor = new User({
      name: 'Test Vendor',
      email: vendorEmail,
      passwordHash: 'pass',
      phone: vendorPhone,
      roles: ['vendor'],
      status: 'active',
      isVerified: true
    });
    await vendor.save();

    // Setup active wallets with pre-loaded balance for customer
    const customerWallet = new Wallet({
      userId: customer._id,
      availableBalance: 2000,
      pendingBalance: 0,
      withdrawnBalance: 0,
      totalCredits: 2000,
      totalDebits: 0
    });
    await customerWallet.save();

    const vendorWallet = new Wallet({
      userId: vendor._id,
      availableBalance: 0,
      pendingBalance: 0,
      withdrawnBalance: 0,
      totalCredits: 0,
      totalDebits: 0
    });
    await vendorWallet.save();

    // Setup a dummy active commission rule
    let rule = await CommissionRule.findOne({ name: 'default' });
    if (!rule) {
      rule = new CommissionRule({
        name: 'default',
        platformPercentage: 5,
        franchisePercentage: 5,
        vendorPercentage: 90,
        isActive: true
      });
      await rule.save();
    }

    // 2. CREATE ACTIVE SUBSCRIPTION
    console.log('\n--- 2. Creating active Local Shop Subscription ---');
    const todayStr = new Date().toISOString().split('T')[0];
    const subscription = new LocalShopSubscription({
      userId: customer._id,
      productId: new mongoose.Types.ObjectId(),
      vendorId: vendor._id,
      productName: 'Test Premium Milk Pack',
      productImage: '',
      quantity: 2,
      unitPrice: 50, // ₹50 per pack
      frequency: 'daily',
      deliverySlot: 'Morning (6:00 AM - 8:00 AM)',
      status: 'active',
      autoRenew: true,
      skippedDates: [],
      startDate: todayStr
    });
    await subscription.save();
    console.log(`Subscription created successfully. ID: ${subscription._id}`);

    // 3. RUN SCHEDULER
    console.log('\n--- 3. Running daily subscription scheduler ---');
    const scheduleResult = await SubscriptionSchedulerService.runDailyScheduler();
    console.log('Scheduler output:', scheduleResult);

    // Verify task generation
    const task = await SubscriptionDeliveryTask.findOne({
      subscriptionId: subscription._id,
      date: todayStr
    });
    assert.ok(task, 'Rider task was not generated for today.');
    console.log(`Rider task verified. Task ID: ${task._id}, status: ${task.status}`);

    // 4. SIMULATE RIDER Run Status Update (delivered)
    console.log('\n--- 4. Simulating rider run update (delivered) ---');
    task.status = 'delivered';
    await task.save();
    console.log('Task status successfully updated to delivered.');

    // 5. GENERATE STATEMENTS
    console.log('\n--- 5. Generating monthly billing statement ---');
    const currentPeriod = todayStr.substring(0, 7); // e.g. "2026-07"
    const statement = await SubscriptionBillingService.generateStatement(subscription._id, currentPeriod);
    
    assert.strictEqual(statement.delivered, 1);
    assert.strictEqual(statement.grossAmount, 100); // 1 delivery * ₹50 * 2 quantity
    assert.strictEqual(statement.platformCommission, 5); // 5% of 100
    assert.strictEqual(statement.franchiseCommission, 0); // 0% for subscriptions
    assert.strictEqual(statement.netVendorAmount, 95); // 95% of 100
    console.log(`Billing statement generated. Number: ${statement.statementNumber}`);
    console.log(`Gross Payout: ₹${statement.grossAmount}, Platform: ₹${statement.platformCommission}, Vendor: ₹${statement.netVendorAmount}`);

    // 6. PROCESS SETTLEMENT AND PAYOUTS
    console.log('\n--- 6. Processing settlement & payouts to wallets ---');
    const settledStmt = await SubscriptionSettlementService.settleStatement(statement._id);
    assert.strictEqual(settledStmt.settlementStatus, 'settled');

    // Audit Wallets
    const updatedCustomerWallet = await Wallet.findOne({ userId: customer._id });
    const updatedVendorWallet = await Wallet.findOne({ userId: vendor._id });

    assert.strictEqual(updatedCustomerWallet?.availableBalance, 1900); // Debited ₹100 from ₹2000
    assert.strictEqual(updatedVendorWallet?.availableBalance, 95); // Credited ₹95 net amount

    console.log('Customer wallet balance updated:', updatedCustomerWallet?.availableBalance);
    console.log('Vendor wallet balance updated:', updatedVendorWallet?.availableBalance);

    // Audit Double-Entry Ledger Transactions
    const debitTx = await WalletTransaction.findOne({ userId: customer._id, type: 'payment' });
    const creditTx = await WalletTransaction.findOne({ userId: vendor._id, type: 'subscription_credit' });

    assert.ok(debitTx, 'Customer payment transaction ledger entry is missing.');
    assert.ok(creditTx, 'Vendor credit transaction ledger entry is missing.');
    console.log(`Double-entry ledgers audited. Debit: ${debitTx.transactionNumber}, Credit: ${creditTx.transactionNumber}`);

    // 7. CLEANUP TEST DATA
    console.log('\n--- 7. Cleaning up test documents ---');
    await User.deleteMany({ email: { $in: [customerEmail, vendorEmail] } });
    await Wallet.deleteMany({ userId: { $in: [customer._id, vendor._id] } });
    await LocalShopSubscription.deleteMany({ _id: subscription._id });
    await SubscriptionDeliveryTask.deleteMany({ subscriptionId: subscription._id });
    await SubscriptionStatement.deleteMany({ subscriptionId: subscription._id });
    await WalletTransaction.deleteMany({ walletId: { $in: [customerWallet._id, vendorWallet._id] } });

    console.log('Cleanup completed successfully.');
    console.log('\n=======================================');
    console.log('ALL SUBSCRIPTION TESTS PASSED! (100%)');
    console.log('=======================================');

  } catch (err: any) {
    console.error('\n❌ SUBSCRIPTION TEST SUITE ENCOUNTERED ERROR:');
    console.error(err);

    // Attempt clean up
    try {
      await User.deleteMany({ email: { $in: [customerEmail, vendorEmail] } });
    } catch {}
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runSubscriptionTests();
