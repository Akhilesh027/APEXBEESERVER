const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function checkPlatformFees() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI not found");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  console.log("=================== PLATFORM FEE CONFIGURATION CHECK ===================\n");

  // 1. Commission Rules
  const commissionRules = await db.collection("commissionrules").find({}).toArray();
  console.log(`1. COMMISSION RULES (${commissionRules.length} records):`);
  if (commissionRules.length === 0) {
    console.log("   (No custom CommissionRule records found; system uses code defaults)");
  } else {
    for (const rule of commissionRules) {
      console.log(`   - Name/Type: ${rule.name || rule.businessType || "Default"}`);
      console.log(`     Platform Percentage: ${rule.platformPercentage}%`);
      console.log(`     Franchise Percentage: ${rule.franchisePercentage}%`);
      console.log(`     Vendor Percentage: ${rule.vendorPercentage}%`);
      console.log(`     Active: ${rule.isActive ?? rule.active}`);
    }
  }

  // 2. System Configs
  const configs = await db.collection("systemconfigs").find({
    key: { $regex: /fee|commission|platform/i }
  }).toArray();
  console.log(`\n2. SYSTEM CONFIG KEYS (${configs.length} matching keys):`);
  if (configs.length === 0) {
    console.log("   (No fee/platform keys stored in SystemConfig collection)");
  } else {
    for (const c of configs) {
      console.log(`   - ${c.key}: ${JSON.stringify(c.value)}`);
    }
  }

  // 3. Products Sample Platform Fees
  const products = await db.collection("products").find({
    isArchived: { $ne: true }
  }).project({
    name: 1,
    baseSellingPrice: 1,
    adminPricing: 1,
    itemType: 1
  }).limit(15).toArray();

  console.log(`\n3. SAMPLE PRODUCTS ADMIN PRICING (showing up to 15 active products):`);
  for (const p of products) {
    const ap = p.adminPricing || {};
    console.log(`   - Product: "${p.name}" (Price: ₹${p.baseSellingPrice || 0})`);
    console.log(`     Platform Fee %:      ${ap.platformFeePercent !== undefined ? ap.platformFeePercent + "%" : "Default 10%"}`);
    console.log(`     Platform Fee Amount: ₹${ap.platformFeeAmount !== undefined ? ap.platformFeeAmount : "Auto-calculated"}`);
    console.log(`     Vendor Commission %: ${ap.vendorCommissionPercent !== undefined ? ap.vendorCommissionPercent + "%" : "N/A"}`);
    console.log(`     Distributed From:    ${ap.distributedFrom || "platform_fee"}`);
  }

  // Overall statistics on products
  const totalProducts = await db.collection("products").countDocuments();
  const productsWithCustomFee = await db.collection("products").countDocuments({
    "adminPricing.platformFeePercent": { $exists: true, $ne: null }
  });

  console.log("\n=================== OVERALL METRICS ===================");
  console.log(`Total Products in DB:                ${totalProducts}`);
  console.log(`Products with Explicit Admin Fee %:  ${productsWithCustomFee}`);
  console.log("========================================================\n");

  await mongoose.disconnect();
}

checkPlatformFees().catch(err => {
  console.error("Error checking platform fees:", err);
  process.exit(1);
});
