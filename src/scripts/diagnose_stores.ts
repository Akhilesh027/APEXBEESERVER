import dotenv from "dotenv";
import { connectDB } from "../config/db";
import { Vendor } from "../models/Vendor";
import { VendorMarketplaceService } from "../services/VendorMarketplaceService";

dotenv.config();

const diagnose = async () => {
  try {
    await connectDB();
    console.log("\n=== VENDOR DB DIAGNOSIS ===\n");

    // 1. Find all vendors
    const allVendors = await Vendor.find({}).lean().limit(10);
    console.log(`Total vendors in DB: ${allVendors.length}`);
    
    for (const v of allVendors) {
      console.log(`\n--- ${v.businessName} ---`);
      console.log(`  status: ${v.status}`);
      console.log(`  pincode: "${v.pincode}"`);
      console.log(`  isMarketplaceListed: ${(v as any).isMarketplaceListed}`);
      console.log(`  location: ${JSON.stringify((v as any).location?.coordinates)}`);
      console.log(`  deliveryRadiusKm: ${(v as any).deliveryRadiusKm}`);
    }

    // 2. Try pincode search directly
    console.log("\n=== PINCODE SEARCH TEST ===");
    const pincodeResult = await VendorMarketplaceService.findNearbyShops(
      undefined, undefined,
      { pincode: "504312" }
    );
    console.log(`Pincode 504312 search result: ${pincodeResult.length} stores`);

    // 3. Try GPS search (vendor's own coordinates)
    const vendorWithLocation = allVendors.find(v => (v as any).location?.coordinates?.length === 2);
    if (vendorWithLocation) {
      const [lng, lat] = (vendorWithLocation as any).location.coordinates;
      console.log("\n=== GPS SEARCH TEST ===");
      const gpsResult = await VendorMarketplaceService.findNearbyShops(
        Number(lat), Number(lng),
        { radiusKm: 20 }
      );
      console.log(`GPS search result: ${gpsResult.length} stores`);
    }

    // 4. Check the isMarketplaceListed filter
    console.log("\n=== isMarketplaceListed FILTER CHECK ===");
    const withFlag = await Vendor.find({ status: "active", isMarketplaceListed: true }).countDocuments();
    const withoutFlag = await Vendor.find({ status: "active", isMarketplaceListed: { $exists: false } }).countDocuments();
    const withFalse = await Vendor.find({ status: "active", isMarketplaceListed: false }).countDocuments();
    console.log(`Vendors with isMarketplaceListed=true: ${withFlag}`);
    console.log(`Vendors with isMarketplaceListed missing: ${withoutFlag}`);
    console.log(`Vendors with isMarketplaceListed=false: ${withFalse}`);

    console.log("\n=== DONE ===");
    process.exit(0);
  } catch (err) {
    console.error("Diagnosis failed:", err);
    process.exit(1);
  }
};

diagnose();
