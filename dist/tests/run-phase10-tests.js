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
const IdempotencyRecord_1 = require("../models/IdempotencyRecord");
const orderIdempotencyService_1 = require("../services/orderIdempotencyService");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runPhase10Tests() {
    console.log('Starting Phase 10 Clustered Concurrency & Idempotency Tests...');
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    // Clean up existing test data
    await User_1.User.deleteMany({ email: /@phase10test\.com$/ });
    await IdempotencyRecord_1.IdempotencyRecord.deleteMany({});
    const testUserEmail = 'customer@phase10test.com';
    try {
        console.log('1. Setting up mock customer...');
        const customer = new User_1.User({
            name: 'Phase10 Test Customer',
            email: testUserEmail,
            passwordHash: 'hash',
            phone: '3333333399',
            roles: ['customer'],
            isVerified: true,
            status: 'active',
        });
        await customer.save();
        console.log('Mock customer created.');
        const idemKey = 'concurrent-test-key-123';
        const payload = { items: [{ productId: 'prod-1', quantity: 2 }] };
        console.log('\n2. Simulating concurrent checkout requests from multiple backend API instances...');
        // Simulate API Instance A starting checkout
        console.log('API Instance A: Initiating checkout with idempotency key...');
        const resultA = await orderIdempotencyService_1.OrderIdempotencyService.checkOrRecord(customer._id.toString(), idemKey, payload);
        assert_1.default.strictEqual(resultA.duplicate, false, 'First request must register successfully as non-duplicate');
        console.log('API Instance A: Locked key successfully.');
        // Simulating API Instance B attempting a concurrent checkout request with the same key
        console.log('API Instance B: Initiating checkout concurrently with the same key...');
        let thrownError = null;
        try {
            await orderIdempotencyService_1.OrderIdempotencyService.checkOrRecord(customer._id.toString(), idemKey, payload);
        }
        catch (err) {
            thrownError = err;
        }
        assert_1.default.ok(thrownError, 'Concurrent request with same key must throw an error');
        assert_1.default.ok(thrownError.message.includes('already processing'), 'Error message must state request is already processing');
        console.log('API Instance B: Blocked concurrent request successfully.');
        // Simulate API Instance A completing checkout successfully
        console.log('API Instance A: Resolving checkout successfully...');
        const responsePayload = { order: { _id: 'order-abc-123', total: 200 } };
        await orderIdempotencyService_1.OrderIdempotencyService.updateStatus(customer._id.toString(), idemKey, 'completed', responsePayload);
        console.log('API Instance A: Resolved key.');
        // Simulate a subsequent duplicate request hitting API Instance B after completion
        console.log('API Instance B: Receiving request after completion...');
        const resultB = await orderIdempotencyService_1.OrderIdempotencyService.checkOrRecord(customer._id.toString(), idemKey, payload);
        assert_1.default.strictEqual(resultB.duplicate, true, 'Subsequent request must return duplicate response');
        assert_1.default.strictEqual(resultB.response?.order?._id, 'order-abc-123', 'Returned duplicate response must match cached order ID');
        console.log('API Instance B: Returned duplicate response correctly.');
        console.log('\n=======================================');
        console.log('ALL PHASE 10 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase10Tests();
