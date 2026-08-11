"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const Entrepreneur_1 = require("../models/Entrepreneur");
const Franchise_1 = require("../models/Franchise");
const ServiceProvider_1 = require("../models/ServiceProvider");
const identityService_1 = require("../services/identityService");
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
async function backfillApexbeeIdentity() {
    try {
        const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/apexbee";
        console.log("Connecting to MongoDB:", mongoUri);
        await mongoose_1.default.connect(mongoUri);
        console.log("Starting ApexBee Identity Backfill...");
        const users = await User_1.User.find({});
        console.log(`Total users found: ${users.length}`);
        let updatedUsersCount = 0;
        for (const user of users) {
            let modified = false;
            // 1. Check Master Customer ID (9 digits)
            if (!user.masterCustomerId) {
                user.masterCustomerId = await (0, identityService_1.generateMasterCustomerId)();
                modified = true;
            }
            // 2. Check Universal Referral Code
            if (!user.referralCode) {
                user.referralCode = await (0, identityService_1.generateUniversalReferralCode)(user.name);
                modified = true;
            }
            // 3. Check Role Reference IDs
            let roleMap = {};
            if (user.roleReferenceIds instanceof Map) {
                user.roleReferenceIds.forEach((val, key) => {
                    roleMap[key] = val;
                });
            }
            else if (user.roleReferenceIds && typeof user.roleReferenceIds === "object") {
                roleMap = { ...user.roleReferenceIds };
            }
            const roles = user.roles || ["customer"];
            for (const role of roles) {
                if (!roleMap[role]) {
                    roleMap[role] = (0, identityService_1.generateRoleReferenceId)(role);
                    modified = true;
                }
            }
            user.roleReferenceIds = roleMap;
            if (modified) {
                await user.save();
                updatedUsersCount++;
            }
        }
        console.log(`Updated ${updatedUsersCount} users with Master IDs & Role Reference IDs.`);
        // 4. Backfill Role-Specific Entity Reference IDs
        console.log("Backfilling Role-Specific Entities (Vendor, DeliveryPartner, Entrepreneur, Franchise, ServiceProvider)...");
        const vendors = await Vendor_1.Vendor.find({});
        for (const v of vendors) {
            if (!v.referenceId) {
                const storeType = (v.storeConfig?.storeType || v.storeType || "grocery").toLowerCase();
                v.referenceId = (0, identityService_1.generateRoleReferenceId)("vendor", storeType);
                await v.save();
            }
        }
        const deliveryPartners = await DeliveryPartner_1.DeliveryPartner.find({});
        for (const dp of deliveryPartners) {
            if (!dp.referenceId) {
                dp.referenceId = (0, identityService_1.generateRoleReferenceId)("delivery_partner");
                await dp.save();
            }
        }
        const entrepreneurs = await Entrepreneur_1.Entrepreneur.find({});
        for (const ent of entrepreneurs) {
            if (!ent.referenceId) {
                ent.referenceId = (0, identityService_1.generateRoleReferenceId)("entrepreneur");
                await ent.save();
            }
        }
        const franchises = await Franchise_1.Franchise.find({});
        for (const fr of franchises) {
            if (!fr.referenceId) {
                fr.referenceId = (0, identityService_1.generateRoleReferenceId)("franchise");
                await fr.save();
            }
        }
        const serviceProviders = await ServiceProvider_1.ServiceProvider.find({});
        for (const sp of serviceProviders) {
            if (!sp.referenceId) {
                sp.referenceId = (0, identityService_1.generateRoleReferenceId)("service_provider");
                await sp.save();
            }
        }
        console.log("ApexBee Identity Backfill Complete!");
    }
    catch (error) {
        console.error("Backfill failed:", error);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
backfillApexbeeIdentity();
