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
const Order_1 = require("../models/Order");
const NotificationJob_1 = require("../modules/notifications/models/NotificationJob");
const TransactionalOutbox_1 = require("../services/TransactionalOutbox");
const checkoutService_1 = require("../services/checkoutService");
const Inventory_1 = require("../models/Inventory");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runPhase3Tests() {
    console.log('Starting Phase 3 Transactional Outbox Integration Tests...');
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    // Clean up existing test data
    await User_1.User.deleteMany({ email: /@phase3test\.com$/ });
    await Product_1.default.deleteMany({ sku: /^SKU-PHASE3/ });
    await Order_1.Order.deleteMany({ orderNumber: /^AB-PHASE3/ });
    await NotificationJob_1.NotificationJob.deleteMany({ eventCode: { $in: ['order.created', 'test.outbox_event'] } });
    const testVendorEmail = 'vendor@phase3test.com';
    const testCustomerEmail = 'customer@phase3test.com';
    try {
        console.log('1. Setting up mock users and products...');
        const vendor = new User_1.User({
            name: 'Phase3 Test Vendor',
            email: testVendorEmail,
            passwordHash: 'hash',
            phone: '1111111135',
            roles: ['vendor', 'customer'],
            isVerified: true,
            status: 'active',
        });
        await vendor.save();
        const customer = new User_1.User({
            name: 'Phase3 Test Customer',
            email: testCustomerEmail,
            passwordHash: 'hash',
            phone: '2222222235',
            roles: ['customer'],
            isVerified: true,
            status: 'active',
        });
        await customer.save();
        const product = new Product_1.default({
            name: 'Phase 3 Item',
            sku: 'SKU-PHASE3-01',
            slug: 'phase3-item',
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
        // Warm inventory
        const inventory = new Inventory_1.Inventory({
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
        // TEST 1: Schema Input Validations
        // ----------------------------------------------------
        console.log('\n2. Testing Schema Validation rules...');
        // Empty eventCode
        await assert_1.default.rejects(TransactionalOutbox_1.TransactionalOutbox.queueNotification('', {}, [{ userId: customer._id }]), /eventCode is required/);
        // Empty recipients
        await assert_1.default.rejects(TransactionalOutbox_1.TransactionalOutbox.queueNotification('test.outbox_event', {}, []), /recipients must be a non-empty array/);
        console.log('Schema validation rules: PASS');
        // ----------------------------------------------------
        // TEST 2: Transaction Rollbacks revert Outbox Entries
        // ----------------------------------------------------
        console.log('\n3. Testing Outbox atomicity on rollback...');
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        let rolledBackJobId;
        try {
            const job = await TransactionalOutbox_1.TransactionalOutbox.queueNotification('test.outbox_event', { text: 'This should rollback' }, [{ userId: customer._id }], session);
            rolledBackJobId = job._id;
            // Abort transaction
            await session.abortTransaction();
        }
        finally {
            session.endSession();
        }
        // Verify outbox entry does NOT exist in db
        const rolledBackJob = await NotificationJob_1.NotificationJob.findById(rolledBackJobId);
        assert_1.default.strictEqual(rolledBackJob, null, 'Outbox job must not exist in DB after transaction rollback');
        console.log('Outbox atomicity on rollback: PASS');
        // ----------------------------------------------------
        // TEST 3: Successful checkout writes outbox job in session
        // ----------------------------------------------------
        console.log('\n4. Testing checkout outbox event persistence...');
        const checkoutSession = await mongoose_1.default.startSession();
        checkoutSession.startTransaction();
        let orderId;
        try {
            const checkoutResult = await checkoutService_1.CheckoutService.processCheckout({
                userId: customer._id.toString(),
                orderItems: [{ productId: product._id.toString(), quantity: 1, variantId: product._id.toString() }],
                shippingAddress: { addressLine1: 'Street 1' },
                paymentDetails: { gateway: 'stripe', status: 'pending' }
            }, checkoutSession);
            orderId = checkoutResult.order._id;
            await checkoutSession.commitTransaction();
        }
        catch (err) {
            await checkoutSession.abortTransaction();
            throw err;
        }
        finally {
            checkoutSession.endSession();
        }
        // Verify outbox job for order.created exists and has correct payload
        const job = await NotificationJob_1.NotificationJob.findOne({
            eventCode: 'order.created',
            'recipients.userId': customer._id
        });
        assert_1.default.ok(job, 'Outbox job must be committed successfully');
        assert_1.default.strictEqual(job.status, 'pending', 'Outbox job must start in pending state');
        assert_1.default.strictEqual(job.payload.entityId.toString(), orderId.toString());
        console.log('Checkout outbox event persistence: PASS');
        console.log('\n=======================================');
        console.log('ALL PHASE 3 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase3Tests();
