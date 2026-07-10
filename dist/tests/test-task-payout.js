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
const WalletTransaction_1 = require("../models/WalletTransaction");
const CommissionService_1 = require("../services/CommissionService");
const WalletLedgerService_1 = require("../services/WalletLedgerService");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runTaskPayoutTest() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected. Preparing test dataset...');
    const testSuffix = `_task_test_${Date.now()}`;
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
            availableBalance: 1000,
            pendingBalance: 0,
            withdrawnBalance: 0,
            totalCredits: 1000,
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
        // 2. CREATE ACTIVE SUBSCRIPTION & DELIVERED TASK
        console.log('\n--- 2. Creating active subscription & delivered task ---');
        const todayStr = '2026-07-02';
        const subscription = new LocalShopSubscription_1.default({
            userId: customer._id,
            productId: new mongoose_1.default.Types.ObjectId(),
            vendorId: vendor._id,
            productName: 'Test Daily Eggs Box',
            productImage: '',
            quantity: 2,
            unitPrice: 40, // ₹40 per box (Total ₹80 gross)
            frequency: 'daily',
            deliverySlot: 'Morning',
            status: 'active',
            autoRenew: true,
            skippedDates: [],
            startDate: todayStr
        });
        await subscription.save();
        const task = new SubscriptionDeliveryTask_1.SubscriptionDeliveryTask({
            subscriptionId: subscription._id,
            date: todayStr,
            status: 'delivered',
            riderId: new mongoose_1.default.Types.ObjectId(),
            otpVerified: true,
            isPaidToVendor: false
        });
        await task.save();
        console.log(`Task created. ID: ${task._id}, status: ${task.status}, isPaidToVendor: ${task.isPaidToVendor}`);
        // 3. EXECUTE SETTLEMENT
        console.log('\n--- 3. Releasing individual task payout ---');
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const grossAmount = subscription.unitPrice * subscription.quantity; // ₹80
            const splits = await CommissionService_1.CommissionService.calculateSubscriptionSplits(grossAmount);
            assert_1.default.strictEqual(splits.platformAmount, 4); // 5% of 80
            assert_1.default.strictEqual(splits.franchiseAmount, 0); // 0%
            assert_1.default.strictEqual(splits.vendorAmount, 76); // 95% of 80
            // Debit customer wallet
            await WalletLedgerService_1.WalletLedgerService.debit(subscription.userId, grossAmount, 'payment', task._id, 'SubscriptionDeliveryTask', `Direct task payment for run on date ${task.date}`, session);
            // Credit net vendor wallet
            await WalletLedgerService_1.WalletLedgerService.credit(subscription.vendorId, splits.vendorAmount, 'subscription_credit', task._id, 'SubscriptionDeliveryTask', `Payout for subscription delivery run on date ${task.date}`, session);
            task.isPaidToVendor = true;
            await task.save({ session });
            await session.commitTransaction();
            session.endSession();
            console.log('Task payout transactions successfully executed and committed.');
        }
        catch (txnErr) {
            await session.abortTransaction();
            session.endSession();
            throw txnErr;
        }
        // 4. AUDIT LEDGERS
        console.log('\n--- 4. Auditing wallets and ledger entries ---');
        const updatedCustomerWallet = await Wallet_1.Wallet.findOne({ userId: customer._id });
        const updatedVendorWallet = await Wallet_1.Wallet.findOne({ userId: vendor._id });
        const updatedTask = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.findById(task._id);
        assert_1.default.strictEqual(updatedCustomerWallet?.availableBalance, 920); // 1000 - 80
        assert_1.default.strictEqual(updatedVendorWallet?.availableBalance, 76); // 0 + 76
        assert_1.default.strictEqual(updatedTask?.isPaidToVendor, true);
        console.log(`Customer wallet balance verified: ${updatedCustomerWallet?.availableBalance}`);
        console.log(`Vendor wallet balance verified: ${updatedVendorWallet?.availableBalance}`);
        console.log(`Task payout status verified: ${updatedTask?.isPaidToVendor}`);
        // 5. CLEANUP
        console.log('\n--- 5. Cleaning up test data ---');
        await User_1.User.deleteMany({ email: { $in: [customerEmail, vendorEmail] } });
        await Wallet_1.Wallet.deleteMany({ userId: { $in: [customer._id, vendor._id] } });
        await LocalShopSubscription_1.default.deleteMany({ _id: subscription._id });
        await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.deleteMany({ _id: task._id });
        await WalletTransaction_1.WalletTransaction.deleteMany({ walletId: { $in: [customerWallet._id, vendorWallet._id] } });
        console.log('Cleanup completed successfully.');
        console.log('\n=======================================');
        console.log('TASK PAYOUT TEST PASSED! (100%)');
        console.log('=======================================');
    }
    catch (err) {
        console.error('\n❌ TASK PAYOUT TEST SUITE ENCOUNTERED ERROR:');
        console.error(err);
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
runTaskPayoutTest();
