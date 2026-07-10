"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const assert_1 = __importDefault(require("assert"));
const User_1 = require("../models/User");
const Wallet_1 = require("../models/Wallet");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const SubscriptionDeliveryTask_1 = require("../models/SubscriptionDeliveryTask");
const SubscriptionStatement_1 = require("../models/SubscriptionStatement");
const WalletTransaction_1 = require("../models/WalletTransaction");
const CommissionRule_1 = require("../models/CommissionRule");
const SubscriptionSchedulerService_1 = require("../services/SubscriptionSchedulerService");
const SubscriptionBillingService_1 = require("../services/SubscriptionBillingService");
const SubscriptionSettlementService_1 = require("../services/SubscriptionSettlementService");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runSubscriptionTests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected. Preparing test dataset...');
    const testSuffix = `_test_${Date.now()}`;
    const customerEmail = `customer${testSuffix}@test.com`;
    const vendorEmail = `vendor${testSuffix}@test.com`;
    try {
        // 1. SETUP TEST USERS
        console.log('\n--- 1. Setting up test users ---');
        const customerPhone = String(Math.floor(6000000000 + Math.random() * 4000000000));
        const vendorPhone = String(Math.floor(6000000000 + Math.random() * 4000000000));
        const customer = new User_1.User({
            name: 'Test Customer',
            email: customerEmail,
            passwordHash: 'pass',
            phone: customerPhone,
            roles: ['customer'],
            status: 'active',
            isVerified: true
        });
        await customer.save();
        const vendor = new User_1.User({
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
        const customerWallet = new Wallet_1.Wallet({
            userId: customer._id,
            availableBalance: 2000,
            pendingBalance: 0,
            withdrawnBalance: 0,
            totalCredits: 2000,
            totalDebits: 0
        });
        await customerWallet.save();
        const vendorWallet = new Wallet_1.Wallet({
            userId: vendor._id,
            availableBalance: 0,
            pendingBalance: 0,
            withdrawnBalance: 0,
            totalCredits: 0,
            totalDebits: 0
        });
        await vendorWallet.save();
        // Setup a dummy active commission rule
        let rule = await CommissionRule_1.CommissionRule.findOne({ name: 'default' });
        if (!rule) {
            rule = new CommissionRule_1.CommissionRule({
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
        const subscription = new LocalShopSubscription_1.default({
            userId: customer._id,
            productId: new mongoose_1.default.Types.ObjectId(),
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
        const scheduleResult = await SubscriptionSchedulerService_1.SubscriptionSchedulerService.runDailyScheduler();
        console.log('Scheduler output:', scheduleResult);
        // Verify task generation
        const task = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.findOne({
            subscriptionId: subscription._id,
            date: todayStr
        });
        assert_1.default.ok(task, 'Rider task was not generated for today.');
        console.log(`Rider task verified. Task ID: ${task._id}, status: ${task.status}`);
        // 4. SIMULATE RIDER Run Status Update (delivered)
        console.log('\n--- 4. Simulating rider run update (delivered) ---');
        task.status = 'delivered';
        await task.save();
        console.log('Task status successfully updated to delivered.');
        // 5. GENERATE STATEMENTS
        console.log('\n--- 5. Generating monthly billing statement ---');
        const currentPeriod = todayStr.substring(0, 7); // e.g. "2026-07"
        const statement = await SubscriptionBillingService_1.SubscriptionBillingService.generateStatement(subscription._id, currentPeriod);
        assert_1.default.strictEqual(statement.delivered, 1);
        assert_1.default.strictEqual(statement.grossAmount, 100); // 1 delivery * ₹50 * 2 quantity
        assert_1.default.strictEqual(statement.platformCommission, 5); // 5% of 100
        assert_1.default.strictEqual(statement.franchiseCommission, 0); // 0% for subscriptions
        assert_1.default.strictEqual(statement.netVendorAmount, 95); // 95% of 100
        console.log(`Billing statement generated. Number: ${statement.statementNumber}`);
        console.log(`Gross Payout: ₹${statement.grossAmount}, Platform: ₹${statement.platformCommission}, Vendor: ₹${statement.netVendorAmount}`);
        // 6. PROCESS SETTLEMENT AND PAYOUTS
        console.log('\n--- 6. Processing settlement & payouts to wallets ---');
        const settledStmt = await SubscriptionSettlementService_1.SubscriptionSettlementService.settleStatement(statement._id);
        assert_1.default.strictEqual(settledStmt.settlementStatus, 'settled');
        // Audit Wallets
        const updatedCustomerWallet = await Wallet_1.Wallet.findOne({ userId: customer._id });
        const updatedVendorWallet = await Wallet_1.Wallet.findOne({ userId: vendor._id });
        assert_1.default.strictEqual(updatedCustomerWallet?.availableBalance, 1900); // Debited ₹100 from ₹2000
        assert_1.default.strictEqual(updatedVendorWallet?.availableBalance, 95); // Credited ₹95 net amount
        console.log('Customer wallet balance updated:', updatedCustomerWallet?.availableBalance);
        console.log('Vendor wallet balance updated:', updatedVendorWallet?.availableBalance);
        // Audit Double-Entry Ledger Transactions
        const debitTx = await WalletTransaction_1.WalletTransaction.findOne({ userId: customer._id, type: 'payment' });
        const creditTx = await WalletTransaction_1.WalletTransaction.findOne({ userId: vendor._id, type: 'subscription_credit' });
        assert_1.default.ok(debitTx, 'Customer payment transaction ledger entry is missing.');
        assert_1.default.ok(creditTx, 'Vendor credit transaction ledger entry is missing.');
        console.log(`Double-entry ledgers audited. Debit: ${debitTx.transactionNumber}, Credit: ${creditTx.transactionNumber}`);
        // 7. CLEANUP TEST DATA
        console.log('\n--- 7. Cleaning up test documents ---');
        await User_1.User.deleteMany({ email: { $in: [customerEmail, vendorEmail] } });
        await Wallet_1.Wallet.deleteMany({ userId: { $in: [customer._id, vendor._id] } });
        await LocalShopSubscription_1.default.deleteMany({ _id: subscription._id });
        await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.deleteMany({ subscriptionId: subscription._id });
        await SubscriptionStatement_1.SubscriptionStatement.deleteMany({ subscriptionId: subscription._id });
        await WalletTransaction_1.WalletTransaction.deleteMany({ walletId: { $in: [customerWallet._id, vendorWallet._id] } });
        console.log('Cleanup completed successfully.');
        console.log('\n=======================================');
        console.log('ALL SUBSCRIPTION TESTS PASSED! (100%)');
        console.log('=======================================');
    }
    catch (err) {
        console.error('\n❌ SUBSCRIPTION TEST SUITE ENCOUNTERED ERROR:');
        console.error(err);
        // Attempt clean up
        try {
            await User_1.User.deleteMany({ email: { $in: [customerEmail, vendorEmail] } });
        }
        catch { }
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
runSubscriptionTests();
