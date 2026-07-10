"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const Vendor_1 = require("../models/Vendor");
const User_1 = require("../models/User");
const Address_1 = require("../models/Address");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected to DB');
    const subs = await LocalShopSubscription_1.default.find();
    console.log(`Found ${subs.length} subscriptions`);
    for (const s of subs) {
        console.log(`\n--- Subscription ID: ${s._id} ---`);
        console.log(`userId: ${s.userId}`);
        console.log(`productId: ${s.productId}`);
        console.log(`vendorId (ref Vendor): ${s.vendorId}`);
        console.log(`productName: ${s.productName}`);
        console.log(`quantity: ${s.quantity}`);
        const user = await User_1.User.findById(s.userId);
        console.log(`Customer User: ${user ? `${user.name} (${user.email})` : 'Not Found'}`);
        const addr = await Address_1.Address.findOne({ userId: s.userId });
        console.log(`Customer Address in DB: ${addr ? `${addr.address}, ${addr.city}` : 'None'}`);
        // Try finding in Vendor
        const vendorByVendorId = await Vendor_1.Vendor.findById(s.vendorId);
        console.log(`Vendor by vendorId (findById): ${vendorByVendorId ? `${vendorByVendorId.businessName} (Owner: ${vendorByVendorId.ownerName}, Address: ${vendorByVendorId.address})` : 'Not Found'}`);
        // Try finding by userId (if vendorId field holds the user ID instead of vendor _id)
        const vendorByUserId = await Vendor_1.Vendor.findOne({ userId: s.vendorId });
        console.log(`Vendor by vendorId as userId (findOne): ${vendorByUserId ? `${vendorByUserId.businessName} (Owner: ${vendorByUserId.ownerName}, Address: ${vendorByUserId.address})` : 'Not Found'}`);
    }
    const allAddresses = await Address_1.Address.find();
    console.log(`\n--- ALL ADDRESSES IN DB (${allAddresses.length}) ---`);
    for (const a of allAddresses) {
        console.log(`Address ID: ${a._id}, userId: ${a.userId}, address: ${a.address}, city: ${a.city}`);
    }
    await mongoose_1.default.disconnect();
}
run();
