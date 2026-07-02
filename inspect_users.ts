import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const inspectUsers = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI is not defined in backend/.env");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected successfully to DB!");

    const users = await User.find({});
    console.log(`Total users found: ${users.length}`);

    users.forEach(user => {
      console.log(`ID: ${user._id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Phone: ${user.phone}`);
      console.log(`  Roles: ${user.roles}`);
      console.log(`  Referral Code: ${user.referralCode}`);
      console.log(`  Referred By: ${user.referredBy}`);
      console.log(`  Hierarchy:`, JSON.stringify(user.referralHierarchy, null, 2));
      console.log("-----------------------------------------");
    });

    process.exit(0);
  } catch (err) {
    console.error("Error inspecting users:", err);
    process.exit(1);
  }
};

inspectUsers();
