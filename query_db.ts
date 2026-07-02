import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const query = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const settleCount = await CommissionSettlement.countDocuments({});
    const txCount = await ReferralTransaction.countDocuments({});

    console.log(`Total CommissionSettlements: ${settleCount}`);
    console.log(`Total ReferralTransactions: ${txCount}`);

    if (settleCount > 0) {
      console.log("Sample CommissionSettlement:");
      const s = await CommissionSettlement.findOne({});
      console.log(JSON.stringify(s, null, 2));
    }

    if (txCount > 0) {
      console.log("Sample ReferralTransaction:");
      const t = await ReferralTransaction.findOne({});
      console.log(JSON.stringify(t, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

query();
