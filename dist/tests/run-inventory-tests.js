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
const Coupon_1 = require("../models/Coupon");
const Inventory_1 = require("../models/Inventory");
const InventoryReservation_1 = require("../models/InventoryReservation");
const pricingService_1 = require("../services/pricingService");
const inventoryService_1 = require("../services/inventoryService");
const InsufficientStockError_1 = require("../errors/InsufficientStockError");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runInventoryTests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    // Clean up existing test data
    await User_1.User.deleteMany({ email: /@inventorytest\.com$/ });
    await Product_1.default.deleteMany({ sku: /^SKU-INVTEST/ });
    await Coupon_1.Coupon.deleteMany({ code: /^TESTCOUPON/ });
    const testVendorEmail = 'vendor@inventorytest.com';
    const testCustomerEmail = 'customer@inventorytest.com';
    try {
        // ----------------------------------------------------
        // SETUP
        // ----------------------------------------------------
        console.log('1. Setting up users, product, and coupon...');
        const vendor = new User_1.User({
            name: 'Inv Test Vendor',
            email: testVendorEmail,
            passwordHash: 'hash',
            phone: '1111111111',
            roles: ['vendor', 'customer'],
            isVerified: true,
            status: 'active',
        });
        await vendor.save();
        const customer = new User_1.User({
            name: 'Inv Test Customer',
            email: testCustomerEmail,
            passwordHash: 'hash',
            phone: '2222222222',
            roles: ['customer'],
            isVerified: true,
            status: 'active',
        });
        await customer.save();
        const product = new Product_1.default({
            name: 'Concurrency Test Item',
            sku: 'SKU-INVTEST-01',
            slug: 'concurrency-test-item',
            sellerId: vendor._id,
            sellerType: 'vendor',
            categoryId: new mongoose_1.default.Types.ObjectId(),
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
        const coupon = new Coupon_1.Coupon({
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
        const pricingResult = await pricingService_1.PricingService.calculateCheckoutPricing([{ productId: product._id.toString(), quantity: 2 }], 'TESTCOUPON10');
        // subtotal = 100 * 2 = 200
        // shippingFee = 10 * 2 = 20
        // packingFee = 5 * 2 = 10
        // discount = 10% of 200 = 20
        // grandTotal = 200 + 20 + 10 - 20 = 210
        assert_1.default.strictEqual(pricingResult.orderSummary.subtotal, 200);
        assert_1.default.strictEqual(pricingResult.orderSummary.shippingFee, 20);
        assert_1.default.strictEqual(pricingResult.orderSummary.packingFee, 10);
        assert_1.default.strictEqual(pricingResult.orderSummary.discount, 20);
        assert_1.default.strictEqual(pricingResult.orderSummary.grandTotal, 210);
        assert_1.default.strictEqual(pricingResult.sellerId, vendor._id.toString());
        console.log('Pricing Recalculation: PASS');
        // ----------------------------------------------------
        // TEST 2: Concurrency & Atomic Reservation
        // ----------------------------------------------------
        console.log('\n3. Testing Concurrent Stock Reservations...');
        // Seed/Pre-warm inventory record (stock = 10)
        await inventoryService_1.InventoryService.getOrCreateInventory(product._id.toString());
        const numRequests = 100;
        const orderId = new mongoose_1.default.Types.ObjectId();
        const reservationPromises = [];
        // Spin up 100 requests to buy 1 unit each. Exactly 10 must succeed, 90 must throw.
        for (let i = 0; i < numRequests; i++) {
            const mockOrderId = new mongoose_1.default.Types.ObjectId();
            reservationPromises.push(inventoryService_1.InventoryService.reserveStock(mockOrderId, customer._id, [{ productId: product._id.toString(), quantity: 1, variantId: null }]));
        }
        const results = await Promise.allSettled(reservationPromises);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        console.log(`Concurrent attempts finished: ${fulfilled.length} succeeded, ${rejected.length} failed.`);
        assert_1.default.strictEqual(fulfilled.length, 10, 'Exactly 10 stock reservations must succeed.');
        assert_1.default.strictEqual(rejected.length, 90, 'Exactly 90 requests must be rejected.');
        // Assert every rejection was indeed an InsufficientStockError
        for (const r of rejected) {
            assert_1.default.ok(r.reason instanceof InsufficientStockError_1.InsufficientStockError, 'Rejection reason must be an instance of InsufficientStockError');
        }
        // Verify Inventory record state
        const finalInv = await Inventory_1.Inventory.findOne({ productId: product._id });
        assert_1.default.ok(finalInv);
        assert_1.default.strictEqual(finalInv.onHand, 10, 'onHand must remain 10 before commit.');
        assert_1.default.strictEqual(finalInv.reserved, 10, 'reserved must be exactly 10.');
        assert_1.default.strictEqual(finalInv.sold, 0, 'sold must remain 0 before commit.');
        console.log('Concurrent Stock Reservations: PASS');
        // ----------------------------------------------------
        // TEST 3: Stock Commits & Releases (Cancellation flow)
        // ----------------------------------------------------
        console.log('\n4. Testing Commit and Release Actions...');
        // Find one active reservation to commit
        const oneRes = await InventoryReservation_1.InventoryReservation.findOne({ status: 'active' });
        assert_1.default.ok(oneRes);
        await inventoryService_1.InventoryService.commitStock(oneRes.orderId);
        // Check stock after commit
        const invAfterCommit = await Inventory_1.Inventory.findOne({ productId: product._id });
        assert_1.default.ok(invAfterCommit);
        assert_1.default.strictEqual(invAfterCommit.onHand, 9, 'onHand must decrement to 9.');
        assert_1.default.strictEqual(invAfterCommit.reserved, 9, 'reserved must decrement to 9.');
        assert_1.default.strictEqual(invAfterCommit.sold, 1, 'sold must increment to 1.');
        // Check reservation status
        const resAfterCommit = await InventoryReservation_1.InventoryReservation.findById(oneRes._id);
        assert_1.default.ok(resAfterCommit);
        assert_1.default.strictEqual(resAfterCommit.status, 'committed');
        // Find another active reservation to release
        const anotherRes = await InventoryReservation_1.InventoryReservation.findOne({ status: 'active' });
        assert_1.default.ok(anotherRes);
        await inventoryService_1.InventoryService.releaseStock(anotherRes.orderId);
        // Check stock after release
        const invAfterRelease = await Inventory_1.Inventory.findOne({ productId: product._id });
        assert_1.default.ok(invAfterRelease);
        assert_1.default.strictEqual(invAfterRelease.onHand, 9, 'onHand must remain 9 on release.');
        assert_1.default.strictEqual(invAfterRelease.reserved, 8, 'reserved must decrement to 8.');
        assert_1.default.strictEqual(invAfterRelease.sold, 1, 'sold must remain 1 on release.');
        console.log('Commit and Release Actions: PASS');
        // ----------------------------------------------------
        // CLEANUP
        // ----------------------------------------------------
        console.log('\n5. Cleaning up test data...');
        await User_1.User.deleteMany({ email: /@inventorytest\.com$/ });
        await Product_1.default.deleteMany({ sku: /^SKU-INVTEST/ });
        await Coupon_1.Coupon.deleteMany({ code: /^TESTCOUPON/ });
        await Inventory_1.Inventory.deleteMany({ productId: product._id });
        await InventoryReservation_1.InventoryReservation.deleteMany({ userId: customer._id });
        console.log('Cleanup finished.');
        console.log('\n=======================================');
        console.log('ALL INVENTORY INTEGRITY TESTS PASSED! (100%)');
        console.log('=======================================');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST SUITE RUN ENCOUNTERED CRITICAL ERROR:');
        console.error(err);
        // Clean up connections
        try {
            await mongoose_1.default.disconnect();
        }
        catch { }
        process.exit(1);
    }
}
runInventoryTests();
