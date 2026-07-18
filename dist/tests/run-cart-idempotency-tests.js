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
const Product_1 = __importDefault(require("../models/Product"));
const Cart_1 = __importDefault(require("../models/Cart"));
const Coupon_1 = require("../models/Coupon");
const CouponRedemption_1 = require("../models/CouponRedemption");
const IdempotencyRecord_1 = require("../models/IdempotencyRecord");
const Order_1 = require("../models/Order");
const Inventory_1 = require("../models/Inventory");
const InventoryReservation_1 = require("../models/InventoryReservation");
const cartService_1 = require("../services/cartService");
const idempotencyService_1 = require("../services/idempotencyService");
const couponService_1 = require("../services/couponService");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runCartIdempotencyTests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    const suffix = `_test_${Date.now()}`;
    const userEmails = Array.from({ length: 15 }, (_, i) => `user_${i}${suffix}@idemp.com`);
    // Clean up
    await User_1.User.deleteMany({ email: /@idemp\.com$/ });
    await Product_1.default.deleteMany({ sku: /^SKU-IDEMP/ });
    await Coupon_1.Coupon.deleteMany({ code: /^COUPON-IDEMP/ });
    await IdempotencyRecord_1.IdempotencyRecord.deleteMany({});
    await Order_1.Order.deleteMany({ orderNumber: /^AB-IDEMP/ });
    try {
        // ----------------------------------------------------
        // SETUP
        // ----------------------------------------------------
        console.log('1. Setting up users, product, and coupon...');
        const users = [];
        for (const email of userEmails) {
            const u = new User_1.User({
                name: 'Idemp Test User',
                email,
                passwordHash: 'hash',
                phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
                roles: ['customer'],
                isVerified: true,
                status: 'active',
            });
            await u.save();
            users.push(u);
        }
        const seller = new User_1.User({
            name: 'Idemp Test Vendor',
            email: `vendor${suffix}@idemp.com`,
            passwordHash: 'hash',
            phone: '1111111112',
            roles: ['vendor'],
            isVerified: true,
            status: 'active',
        });
        await seller.save();
        const product = new Product_1.default({
            name: 'Idempotency Product',
            sku: 'SKU-IDEMP-01',
            slug: `idempotency-product-${Date.now()}`,
            sellerId: seller._id,
            sellerType: 'vendor',
            categoryId: new mongoose_1.default.Types.ObjectId(),
            baseMrp: 100,
            baseSellingPrice: 80,
            stock: 100,
            status: 'Live',
            isActive: true,
            adminPricing: {
                mrp: 100,
                sellingPrice: 80,
                shippingCharge: 10,
                packingCharge: 5,
            },
        });
        await product.save();
        // Create matching Inventory document
        const inv = new Inventory_1.Inventory({
            productId: product._id,
            sellerId: seller._id,
            onHand: 100,
            reserved: 0,
            sold: 0,
            version: 0,
        });
        await inv.save();
        const coupon = new Coupon_1.Coupon({
            code: 'COUPON-IDEMP-5',
            discountType: 'percentage',
            discountValue: 10,
            minSubtotal: 20,
            expiryDate: '2030-12-31',
            status: 'Active',
            scope: 'platform',
            usageLimit: 5, // Sits exactly at 5
        });
        await coupon.save();
        console.log('Setup finished.');
        // ----------------------------------------------------
        // TEST 1: Cart Concurrency (Atomic increments)
        // ----------------------------------------------------
        console.log('\n2. Testing Concurrent Cart Additions...');
        const customer = users[0];
        const cartPromises = [];
        // Trigger 10 concurrent additions of 2 items each
        for (let i = 0; i < 10; i++) {
            cartPromises.push(cartService_1.CartService.addToCart(customer._id.toString(), product._id.toString(), 2, 'Red', 'L'));
        }
        await Promise.all(cartPromises);
        // Verify quantity is exactly 20 and items list has 1 element
        const finalCart = await Cart_1.default.findOne({ userId: customer._id });
        assert_1.default.ok(finalCart);
        assert_1.default.strictEqual(finalCart.items.length, 1, 'Cart items list must have exactly 1 logical entry.');
        assert_1.default.strictEqual(finalCart.items[0].quantity, 20, 'Quantity must equal exactly 20.');
        console.log('Concurrent Cart Additions: PASS');
        // ----------------------------------------------------
        // TEST 2: Request Idempotency (Deduplication)
        // ----------------------------------------------------
        console.log('\n3. Testing Request Idempotency...');
        const key = `KEY-${Date.now()}`;
        const payload = {
            orderItems: [{ productId: product._id.toString(), quantity: 1 }],
            shippingAddress: { name: 'Addr' },
            paymentDetails: { method: 'cod' },
        };
        const idemResults = [];
        const idemPromises = [];
        for (let i = 0; i < 5; i++) {
            idemPromises.push(idempotencyService_1.IdempotencyService.checkOrRecord(customer._id.toString(), key, payload));
        }
        const checkStates = await Promise.all(idemPromises);
        const newCount = checkStates.filter((s) => s.status === 'new').length;
        const processingCount = checkStates.filter((s) => s.status === 'processing').length;
        assert_1.default.strictEqual(newCount, 1, 'Exactly 1 request must acquire the "new" lock.');
        assert_1.default.strictEqual(processingCount, 4, 'Remaining 4 requests must get "processing" warning.');
        // Simulate completion
        const mockOrderResponse = { success: true, orderId: 'mock-order-id-123' };
        await idempotencyService_1.IdempotencyService.resolveRecord(customer._id.toString(), key, 201, mockOrderResponse, 'mock-order-id-123');
        // Now query again: must return the saved response immediately
        const postQuery = await idempotencyService_1.IdempotencyService.checkOrRecord(customer._id.toString(), key, payload);
        assert_1.default.strictEqual(postQuery.status, 'completed');
        assert_1.default.strictEqual(postQuery.responseCode, 201);
        assert_1.default.deepStrictEqual(postQuery.responseBody, mockOrderResponse);
        console.log('Request Idempotency: PASS');
        // ----------------------------------------------------
        // TEST 3: Concurrent Coupon Redemptions
        // ----------------------------------------------------
        console.log('\n4. Testing Concurrent Coupon Redemptions...');
        const couponRedeemPromises = [];
        const orderId = new mongoose_1.default.Types.ObjectId();
        // Trigger redemptions across 12 different users. Max limit is 5.
        for (let i = 0; i < 12; i++) {
            const u = users[i];
            couponRedeemPromises.push(couponService_1.CouponService.redeemCoupon('COUPON-IDEMP-5', u._id.toString(), new mongoose_1.default.Types.ObjectId(), 100, // subtotal
            seller._id.toString()));
        }
        const redeemResults = await Promise.allSettled(couponRedeemPromises);
        const redeemSucceeded = redeemResults.filter((r) => r.status === 'fulfilled');
        const redeemRejected = redeemResults.filter((r) => r.status === 'rejected');
        console.log(`Coupon redemptions finished: ${redeemSucceeded.length} succeeded, ${redeemRejected.length} failed.`);
        assert_1.default.strictEqual(redeemSucceeded.length, 5, 'Exactly 5 coupon redemptions must succeed.');
        assert_1.default.strictEqual(redeemRejected.length, 7, 'Exactly 7 coupon redemptions must fail.');
        // Check Coupon document usageCount in database
        const finalCoupon = await Coupon_1.Coupon.findOne({ code: 'COUPON-IDEMP-5' });
        assert_1.default.ok(finalCoupon);
        assert_1.default.strictEqual(finalCoupon.usageCount, 5, 'usageCount must equal exactly 5.');
        console.log('Concurrent Coupon Redemptions: PASS');
        // ----------------------------------------------------
        // CLEANUP
        // ----------------------------------------------------
        console.log('\n5. Cleaning up test documents...');
        await User_1.User.deleteMany({ email: /@idemp\.com$/ });
        await Product_1.default.deleteMany({ sku: /^SKU-IDEMP/ });
        await Coupon_1.Coupon.deleteMany({ code: /^COUPON-IDEMP/ });
        await Inventory_1.Inventory.deleteMany({ productId: product._id });
        await InventoryReservation_1.InventoryReservation.deleteMany({ userId: { $in: users.map((u) => u._id) } });
        await CouponRedemption_1.CouponRedemption.deleteMany({ couponId: coupon._id });
        await IdempotencyRecord_1.IdempotencyRecord.deleteMany({});
        console.log('Cleanup finished.');
        console.log('\n=======================================');
        console.log('ALL CART & IDEMPOTENCY TESTS PASSED! (100%)');
        console.log('=======================================');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        try {
            await mongoose_1.default.disconnect();
        }
        catch { }
        process.exit(1);
    }
}
runCartIdempotencyTests();
