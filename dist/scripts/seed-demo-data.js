"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const Wallet_1 = require("../models/Wallet");
const Order_1 = require("../models/Order");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
// IDs fetched from live DB
const PRODUCT_ID = new mongoose_1.default.Types.ObjectId('6a477247fe6b8d23e56a1d0e');
const SELLER_ID = new mongoose_1.default.Types.ObjectId('6a477021fe6b8d23e568b53e');
const INDIAN_CITIES = [
    { city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    { city: 'Warangal', state: 'Telangana', pincode: '506004' },
    { city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
    { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    { city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
    { city: 'Pune', state: 'Maharashtra', pincode: '411001' },
    { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
];
const ORDER_STATUSES = [
    'Placed', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'
];
const PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed'];
function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function randomPhone(i) {
    return `9${String(i + 100000000).slice(1)}`;
}
function randomDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
    return d;
}
async function seedData() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected.');
    // ---------- 1. SEED 500 USERS ----------
    console.log('\nSeeding 500 users...');
    await User_1.User.deleteMany({ email: /@demotest\.com$/ });
    const passwordHash = await bcryptjs_1.default.hash('Demo@1234', 10);
    const userDocs = [];
    for (let i = 1; i <= 500; i++) {
        userDocs.push({
            _id: new mongoose_1.default.Types.ObjectId(),
            name: `Demo User ${i}`,
            email: `user_${i}@demotest.com`,
            passwordHash,
            phone: randomPhone(i),
            roles: ['customer'],
            isVerified: true,
            status: 'active',
        });
    }
    await User_1.User.insertMany(userDocs);
    console.log(`Inserted ${userDocs.length} demo users.`);
    // ---------- 2. SEED WALLETS ----------
    console.log('Seeding wallets for demo users...');
    const walletDocs = userDocs.map(u => ({
        userId: u._id,
        availableBalance: Math.floor(Math.random() * 2000 + 100),
        pendingBalance: 0,
        withdrawnBalance: 0,
        version: 0,
    }));
    await Wallet_1.Wallet.insertMany(walletDocs);
    console.log(`Inserted ${walletDocs.length} wallets.`);
    // ---------- 3. SEED 300 ORDERS ----------
    console.log('\nSeeding 300 orders...');
    await Order_1.Order.deleteMany({ orderNumber: /^DEMO-/ });
    const orderDocs = [];
    const qty = 1;
    const price = 4500;
    for (let i = 1; i <= 300; i++) {
        const customer = randomFrom(userDocs);
        const location = randomFrom(INDIAN_CITIES);
        const orderStatus = randomFrom(ORDER_STATUSES);
        const paymentStatus = randomFrom(PAYMENT_STATUSES);
        const createdAt = randomDate(90);
        orderDocs.push({
            orderNumber: `DEMO-${Date.now()}-${i}`,
            customerId: customer._id,
            sellerId: SELLER_ID,
            items: [{
                    productId: PRODUCT_ID,
                    productName: 'Demo Product',
                    sku: 'FAS-PROD-68399',
                    quantity: qty,
                    price,
                }],
            totalAmount: price * qty,
            orderStatus,
            paymentStatus,
            deliveryType: 'Platform',
            customerName: customer.name,
            customerPhone: customer.phone,
            shippingAddress: {
                name: customer.name,
                phone: customer.phone,
                addressLine1: `${i} Demo Street`,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
            },
            orderSummary: {
                subtotal: price * qty,
                total: price * qty,
            },
            paymentDetails: {
                method: 'cod',
                amount: price * qty,
            },
            timeline: [{
                    status: 'Placed',
                    date: createdAt.toISOString(),
                    note: 'Order placed by demo seed',
                }],
            commissionReleaseStatus: orderStatus === 'Delivered' ? 'Released' : 'Pending',
            createdAt,
            updatedAt: createdAt,
        });
    }
    await Order_1.Order.insertMany(orderDocs);
    console.log(`Inserted ${orderDocs.length} demo orders.`);
    console.log('\n=======================================');
    console.log('SEEDED: 500 Users + 500 Wallets + 300 Orders');
    console.log('=======================================');
    process.exit(0);
}
seedData().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
