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
const WalletEngine_1 = require("../services/WalletEngine");
const SettlementEngine_1 = require("../services/SettlementEngine");
const CommissionSettlement_1 = require("../models/CommissionSettlement");
const Order_1 = require("../models/Order");
const Product_1 = __importDefault(require("../models/Product"));
const BusinessRelationship_1 = require("../models/BusinessRelationship");
const ReferralSettings_1 = require("../models/ReferralSettings");
const ReferralTransaction_1 = require("../models/ReferralTransaction");
const WalletTransaction_1 = require("../models/WalletTransaction");
require("../models/Franchise");
require("../models/Entrepreneur");
require("../models/Vendor");
require("../models/ServiceProvider");
require("../models/Wholesaler");
require("../models/Manufacturer");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runTests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected. Clearing test data...');
    const testSuffix = `_test_${Date.now()}`;
    const testEmail = `user${testSuffix}@test.com`;
    // Clean up existing test data if any (SCOPED to test users only — never wipe real data)
    const existingTestUsers = await User_1.User.find({ email: /@test\.com$/ }).select('_id');
    const testUserIds = existingTestUsers.map(u => u._id);
    if (testUserIds.length > 0) {
        await Wallet_1.Wallet.deleteMany({ userId: { $in: testUserIds } });
        await WalletTransaction_1.WalletTransaction.deleteMany({ userId: { $in: testUserIds } });
        await CommissionSettlement_1.CommissionSettlement.deleteMany({ recipientId: { $in: testUserIds } });
        await ReferralTransaction_1.ReferralTransaction.deleteMany({ $or: [
                { recipientUserId: { $in: testUserIds } },
                { referredUserId: { $in: testUserIds } }
            ] });
    }
    await User_1.User.deleteMany({ email: /@test\.com$/ });
    await Product_1.default.deleteMany({ sku: /^SKU-TEST/ });
    await Order_1.Order.deleteMany({ orderNumber: /^ORD-TEST/ });
    try {
        // ----------------------------------------------------
        // SETUP TEST ENTITIES
        // ----------------------------------------------------
        console.log('1. Setting up test entities...');
        const user = new User_1.User({
            name: 'Test Vendor User',
            email: testEmail,
            passwordHash: 'test_hash',
            phone: '1234567890',
            roles: ['vendor', 'customer'],
            status: 'active',
            isVerified: true
        });
        await user.save();
        const product = new Product_1.default({
            sellerId: user._id,
            sellerType: 'vendor',
            name: 'Test Product',
            slug: `test-product-${Date.now()}`,
            description: 'Test product description',
            categoryId: new mongoose_1.default.Types.ObjectId(),
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
        const order = new Order_1.Order({
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
        const rel = new BusinessRelationship_1.BusinessRelationship({
            userId: user._id,
            businessId: user._id,
            businessType: 'vendor',
            status: 'active',
            stateFranchiseId: SettlementEngine_1.SettlementEngine.COMPANY_ID, // Use Company system wallet for convenience
            districtFranchiseId: SettlementEngine_1.SettlementEngine.COMPANY_ID,
            mandalFranchiseId: SettlementEngine_1.SettlementEngine.COMPANY_ID,
            entrepreneurId: SettlementEngine_1.SettlementEngine.COMPANY_ID
        });
        await rel.save();
        console.log('Setup completed successfully.');
        // ====================================================
        // WALLET ENGINE TESTS
        // ====================================================
        console.log('\n2. Running WalletEngine tests...');
        // A. credit
        console.log(' - Testing WalletEngine.credit()');
        let wallet = await WalletEngine_1.WalletEngine.credit(user._id, 100, {
            category: 'Test Credit',
            source: 'test',
            remarks: 'Credit test remarks'
        });
        assert_1.default.strictEqual(wallet.availableBalance, 100);
        assert_1.default.strictEqual(wallet.ledgerEntries.length, 1);
        assert_1.default.strictEqual(wallet.ledgerEntries[0]?.type, 'credit');
        assert_1.default.strictEqual(wallet.ledgerEntries[0]?.amount, 100);
        assert_1.default.strictEqual(wallet.ledgerEntries[0]?.status, 'completed');
        assert_1.default.ok(wallet.ledgerEntries[0]?.transactionId?.startsWith('TXN_'));
        // B. hold
        console.log(' - Testing WalletEngine.hold()');
        wallet = await WalletEngine_1.WalletEngine.hold(user._id, 50, {
            category: 'Test Hold',
            source: 'test',
            remarks: 'Hold test remarks'
        });
        assert_1.default.strictEqual(wallet.availableBalance, 100);
        assert_1.default.strictEqual(wallet.pendingBalance, 50);
        assert_1.default.strictEqual(wallet.ledgerEntries.length, 2);
        assert_1.default.strictEqual(wallet.ledgerEntries[1]?.status, 'pending');
        // C. release
        console.log(' - Testing WalletEngine.release()');
        wallet = await WalletEngine_1.WalletEngine.release(user._id, 30, {
            category: 'Test Release',
            source: 'test',
            remarks: 'Release test remarks',
            referenceId: order._id // using order ID mock
        });
        assert_1.default.strictEqual(wallet.availableBalance, 130);
        assert_1.default.strictEqual(wallet.pendingBalance, 20); // 50 - 30
        // D. reverse
        console.log(' - Testing WalletEngine.reverse()');
        wallet = await WalletEngine_1.WalletEngine.reverse(user._id, 20, {
            category: 'Test Reverse',
            source: 'test',
            remarks: 'Reverse test remarks'
        });
        assert_1.default.strictEqual(wallet.availableBalance, 130);
        assert_1.default.strictEqual(wallet.pendingBalance, 0); // 20 - 20
        // E. debit
        console.log(' - Testing WalletEngine.debit()');
        wallet = await WalletEngine_1.WalletEngine.debit(user._id, 40, {
            category: 'Test Debit',
            source: 'test',
            remarks: 'Debit test remarks'
        });
        assert_1.default.strictEqual(wallet.availableBalance, 90); // 130 - 40
        console.log('WalletEngine tests: PASS');
        // ====================================================
        // SETTLEMENT ENGINE TESTS
        // ====================================================
        console.log('\n3. Running SettlementEngine tests...');
        // A. createSettlements
        console.log(' - Testing SettlementEngine.createSettlements()');
        await SettlementEngine_1.SettlementEngine.createSettlements(order);
        // Query settlements generated
        const settlements = await CommissionSettlement_1.CommissionSettlement.find({ orderId: order._id });
        assert_1.default.ok(settlements.length > 0);
        // Check vendor settlement exists
        const vendorSettlement = settlements.find(s => s.settlementType === 'vendor');
        assert_1.default.ok(vendorSettlement);
        assert_1.default.strictEqual(vendorSettlement.status, 'placed');
        // finalSellerAmount = 90 * quantity 2 = 180
        assert_1.default.strictEqual(vendorSettlement.amount, 180);
        // B. pendSettlements
        console.log(' - Testing SettlementEngine.pendSettlements()');
        await SettlementEngine_1.SettlementEngine.pendSettlements(order._id);
        const pendedSettlements = await CommissionSettlement_1.CommissionSettlement.find({ orderId: order._id });
        assert_1.default.ok(pendedSettlements.every(s => s.status === 'pending'));
        // Check wallet pending balances (should increase by settlement amounts)
        const vendorWallet = await Wallet_1.Wallet.findOne({ userId: user._id });
        assert_1.default.ok(vendorWallet);
        // Previous pending balance was 0. Vendor settlement pending = 180.
        assert_1.default.strictEqual(vendorWallet.pendingBalance, 180);
        // C. releaseEligibleSettlements
        console.log(' - Testing SettlementEngine.releaseEligibleSettlements()');
        // Artificially change releaseDate of settlements to past so they are eligible
        await CommissionSettlement_1.CommissionSettlement.updateMany({ orderId: order._id }, { $set: { releaseDate: new Date(Date.now() - 3600000) } });
        const releaseStats = await SettlementEngine_1.SettlementEngine.releaseEligibleSettlements();
        assert_1.default.ok(releaseStats.releasedSettlements > 0);
        const releasedSettlements = await CommissionSettlement_1.CommissionSettlement.find({ orderId: order._id });
        assert_1.default.ok(releasedSettlements.every(s => s.status === 'released'));
        const vendorWalletReleased = await Wallet_1.Wallet.findOne({ userId: user._id });
        assert_1.default.ok(vendorWalletReleased);
        // pendingBalance should decrease to 0, availableBalance should increase by 180 (90 + 180 = 270)
        assert_1.default.strictEqual(vendorWalletReleased.pendingBalance, 0);
        assert_1.default.strictEqual(vendorWalletReleased.availableBalance, 270);
        // D. cancelSettlements
        console.log(' - Testing SettlementEngine.cancelSettlements()');
        // Let's create another order and settlements to cancel
        const order2 = new Order_1.Order({
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
        await SettlementEngine_1.SettlementEngine.createSettlements(order2);
        await SettlementEngine_1.SettlementEngine.pendSettlements(order2._id);
        // Cancel the second order settlements
        await SettlementEngine_1.SettlementEngine.cancelSettlements(order2._id);
        const cancelledSettlements = await CommissionSettlement_1.CommissionSettlement.find({ orderId: order2._id });
        assert_1.default.ok(cancelledSettlements.every(s => s.status === 'cancelled'));
        // E. Product-defined First Purchase Commission Test
        console.log(' - Testing product-defined first order commission');
        // Create a referrer user
        const referrer = new User_1.User({
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
        const referredCustomer = new User_1.User({
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
        const productFirstPurchase = new Product_1.default({
            sellerId: user._id,
            sellerType: 'vendor',
            name: 'First Purchase Promo Product',
            slug: `first-purchase-promo-${Date.now()}`,
            description: 'Test first purchase promo',
            categoryId: new mongoose_1.default.Types.ObjectId(),
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
        let refSettings = await ReferralSettings_1.ReferralSettings.findOne({});
        if (!refSettings) {
            refSettings = new ReferralSettings_1.ReferralSettings({ enabled: true, firstOrderRewards: { level1: 50, level2: 25, level3: 15 } });
        }
        else {
            refSettings.enabled = true;
            refSettings.firstOrderRewards = { level1: 50, level2: 25, level3: 15 };
        }
        await refSettings.save();
        // Create first order for referred customer
        const orderFP = new Order_1.Order({
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
        await SettlementEngine_1.SettlementEngine.createSettlements(orderFP);
        // Verify first purchase commission created is exactly ₹22.5 (from product configuration)
        const fpTx = await ReferralTransaction_1.ReferralTransaction.findOne({
            referredUserId: referredCustomer._id,
            recipientUserId: referrer._id,
            transactionType: 'first_purchase_product_commission'
        });
        assert_1.default.ok(fpTx);
        assert_1.default.strictEqual(fpTx.amount, 22.5);
        // Verify direct referral bonus of ₹50 also created
        const directBonusTx = await ReferralTransaction_1.ReferralTransaction.findOne({
            referredUserId: referredCustomer._id,
            recipientUserId: referrer._id,
            transactionType: 'first_order_bonus'
        });
        assert_1.default.ok(directBonusTx);
        assert_1.default.strictEqual(directBonusTx.amount, 50);
        // F. Fallback First Purchase Commission Test
        console.log(' - Testing product first order fallback to settings');
        // Create another referred user
        const referredCustomerFallback = new User_1.User({
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
        const orderFallback = new Order_1.Order({
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
        await SettlementEngine_1.SettlementEngine.createSettlements(orderFallback);
        // Verify first purchase commission is fallback ₹50
        const fbTx = await ReferralTransaction_1.ReferralTransaction.findOne({
            referredUserId: referredCustomerFallback._id,
            recipientUserId: referrer._id,
            transactionType: 'first_order_bonus'
        });
        assert_1.default.ok(fbTx);
        assert_1.default.strictEqual(fbTx.amount, 50);
        // Clean up our extra users, products and transactions from this test
        await User_1.User.deleteMany({ email: { $in: [`referrer${testSuffix}@test.com`, `referred${testSuffix}@test.com`, `referred-fb${testSuffix}@test.com`] } });
        await Product_1.default.deleteOne({ _id: productFirstPurchase._id });
        await Order_1.Order.deleteMany({ _id: { $in: [orderFP._id, orderFallback._id] } });
        await ReferralTransaction_1.ReferralTransaction.deleteMany({ referredUserId: { $in: [referredCustomer._id, referredCustomerFallback._id] } });
        console.log('SettlementEngine tests: PASS');
        // ====================================================
        // WITHDRAWAL TESTS (APPROVE & REJECT)
        // ====================================================
        console.log('\n4. Running Withdrawal flow tests...');
        // Reset wallet available balance to 500 for clean test
        await Wallet_1.Wallet.findOneAndUpdate({ userId: user._id }, { $set: { availableBalance: 500, pendingBalance: 0, withdrawnBalance: 0, ledgerEntries: [] } });
        // Request a withdrawal via WalletEngine.debit in pending status
        let testWallet = await WalletEngine_1.WalletEngine.debit(user._id, 200, {
            category: 'Withdrawal',
            source: 'withdrawal',
            remarks: 'Withdrawal test',
            status: 'pending',
            referenceType: 'WITHDRAWAL'
        });
        assert_1.default.strictEqual(testWallet.availableBalance, 300);
        assert_1.default.strictEqual(testWallet.pendingBalance, 200);
        const withdrawalEntry = testWallet.ledgerEntries[0];
        assert_1.default.ok(withdrawalEntry);
        assert_1.default.strictEqual(withdrawalEntry.status, 'pending');
        // Test Approve Withdrawal
        console.log(' - Testing approveWithdrawal()');
        testWallet = await WalletEngine_1.WalletEngine.approveWithdrawal(user._id, withdrawalEntry._id);
        assert_1.default.strictEqual(testWallet.availableBalance, 300);
        assert_1.default.strictEqual(testWallet.pendingBalance, 0);
        assert_1.default.strictEqual(testWallet.withdrawnBalance, 200);
        assert_1.default.strictEqual(testWallet.ledgerEntries[0]?.status, 'completed');
        // Test Reject Withdrawal
        console.log(' - Testing rejectWithdrawal()');
        // Trigger another pending withdrawal of 100
        testWallet = await WalletEngine_1.WalletEngine.debit(user._id, 100, {
            category: 'Withdrawal',
            source: 'withdrawal',
            remarks: 'Withdrawal test 2',
            status: 'pending',
            referenceType: 'WITHDRAWAL'
        });
        assert_1.default.strictEqual(testWallet.availableBalance, 200); // 300 - 100
        assert_1.default.strictEqual(testWallet.pendingBalance, 100);
        const withdrawalEntry2 = testWallet.ledgerEntries.find(e => e.remarks === 'Withdrawal test 2');
        assert_1.default.ok(withdrawalEntry2);
        testWallet = await WalletEngine_1.WalletEngine.rejectWithdrawal(user._id, withdrawalEntry2._id);
        assert_1.default.strictEqual(testWallet.availableBalance, 300); // Reversed (200 + 100)
        assert_1.default.strictEqual(testWallet.pendingBalance, 0);
        const reversedRefundEntry = testWallet.ledgerEntries.find(e => e.category === 'Refund');
        assert_1.default.ok(reversedRefundEntry);
        assert_1.default.strictEqual(reversedRefundEntry.amount, 100);
        console.log('Withdrawal tests: PASS');
        // ----------------------------------------------------
        // CLEANUP
        // ----------------------------------------------------
        console.log('\n5. Cleaning up test documents...');
        await User_1.User.deleteMany({ email: testEmail });
        await Wallet_1.Wallet.deleteMany({ userId: user._id });
        await Product_1.default.deleteMany({ sellerId: user._id });
        await Order_1.Order.deleteMany({ customerId: user._id });
        await CommissionSettlement_1.CommissionSettlement.deleteMany({ orderId: { $in: [order._id, order2._id] } });
        await BusinessRelationship_1.BusinessRelationship.deleteMany({ businessId: user._id });
        console.log('Cleanup completed successfully.');
        console.log('\n=======================================');
        console.log('ALL TESTS PASSED SUCCESSFULLY! (100% PASS)');
        console.log('=======================================');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST SUITE FAILED CONSTRAINTS OR FAILURE ENCOUNTERED:');
        console.error(err);
        // Ensure database disconnection on error
        try {
            await mongoose_1.default.disconnect();
        }
        catch { }
        process.exit(1);
    }
}
runTests();
