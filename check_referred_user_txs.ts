import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    const referredUserId = "6a37d39f9d26c495b72f3882";
    const txs = await ReferralTransaction.find({ referredUserId });
    console.log(`Found ${txs.length} transactions for referredUserId: ${referredUserId}`);
    txs.forEach(t => {
      console.log(`  - Type: ${t.transactionType}, OrderID: ${t.orderId}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Status: ${t.status}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
