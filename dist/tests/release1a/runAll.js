"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../../models/User");
const productIsolation_test_1 = require("./productIsolation.test");
const orderIsolation_test_1 = require("./orderIsolation.test");
const profileIsolation_test_1 = require("./profileIsolation.test");
const couponIsolation_test_1 = require("./couponIsolation.test");
const notificationIsolation_test_1 = require("./notificationIsolation.test");
const adminRoutes_test_1 = require("./adminRoutes.test");
dotenv_1.default.config();
const HOST = 'http://127.0.0.1:5500';
async function loginUser(email, passwordHash) {
    const res = await fetch(`${HOST}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: passwordHash })
    });
    if (!res.ok) {
        throw new Error(`Failed to login as ${email}: ${res.statusText}`);
    }
    const body = await res.json();
    return body.token;
}
async function run() {
    console.log('Starting Release 1A Integration Tests...');
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apexbee_test';
    await mongoose_1.default.connect(mongoUri);
    console.log('Connected to Database.');
    // Login users to acquire tokens
    console.log('Fetching auth tokens...');
    const tokens = {
        admin: await loginUser('admin@apexmarket.in', 'admin123'),
        vendorA: await loginUser('vendor_a@apexbee.in', 'Password123'),
        vendorB: await loginUser('vendor_b@apexbee.in', 'Password123'),
        customer: await loginUser('customer@apexbee.in', 'Password123')
    };
    console.log('Auth tokens fetched successfully.');
    // Fetch real User IDs from DB
    const vendorAUser = await User_1.User.findOne({ email: 'vendor_a@apexbee.in' });
    const vendorBUser = await User_1.User.findOne({ email: 'vendor_b@apexbee.in' });
    const customerUser = await User_1.User.findOne({ email: 'customer@apexbee.in' });
    if (!vendorAUser || !vendorBUser || !customerUser) {
        throw new Error('Could not find seeded test users in the database.');
    }
    const userIds = {
        vendorA: vendorAUser._id.toString(),
        vendorB: vendorBUser._id.toString(),
        customer: customerUser._id.toString()
    };
    try {
        await (0, productIsolation_test_1.testProductIsolation)(tokens, HOST, userIds);
        await (0, orderIsolation_test_1.testOrderIsolation)(tokens, HOST, userIds);
        await (0, profileIsolation_test_1.testProfileIsolation)(tokens, HOST, userIds);
        await (0, couponIsolation_test_1.testCouponIsolation)(tokens, HOST, userIds);
        await (0, notificationIsolation_test_1.testNotificationIsolation)(tokens, HOST, userIds);
        await (0, adminRoutes_test_1.testAdminRoutes)(tokens, HOST, userIds);
        console.log('\n=======================================');
        console.log('ALL RELEASE 1A ISOLATION TESTS PASSED!');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n=======================================');
        console.error('RELEASE 1A ISOLATION TEST SUITE FAILED!');
        console.error(err);
        console.error('=======================================');
        process.exit(1);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
run();
