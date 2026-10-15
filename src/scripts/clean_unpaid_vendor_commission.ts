import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { CommissionSettlement } from "../models/CommissionSettlement";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");
    console.log("Connected to MongoDB");

    const query = {
      $or: [
        { "remarks": { $regex: /ASFDASDF/i } },
        { "notes": { $regex: /ASFDASDF/i } },
        { "referenceId": new mongoose.Types.ObjectId("6ad08de7bbcfcd01d71ebc0b") }
      ]
    };

    const txs = await WalletTransaction.find(query);
    console.log(`Found ${txs.length} WalletTransactions matching ASFDASDF`);

    for (const tx of txs) {
      console.log(`TX ID: ${tx._id}, User: ${tx.userId}, Amount: ${tx.amount}, Remarks: ${tx.remarks}`);
      
      // Deduct/reverse from Wallet balance
      if (tx.amount > 0) {
        const wallet = await Wallet.findOne({ userId: tx.userId });
        if (wallet) {
          console.log(`Before reversal: Balance: ${wallet.balance}, Ledger entries: ${wallet.ledger?.length}`);
          wallet.balance = Math.max(0, wallet.balance - tx.amount);
          
          // Filter out ledger entry if present
          if (wallet.ledger && Array.isArray(wallet.ledger)) {
            wallet.ledger = wallet.ledger.filter((entry: any) => 
              String(entry.referenceId) !== "6ad08de7bbcfcd01d71ebc0b" &&
              !entry.remarks?.includes("ASFDASDF")
            );
          }
          await wallet.save();
          console.log(`After reversal: Balance: ${wallet.balance}`);
        }
      }

      await WalletTransaction.findByIdAndDelete(tx._id);
      console.log(`Deleted WalletTransaction ${tx._id}`);
    }

    const settlements = await CommissionSettlement.find(query);
    console.log(`Found ${settlements.length} CommissionSettlements matching ASFDASDF`);
    for (const cs of settlements) {
      await CommissionSettlement.findByIdAndDelete(cs._id);
      console.log(`Deleted CommissionSettlement ${cs._id}`);
    }

    console.log("Cleanup of ASFDASDF unpaid commission completed successfully.");
  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
