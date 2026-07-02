import mongoose from "mongoose";
import dotenv from "dotenv";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { WalletEngine } from "./src/services/WalletEngine";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    // Let's find a pending referral transaction to test releasing on
    const tx = await ReferralTransaction.findOne({ status: "pending" });
    if (!tx) {
      console.log("No pending referral transactions found to test release.");
      process.exit(0);
    }

    console.log("\n=== BEFORE RELEASE ===");
    console.log("Tx status:", tx.status, "amount:", tx.amount, "recipient:", tx.recipientUserId);
    let wallet = await Wallet.findOne({ userId: tx.recipientUserId });
    if (wallet) {
      console.log("Wallet availableBalance:", wallet.availableBalance, "pendingBalance:", wallet.pendingBalance);
      console.log("Wallet ledgerEntries count:", wallet.ledgerEntries.length);
    } else {
      console.log("Wallet does NOT exist for recipient.");
    }

    // Call WalletEngine.release directly
    console.log("\nReleasing via WalletEngine.release...");
    const txId = "TXN_TEST_RELEASE_" + Date.now();
    await WalletEngine.release(tx.recipientUserId, tx.amount, {
      category: "Referral Bonus",
      source: tx.transactionType,
      remarks: `Released referral bonus level ${tx.level} for order ${tx.orderId}`,
      referenceId: tx.orderId,
      referenceType: "ORDER",
      releasedTransactionId: txId
    });

    console.log("\n=== AFTER RELEASE ===");
    wallet = await Wallet.findOne({ userId: tx.recipientUserId });
    if (wallet) {
      console.log("Wallet availableBalance:", wallet.availableBalance, "pendingBalance:", wallet.pendingBalance);
      console.log("Wallet ledgerEntries count:", wallet.ledgerEntries.length);
      console.log("Ledger entries:", JSON.stringify(wallet.ledgerEntries, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
