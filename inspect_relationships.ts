import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import { User } from "./src/models/User";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const relationships = await BusinessRelationship.find({});
    console.log(`Found ${relationships.length} relationships:`);
    for (const r of relationships) {
      console.log(`Relationship ID: ${r._id}`);
      console.log(`  businessId: ${r.businessId}`);
      console.log(`  businessType: ${r.businessType}`);
      console.log(`  userId: ${r.userId}`);
      console.log(`  status: ${r.status}`);
      console.log(`  stateFranchiseId: ${r.stateFranchiseId}`);
      console.log(`  districtFranchiseId: ${r.districtFranchiseId}`);
      console.log(`  mandalFranchiseId: ${r.mandalFranchiseId}`);
      console.log(`  entrepreneurId: ${r.entrepreneurId}`);
      console.log("------------------");
    }

    const sellerUser = await User.findById("6a341d6aee47aa17694a4fd6");
    console.log("Seller User Info:");
    console.log(JSON.stringify(sellerUser, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
