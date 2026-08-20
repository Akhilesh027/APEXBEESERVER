"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
const VENDORS_TO_ENSURE = [
    {
        email: 'ramesh.hyd.vendor@testapexbee.com',
        name: 'Ramesh Reddy',
        phone: '9848011001',
        password: 'TestVendor@123',
        businessName: 'Apex Madhapur Fresh & Artisan Hub',
        pincode: '500081',
        city: 'Hyderabad',
        district: 'Hyderabad',
        mandal: 'Serilingampally',
        state: 'Telangana',
        address: 'Plot 42, Hitech City Main Rd, Madhapur',
        coordinates: [78.3847, 17.4483]
    },
    {
        email: 'suresh.gachi.vendor@testapexbee.com',
        name: 'Suresh Kumar',
        phone: '9848011002',
        password: 'TestVendor@123',
        businessName: 'Gachibowli Organic Store & Bakes',
        pincode: '500032',
        city: 'Hyderabad',
        district: 'Rangareddy',
        mandal: 'Serilingampally',
        state: 'Telangana',
        address: 'Telecom Nagar, Gachibowli Financial District Rd',
        coordinates: [78.3578, 17.4401]
    },
    {
        email: 'ananya.blr.vendor@testapexbee.com',
        name: 'Ananya Sharma',
        phone: '9848011003',
        password: 'TestVendor@123',
        businessName: 'Koramangala Artisan Market & Farmcraft',
        pincode: '560034',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        mandal: 'Bengaluru South',
        state: 'Karnataka',
        address: '80 Feet Rd, 4th Block, Koramangala',
        coordinates: [77.6271, 12.9352]
    },
    {
        email: 'karthik.blr.vendor@testapexbee.com',
        name: 'Karthik Rao',
        phone: '9848011004',
        password: 'TestVendor@123',
        businessName: 'Indiranagar Gourmet & Crafts',
        pincode: '560038',
        city: 'Bengaluru',
        district: 'Bengaluru Urban',
        mandal: 'Bengaluru East',
        state: 'Karnataka',
        address: '100 Feet Rd, HAL 2nd Stage, Indiranagar',
        coordinates: [77.6411, 12.9784]
    },
    {
        email: 'farhan.mum.vendor@testapexbee.com',
        name: 'Farhan Merchant',
        phone: '9848011005',
        password: 'TestVendor@123',
        businessName: 'Bandra Artisan Goods & Farm Collective',
        pincode: '400050',
        city: 'Mumbai',
        district: 'Mumbai Suburban',
        mandal: 'Bandra',
        state: 'Maharashtra',
        address: 'Hill Road, Near Bandra Station West',
        coordinates: [72.8335, 19.0596]
    },
    {
        email: 'tamsi.store@apexbee.test',
        name: 'Ramesh Patel (Tamsi Bazaar)',
        phone: '9848050431',
        password: 'TestVendor@123',
        businessName: 'Adilabad Tamsi Super Bazaar & Dairy',
        pincode: '504312',
        city: 'Adilabad',
        district: 'Adilabad',
        mandal: 'Tamsi',
        state: 'Telangana',
        address: 'Main Road, Near Bus Stand, Tamsi Mandal',
        coordinates: [78.4124, 19.6641]
    },
    {
        email: 'vendor@gmail.com',
        name: 'ApexBee Prime Vendor Store',
        phone: '9876543210',
        password: 'vendor123',
        businessName: 'ApexBee Prime Vendor Store',
        pincode: '500081',
        city: 'Hyderabad',
        district: 'Hyderabad',
        mandal: 'Madhapur',
        state: 'Telangana',
        address: 'Plot 10, Hi-Tech City, Madhapur',
        coordinates: [78.3847, 17.4483]
    },
    {
        email: 'vendor@apexmarket.in',
        name: 'ApexBee Local Store Manager',
        phone: '8888888888',
        password: 'vendor123',
        businessName: 'ApexBee Local Superstore',
        pincode: '524001',
        city: 'Nellore',
        district: 'Nellore',
        mandal: 'Nellore Urban',
        state: 'Andhra Pradesh',
        address: 'Downtown Market Street, Building 4B',
        coordinates: [79.9865, 14.4426]
    },
    {
        email: 'dev@gmail.com',
        name: 'Apex Devotional Essentials',
        phone: '9848011009',
        password: 'vendor123',
        businessName: 'Apex Devotional Store',
        pincode: '500081',
        city: 'Hyderabad',
        district: 'Hyderabad',
        mandal: 'Madhapur',
        state: 'Telangana',
        address: 'Temple Road, Madhapur',
        coordinates: [78.3847, 17.4483]
    }
];
async function run() {
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Connected to MongoDB.');
    for (const v of VENDORS_TO_ENSURE) {
        const passwordHash = await bcryptjs_1.default.hash(v.password, 10);
        let user = await User_1.User.findOne({ email: v.email }).select('+passwordHash');
        if (!user) {
            user = new User_1.User({
                name: v.name,
                email: v.email,
                phone: v.phone,
                mobile: v.phone,
                passwordHash,
                roles: ['vendor', 'customer'],
                status: 'active',
                isVerified: true,
                sellerProfile: {
                    businessName: v.businessName,
                    businessType: 'Vendor',
                    kycStatus: 'Approved',
                    addressText: v.address
                }
            });
            await user.save();
            console.log(`[Created User] ${v.email}`);
        }
        else {
            user.passwordHash = passwordHash;
            user.status = 'active';
            user.isVerified = true;
            if (!user.roles.includes('vendor')) {
                user.roles.push('vendor');
            }
            if (!user.roles.includes('customer')) {
                user.roles.push('customer');
            }
            user.phone = user.phone || v.phone;
            user.mobile = user.mobile || v.phone;
            await user.save();
            console.log(`[Updated User] ${v.email} -> password reset to: ${v.password}, status: active`);
        }
        // Ensure Vendor record exists
        let vendor = await Vendor_1.Vendor.findOne({ $or: [{ userId: user._id }, { email: v.email }] });
        if (!vendor) {
            vendor = new Vendor_1.Vendor({
                userId: user._id,
                businessName: v.businessName,
                ownerName: v.name,
                email: v.email,
                phone: v.phone,
                mobile: v.phone,
                address: v.address,
                pincode: v.pincode,
                mandal: v.mandal,
                district: v.district,
                state: v.state,
                city: v.city,
                status: 'active',
                marketplaceStatus: 'Approved',
                isMarketplaceListed: true,
                deliveryRadiusKm: 15,
                estimatedDeliveryMinutes: 20,
                location: {
                    type: 'Point',
                    coordinates: v.coordinates
                }
            });
            await vendor.save();
            console.log(`[Created Vendor Document] ${v.businessName}`);
        }
        else {
            vendor.userId = user._id;
            vendor.status = 'active';
            vendor.marketplaceStatus = 'Approved';
            vendor.isMarketplaceListed = true;
            await vendor.save();
            console.log(`[Updated Vendor Document] ${vendor.businessName}`);
        }
    }
    console.log('\n--- ALL VENDORS SYNCED SUCCESSFULLY ---');
    await mongoose_1.default.disconnect();
}
run().catch(console.error);
