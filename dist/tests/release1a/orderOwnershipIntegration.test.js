"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_ENV = 'test';
const mongoose_1 = __importDefault(require("mongoose"));
const supertest_1 = __importDefault(require("supertest"));
const assert_1 = __importDefault(require("assert"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const server_1 = require("../../server");
const User_1 = require("../../models/User");
const Order_1 = require("../../models/Order");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_integration_test';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork';
async function runIntegrationTest() {
    console.log('Connecting to integration test database...');
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected.');
    // Clean collections
    await User_1.User.deleteMany({ email: /@integration-test\.com$/ });
    await Order_1.Order.deleteMany({ orderNumber: /^ORD-INT-/ });
    console.log('Seeding test users...');
    const customerA = new User_1.User({
        name: 'Customer A',
        email: 'customerA@integration-test.com',
        passwordHash: 'hash',
        phone: '1234567891',
        roles: ['customer'],
        status: 'active',
        isVerified: true
    });
    await customerA.save();
    const customerB = new User_1.User({
        name: 'Customer B',
        email: 'customerB@integration-test.com',
        passwordHash: 'hash',
        phone: '1234567892',
        roles: ['customer'],
        status: 'active',
        isVerified: true
    });
    await customerB.save();
    const vendorA = new User_1.User({
        name: 'Vendor A',
        email: 'vendorA@integration-test.com',
        passwordHash: 'hash',
        phone: '1234567893',
        roles: ['vendor'],
        status: 'active',
        isVerified: true
    });
    await vendorA.save();
    console.log('Seeding test orders...');
    const orderA = new Order_1.Order({
        orderNumber: 'ORD-INT-A',
        customerId: customerA._id,
        sellerId: vendorA._id,
        items: [{
                productId: new mongoose_1.default.Types.ObjectId(),
                productName: 'Product A',
                sku: 'SKU-A',
                quantity: 1,
                price: 100
            }],
        totalAmount: 100,
        paymentStatus: 'Pending',
        orderStatus: 'Placed'
    });
    await orderA.save();
    const orderB = new Order_1.Order({
        orderNumber: 'ORD-INT-B',
        customerId: customerB._id,
        sellerId: vendorA._id,
        items: [{
                productId: new mongoose_1.default.Types.ObjectId(),
                productName: 'Product B',
                sku: 'SKU-B',
                quantity: 1,
                price: 100
            }],
        totalAmount: 100,
        paymentStatus: 'Pending',
        orderStatus: 'Placed'
    });
    await orderB.save();
    // Generate Customer A JWT
    const tokenA = jsonwebtoken_1.default.sign({ id: customerA._id.toString(), email: customerA.email, roles: customerA.roles }, JWT_SECRET, { expiresIn: '1h' });
    console.log('Running API integration assertions...');
    try {
        // 1. Legitimate request (returns Customer A's order)
        console.log(' - Test 1: Legitimate request...');
        const resNormal = await (0, supertest_1.default)(server_1.app)
            .get('/api/orders')
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resNormal.status, 200);
        assert_1.default.strictEqual(resNormal.body.success, true);
        assert_1.default.strictEqual(resNormal.body.orders.length, 1);
        assert_1.default.strictEqual(String(resNormal.body.orders[0]._id), String(orderA._id));
        assert_1.default.strictEqual(String(resNormal.body.orders[0].customerId._id), String(customerA._id));
        assert_1.default.strictEqual(resNormal.body.pagination.total, 1);
        // 2. Spoof ?customerId=customerB
        console.log(' - Test 2: Spoof customerId...');
        const resSpoofCustomer = await (0, supertest_1.default)(server_1.app)
            .get(`/api/orders?customerId=${customerB._id}`)
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resSpoofCustomer.status, 200);
        assert_1.default.strictEqual(resSpoofCustomer.body.orders.every((o) => String(o.customerId._id) === String(customerA._id)), true);
        assert_1.default.strictEqual(resSpoofCustomer.body.orders.some((o) => String(o._id) === String(orderB._id)), false);
        assert_1.default.strictEqual(resSpoofCustomer.body.pagination.total, 1);
        // 3. Spoof ?userId=customerB
        console.log(' - Test 3: Spoof userId...');
        const resSpoofUser = await (0, supertest_1.default)(server_1.app)
            .get(`/api/orders?userId=${customerB._id}`)
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resSpoofUser.status, 200);
        assert_1.default.strictEqual(resSpoofUser.body.orders.every((o) => String(o.customerId._id) === String(customerA._id)), true);
        assert_1.default.strictEqual(resSpoofUser.body.orders.some((o) => String(o._id) === String(orderB._id)), false);
        assert_1.default.strictEqual(resSpoofUser.body.pagination.total, 1);
        // 4. Spoof ?sellerId=vendorA
        console.log(' - Test 4: Spoof sellerId...');
        const resSpoofSeller = await (0, supertest_1.default)(server_1.app)
            .get(`/api/orders?sellerId=${vendorA._id}`)
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resSpoofSeller.status, 200);
        assert_1.default.strictEqual(resSpoofSeller.body.orders.every((o) => String(o.customerId._id) === String(customerA._id)), true);
        assert_1.default.strictEqual(resSpoofSeller.body.orders.some((o) => String(o._id) === String(orderB._id)), false);
        assert_1.default.strictEqual(resSpoofSeller.body.pagination.total, 1);
        // 5. Combined malicious parameters
        console.log(' - Test 5: Spoof combined parameters...');
        const resSpoofCombined = await (0, supertest_1.default)(server_1.app)
            .get(`/api/orders?customerId=${customerB._id}&userId=${customerB._id}&sellerId=${vendorA._id}&vendorId=${vendorA._id}`)
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resSpoofCombined.status, 200);
        assert_1.default.strictEqual(resSpoofCombined.body.orders.every((o) => String(o.customerId._id) === String(customerA._id)), true);
        assert_1.default.strictEqual(resSpoofCombined.body.orders.some((o) => String(o._id) === String(orderB._id)), false);
        assert_1.default.strictEqual(resSpoofCombined.body.pagination.total, 1);
        // 6. Legitimate filters - Status Placed
        console.log(' - Test 6: Legitimate status Placed filter...');
        const resFilterPlaced = await (0, supertest_1.default)(server_1.app)
            .get('/api/orders?orderStatus=Placed')
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resFilterPlaced.status, 200);
        assert_1.default.strictEqual(resFilterPlaced.body.pagination.total, 1);
        // 7. Legitimate filters - Status Confirmed
        console.log(' - Test 7: Legitimate status Confirmed filter...');
        const resFilterConfirmed = await (0, supertest_1.default)(server_1.app)
            .get('/api/orders?orderStatus=Confirmed')
            .set('Authorization', `Bearer ${tokenA}`);
        assert_1.default.strictEqual(resFilterConfirmed.status, 200);
        assert_1.default.strictEqual(resFilterConfirmed.body.pagination.total, 0);
        // 8. Unauthenticated request (returns 401)
        console.log(' - Test 8: Unauthenticated request...');
        const resUnauth = await (0, supertest_1.default)(server_1.app)
            .get('/api/orders');
        assert_1.default.strictEqual(resUnauth.status, 401);
        console.log('\n=======================================');
        console.log('ORDER OWNERSHIP INTEGRATION TESTS PASSED!');
        console.log('=======================================');
    }
    catch (err) {
        console.error('\n=======================================');
        console.error('ORDER OWNERSHIP INTEGRATION TESTS FAILED!');
        console.error(err);
        console.error('=======================================');
        process.exitCode = 1;
    }
    finally {
        // Cleanup seeded data
        console.log('Cleaning up integration test data...');
        await User_1.User.deleteMany({ email: /@integration-test\.com$/ });
        await Order_1.Order.deleteMany({ orderNumber: /^ORD-INT-/ });
        await mongoose_1.default.connection.close();
        console.log('Database connection closed.');
        process.exit(process.exitCode || 0);
    }
}
runIntegrationTest().catch(console.error);
