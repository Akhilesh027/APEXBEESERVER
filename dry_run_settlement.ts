import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a34f665e75c25e1ec6d1924";
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found");
      process.exit(1);
    }

    console.log("Existing CommissionSettlements:", await CommissionSettlement.countDocuments({ orderId }));
    console.log("Existing ReferralTransactions:", await ReferralTransaction.countDocuments({ orderId }));

    console.log("Running createSettlements...");
    
    // We start a transaction and abort it so we do not actually write to the DB, but can inspect results
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await SettlementEngine.createSettlements(order, session);
      
      const settlements = await CommissionSettlement.find({ orderId }).session(session);
      const transactions = await ReferralTransaction.find({ orderId }).session(session);
      
      console.log(`\n=== DRY RUN RESULTS ===`);
      console.log(`Created CommissionSettlements count in transaction: ${settlements.length}`);
      settlements.forEach(s => {
        console.log(`  - Type: ${s.settlementType}, Recipient: ${s.recipientId}, Amount: ${s.amount}, Status: ${s.status}`);
      });

      console.log(`Created ReferralTransactions count in transaction: ${transactions.length}`);
      transactions.forEach(t => {
        console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Level: ${t.level}, Status: ${t.status}`);
      });
      
      console.log("Aborting transaction to keep DB clean...");
      throw new Error("ABORT_TRANSACTION_FOR_DRY_RUN");
    }).catch(err => {
      if (err.message !== "ABORT_TRANSACTION_FOR_DRY_RUN") {
        throw err;
      }
    });

    await session.endSession();
    process.exit(0);
  } catch (err) {
    console.error("Dry run failed:", err);
    process.exit(1);
  }
};

run();
