import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { User } from "./src/models/User";
import { Wallet } from "./src/models/Wallet";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";

dotenv.config();

const runFlow = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a34f57b523e761f173125fd";
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found");
      process.exit(1);
    }

    console.log("Step 1: Check existing settlements and wallets...");
    const initialSettlements = await CommissionSettlement.find({ orderId });
    const initialTxs = await ReferralTransaction.find({ orderId });

    console.log(`Found ${initialSettlements.length} CommissionSettlements and ${initialTxs.length} ReferralTransactions.`);
    
    // Print recipient initial balances
    for (const tx of initialTxs) {
      const wallet = await Wallet.findOne({ userId: tx.recipientUserId });
      console.log(`Recipient ${tx.recipientUserId} Initial Wallet: Available=${wallet?.availableBalance}, Pending=${wallet?.pendingBalance}`);
    }

    console.log("\nStep 2: Transitioning order settlements to pending (simulating delivery)...");
    const session1 = await mongoose.startSession();
    await session1.withTransaction(async () => {
      await SettlementEngine.pendSettlements(order._id, session1);
    });
    await session1.endSession();
    console.log("Pended settlements.");

    // Print recipient pended balances
    for (const tx of initialTxs) {
      const wallet = await Wallet.findOne({ userId: tx.recipientUserId });
      const txUpdated = await ReferralTransaction.findById(tx._id);
      console.log(`Recipient ${tx.recipientUserId} Pended Wallet: Available=${wallet?.availableBalance}, Pending=${wallet?.pendingBalance}, Tx Status: ${txUpdated?.status}`);
    }

    console.log("\nStep 3: Simulating time passing and releasing settlements...");
    // Let's modify releaseDate of these settlements to past so they are eligible for release
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    
    await CommissionSettlement.updateMany({ orderId }, { releaseDate: pastDate });
    await ReferralTransaction.updateMany({ orderId }, { releaseDate: pastDate });
    console.log("Modified releaseDate of settlements to past.");

    console.log("Running releaseEligibleSettlements...");
    const stats = await SettlementEngine.releaseEligibleSettlements();
    console.log("Released stats:", JSON.stringify(stats, null, 2));

    // Print recipient released balances
    for (const tx of initialTxs) {
      const wallet = await Wallet.findOne({ userId: tx.recipientUserId });
      const txUpdated = await ReferralTransaction.findById(tx._id);
      console.log(`Recipient ${tx.recipientUserId} Released Wallet: Available=${wallet?.availableBalance}, Pending=${wallet?.pendingBalance}, Tx Status: ${txUpdated?.status}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error running flow:", err);
    process.exit(1);
  }
};

runFlow();
