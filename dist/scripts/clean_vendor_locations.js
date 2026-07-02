"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Vendor_1 = require("../models/Vendor");
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
async function cleanVendorLocations() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        const result = await Vendor_1.Vendor.updateMany({
            $or: [
                { 'location.coordinates': { $exists: false } },
                { 'location.coordinates': { $size: 0 } },
                { 'location.coordinates': null }
            ]
        }, { $unset: { location: "" } });
        console.log(`Cleaned ${result.modifiedCount} vendor documents by removing invalid location properties.`);
    }
    catch (error) {
        console.error('Error cleaning vendor locations:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
}
cleanVendorLocations();
