import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const userIds = [
      "6a34ebbc35363fae65b72216", // Maniteja Goud
      "6a34e63ebcb9da81e73b4c24", // ApexBee System
      "6a34ec1ee06436166e832111", // check
      "6a341d6aee47aa17694a4fd6"  // vendor
    ];

    for (const userId of userIds) {
      console.log(`\n=== Wallet Ledger for User: ${userId} ===`);
      const wallet = await Wallet.findOne({ userId });
      if (!wallet) {
        console.log("Wallet not found!");
        continue;
      }
      console.log(`Available Balance: ₹${wallet.availableBalance}`);
      console.log(`Pending Balance:   ₹${wallet.pendingBalance}`);
      console.log(`Total Credits:     ₹${wallet.totalCredits}`);
      console.log(`Total Debits:      ₹${wallet.totalDebits}`);
      console.log(`Ledger Entries count: ${wallet.ledgerEntries?.length}`);
      
      wallet.ledgerEntries.forEach((entry: any, idx: number) => {
        console.log(`  Entry ${idx + 1}:`);
        console.log(`    transactionId: ${entry.transactionId}`);
        console.log(`    type:          ${entry.type}`);
        console.log(`    amount:        ₹${entry.amount}`);
        console.log(`    status:        ${entry.status}`);
        console.log(`    category:      ${entry.category}`);
        console.log(`    source:        ${entry.source}`);
        console.log(`    remarks:       ${entry.remarks}`);
        console.log(`    referenceId:   ${entry.referenceId}`);
        console.log(`    referenceType: ${entry.referenceType}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
