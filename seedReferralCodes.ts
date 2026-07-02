import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { User } from "./src/models/User";

dotenv.config();

async function generateReferralCode(name: string): Promise<string> {
  const cleanName = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (cleanName.substring(0, 3) + "XXX").substring(0, 3);
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    code = `APX-${prefix}${randomChars}`;
    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to database!");

    const users = await User.find({ referralCode: { $exists: false } });
    console.log(`Found ${users.length} users without a referral code.`);

    for (const user of users) {
      const code = await generateReferralCode(user.name);
      user.referralCode = code;
      await user.save();
      console.log(`Assigned code ${code} to user ${user.name}`);
    }

    const emptyUsers = await User.find({ referralCode: "" });
    console.log(`Found ${emptyUsers.length} users with empty referral code.`);
    for (const user of emptyUsers) {
      const code = await generateReferralCode(user.name);
      user.referralCode = code;
      await user.save();
      console.log(`Assigned code ${code} to user ${user.name}`);
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
};

run();
