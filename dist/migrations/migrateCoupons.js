"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const Coupon_1 = require("../models/Coupon");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoURI = process.env.MONGODB_URI;
if (!mongoURI) {
    console.error("MONGODB_URI not found in environment.");
    process.exit(1);
}
async function migrate() {
    try {
        console.log("Connecting to database for coupon migration...");
        await mongoose_1.default.connect(mongoURI);
        console.log("Connected.");
        // Update coupons where scope is not set
        const unmigrated = await Coupon_1.Coupon.find({ scope: { $exists: false } });
        console.log(`Found ${unmigrated.length} unmigrated coupons.`);
        let platformCount = 0;
        let vendorCount = 0;
        for (const coupon of unmigrated) {
            // Default rule: If coupon doesn't have a known creator, default to platform scope (global)
            // Since legacy coupons have no creator field, we set them to 'platform' and vendorId to null.
            coupon.scope = 'platform';
            coupon.vendorId = undefined;
            await coupon.save();
            platformCount++;
        }
        console.log(`Migration completed: ${platformCount} coupons set to platform-scope, ${vendorCount} set to vendor-scope.`);
    }
    catch (error) {
        console.error("Migration failed:", error);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log("Disconnected.");
    }
}
migrate();
