"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("../config/db");
const Vendor_1 = require("../models/Vendor");
const VendorMarketplaceService_1 = require("../services/VendorMarketplaceService");
dotenv_1.default.config();
const diagnose = async () => {
    try {
        await (0, db_1.connectDB)();
        console.log("\n=== VENDOR DB DIAGNOSIS ===\n");
        // 1. Find all vendors
        const allVendors = await Vendor_1.Vendor.find({}).lean().limit(10);
        console.log(`Total vendors in DB: ${allVendors.length}`);
        for (const v of allVendors) {
            console.log(`\n--- ${v.businessName} ---`);
            console.log(`  status: ${v.status}`);
            console.log(`  pincode: "${v.pincode}"`);
            console.log(`  isMarketplaceListed: ${v.isMarketplaceListed}`);
            console.log(`  location: ${JSON.stringify(v.location?.coordinates)}`);
            console.log(`  deliveryRadiusKm: ${v.deliveryRadiusKm}`);
        }
        // 2. Try pincode search directly
        console.log("\n=== PINCODE SEARCH TEST ===");
        const pincodeResult = await VendorMarketplaceService_1.VendorMarketplaceService.findNearbyShops(undefined, undefined, { pincode: "504312" });
        console.log(`Pincode 504312 search result: ${pincodeResult.length} stores`);
        // 3. Try GPS search (vendor's own coordinates)
        const vendorWithLocation = allVendors.find(v => v.location?.coordinates?.length === 2);
        if (vendorWithLocation) {
            const [lng, lat] = vendorWithLocation.location.coordinates;
            console.log("\n=== GPS SEARCH TEST ===");
            const gpsResult = await VendorMarketplaceService_1.VendorMarketplaceService.findNearbyShops(Number(lat), Number(lng), { radiusKm: 20 });
            console.log(`GPS search result: ${gpsResult.length} stores`);
        }
        // 4. Check the isMarketplaceListed filter
        console.log("\n=== isMarketplaceListed FILTER CHECK ===");
        const withFlag = await Vendor_1.Vendor.find({ status: "active", isMarketplaceListed: true }).countDocuments();
        const withoutFlag = await Vendor_1.Vendor.find({ status: "active", isMarketplaceListed: { $exists: false } }).countDocuments();
        const withFalse = await Vendor_1.Vendor.find({ status: "active", isMarketplaceListed: false }).countDocuments();
        console.log(`Vendors with isMarketplaceListed=true: ${withFlag}`);
        console.log(`Vendors with isMarketplaceListed missing: ${withoutFlag}`);
        console.log(`Vendors with isMarketplaceListed=false: ${withFalse}`);
        console.log("\n=== DONE ===");
        process.exit(0);
    }
    catch (err) {
        console.error("Diagnosis failed:", err);
        process.exit(1);
    }
};
diagnose();
