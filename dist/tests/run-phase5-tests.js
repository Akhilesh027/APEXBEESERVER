"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const assert_1 = __importDefault(require("assert"));
const User_1 = require("../models/User");
const Product_1 = __importDefault(require("../models/Product"));
const Inventory_1 = require("../models/Inventory");
const InventoryReservation_1 = require("../models/InventoryReservation");
const inventoryService_1 = require("../services/inventoryService");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runPhase5Tests() {
    console.log('Starting Phase 5 Inventory Expiry Verification Tests...');
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    // Clean up existing test data
    await User_1.User.deleteMany({ email: /@phase5test\.com$/ });
    await Product_1.default.deleteMany({ sku: /^SKU-PHASE5/ });
    await InventoryReservation_1.InventoryReservation.deleteMany({});
    const testVendorEmail = 'vendor@phase5test.com';
    const testCustomerEmail = 'customer@phase5test.com';
    try {
        console.log('1. Setting up mock users, products, and inventory...');
        const vendor = new User_1.User({
            name: 'Phase5 Test Vendor',
            email: testVendorEmail,
            passwordHash: 'hash',
            phone: '1111111155',
            roles: ['vendor', 'customer'],
            isVerified: true,
            status: 'active',
        });
        await vendor.save();
        const customer = new User_1.User({
            name: 'Phase5 Test Customer',
            email: testCustomerEmail,
            passwordHash: 'hash',
            phone: '2222222255',
            roles: ['customer'],
            isVerified: true,
            status: 'active',
        });
        await customer.save();
        const product = new Product_1.default({
            name: 'Phase 5 Item',
            sku: 'SKU-PHASE5-01',
            slug: 'phase5-item',
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
        // Setup inventory with 10 onHand, 2 reserved
        const inventory = new Inventory_1.Inventory({
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
        const expiredRes = new InventoryReservation_1.InventoryReservation({
            reservationId: 'RES-PHASE5-EXP',
            orderId: new mongoose_1.default.Types.ObjectId(),
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
        const invBefore = await Inventory_1.Inventory.findOne({ productId: product._id });
        console.log('Inventory before sweep:', invBefore);
        const releasedCount = await inventoryService_1.InventoryService.cleanupExpiredReservations();
        assert_1.default.strictEqual(releasedCount, 1, 'Exactly 1 expired reservation must be swept and released');
        // Verify reservation status is updated
        const updatedRes = await InventoryReservation_1.InventoryReservation.findOne({ reservationId: 'RES-PHASE5-EXP' });
        assert_1.default.ok(updatedRes);
        assert_1.default.strictEqual(updatedRes.status, 'expired', 'Reservation status must transition to expired');
        // Verify inventory counts and version changes
        const updatedInv = await Inventory_1.Inventory.findOne({ productId: product._id });
        assert_1.default.ok(updatedInv);
        assert_1.default.strictEqual(updatedInv.reserved, 0, 'Reserved stock count must be decremented to 0');
        assert_1.default.strictEqual(updatedInv.onHand, 10, 'OnHand stock count must remain 10');
        assert_1.default.strictEqual(updatedInv.version, 1, 'Inventory version must be incremented by 1');
        console.log('Reservation Expiry Sweep: PASS');
        // ----------------------------------------------------
        // TEST 2: Concurrent/Duplicate sweeps are skipped
        // ----------------------------------------------------
        console.log('\n3. Verifying subsequent sweeps skip already expired items...');
        const rerunReleasedCount = await inventoryService_1.InventoryService.cleanupExpiredReservations();
        assert_1.default.strictEqual(rerunReleasedCount, 0, 'No reservations should be released on rerun');
        console.log('Duplicate sweeps skipped: PASS');
        console.log('\n=======================================');
        console.log('ALL PHASE 5 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase5Tests();
