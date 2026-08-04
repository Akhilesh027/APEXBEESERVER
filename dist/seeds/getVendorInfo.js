"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Vendor_1 = require("../models/Vendor");
const User_1 = require("../models/User");
const VendorSubscription_1 = require("../modules/subscription/models/VendorSubscription");
dotenv_1.default.config();
async function getVendorInfo() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose_1.default.connect(mongoURI);
    try {
        const email = 'akhil@gmail.com';
        console.log(`Searching for email: ${email}`);
        const user = await User_1.User.findOne({ email });
        console.log('\n--- USER RECORD ---');
        console.log(user ? JSON.stringify(user, null, 2) : 'User not found in User collection');
        let vendor = null;
        if (user) {
            vendor = await Vendor_1.Vendor.findOne({ $or: [{ userId: user._id }, { email }] });
        }
        else {
            vendor = await Vendor_1.Vendor.findOne({ email });
        }
        console.log('\n--- VENDOR RECORD ---');
        console.log(vendor ? JSON.stringify(vendor, null, 2) : 'Vendor not found in Vendor collection');
        if (vendor) {
            const sub = await VendorSubscription_1.VendorSubscription.findOne({ vendorId: vendor._id });
            console.log('\n--- SUBSCRIPTION RECORD ---');
            console.log(sub ? JSON.stringify(sub, null, 2) : 'No VendorSubscription record found');
        }
    }
    catch (err) {
        console.error('Error fetching vendor info:', err.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
getVendorInfo();
