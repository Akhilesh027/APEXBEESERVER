import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    const orderId = "6a37c8c0fd9043df7b3e93bd";

    console.log("\n=== ALL REFERRAL TRANSACTIONS FOR THIS ORDER ===");
    const txs = await ReferralTransaction.find({ orderId });
    console.log(JSON.stringify(txs, null, 2));

    console.log("\n=== ALL COMMISSION SETTLEMENTS FOR THIS ORDER ===");
    const settlements = await CommissionSettlement.find({ orderId });
    console.log(JSON.stringify(settlements, null, 2));

    console.log("\n=== ALL WALLETS ===");
    const wallets = await Wallet.find({});
    for (const w of wallets) {
      const matchEntries = w.ledgerEntries.filter(
        (e: any) => e.referenceId === orderId || (e.remarks && e.remarks.includes(orderId))
      );
      if (matchEntries.length > 0 || w.availableBalance > 0 || w.pendingBalance > 0) {
        console.log(`User: ${w.userId} Wallet ID: ${w._id}`);
        console.log(`  availableBalance: ${w.availableBalance}, pendingBalance: ${w.pendingBalance}`);
        console.log(`  Matching Ledger Entries:`, JSON.stringify(matchEntries, null, 2));
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
