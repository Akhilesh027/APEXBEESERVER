import mongoose from "mongoose";
import dotenv from "dotenv";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    const txs = await ReferralTransaction.find({ status: "released" });
    console.log(`Found ${txs.length} released referral transactions:`);

    for (const tx of txs) {
      const wallet = await Wallet.findOne({ userId: tx.recipientUserId });
      if (!wallet) {
        console.log(`WARNING: Wallet does NOT exist for recipientUserId: ${tx.recipientUserId} (Tx ID: ${tx._id}, orderId: ${tx.orderId})`);
      } else {
        const hasEntry = wallet.ledgerEntries.some(
          (e: any) => e.referenceId && e.referenceId.toString() === tx.orderId.toString()
        );
        console.log(`Recipient: ${tx.recipientUserId}, Wallet ID: ${wallet._id}`);
        console.log(`  availableBalance: ${wallet.availableBalance}, pendingBalance: ${wallet.pendingBalance}`);
        console.log(`  Has matching ledger entry: ${hasEntry}`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
