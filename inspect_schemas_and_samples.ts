import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";
import { BusinessRelationship } from "./src/models/BusinessRelationship";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    console.log("\n=== CommissionSettlement Sample Document ===");
    const sampleCS = await CommissionSettlement.findOne({});
    console.log(JSON.stringify(sampleCS, null, 2));

    console.log("\n=== ReferralTransaction Sample Document ===");
    const sampleRT = await ReferralTransaction.findOne({});
    console.log(JSON.stringify(sampleRT, null, 2));

    console.log("\n=== Wallet Sample Document ===");
    const sampleW = await Wallet.findOne({});
    console.log(JSON.stringify(sampleW, null, 2));

    console.log("\n=== BusinessRelationship Sample Document ===");
    const sampleBR = await BusinessRelationship.findOne({});
    console.log(JSON.stringify(sampleBR, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
