import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { Vendor } from "./src/models/Vendor";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import Product from "./src/models/Product";
import { Order } from "./src/models/Order";

dotenv.config();

const trace = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI not found");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // 1. All Users with role vendor
    const vendorUsers = await User.find({ roles: "vendor" });
    console.log(`\n--- VENDOR USERS (${vendorUsers.length}) ---`);
    for (const user of vendorUsers) {
      console.log(`User ID: ${user._id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
    }

    // 2. All Vendor Profiles
    const vendorProfiles = await Vendor.find({});
    console.log(`\n--- VENDOR PROFILES (${vendorProfiles.length}) ---`);
    for (const profile of vendorProfiles) {
      console.log(`Profile ID: ${profile._id}`);
      console.log(`  Business Name: ${profile.businessName}`);
      console.log(`  Owner Name: ${profile.ownerName}`);
      console.log(`  userId: ${profile.userId}`);
      console.log(`  entrepreneurId: ${profile.entrepreneurId}`);
      console.log(`  mandalFranchiseId: ${profile.mandalFranchiseId}`);
      console.log(`  districtFranchiseId: ${profile.districtFranchiseId}`);
      console.log(`  stateFranchiseId: ${profile.stateFranchiseId}`);
    }

    // 3. All Business Relationships
    const relationships = await BusinessRelationship.find({});
    console.log(`\n--- BUSINESS RELATIONSHIPS (${relationships.length}) ---`);
    for (const r of relationships) {
      console.log(`Relationship ID: ${r._id}`);
      console.log(`  businessType: ${r.businessType}`);
      console.log(`  businessId (Profile ID): ${r.businessId}`);
      console.log(`  userId (User ID): ${r.userId}`);
      console.log(`  status: ${r.status}`);
      console.log(`  entrepreneurId: ${r.entrepreneurId}`);
      console.log(`  mandalFranchiseId: ${r.mandalFranchiseId}`);
      console.log(`  districtFranchiseId: ${r.districtFranchiseId}`);
      console.log(`  stateFranchiseId: ${r.stateFranchiseId}`);
    }

    // 4. All Products
    const products = await Product.find({});
    console.log(`\n--- PRODUCTS (${products.length}) ---`);
    for (const p of products) {
      console.log(`Product ID: ${p._id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  sellerId: ${p.sellerId}`);
      console.log(`  sellerType: ${p.sellerType}`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

trace();
