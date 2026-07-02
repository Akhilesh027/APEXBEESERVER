import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { User } from "./src/models/User";
import { Order } from "./src/models/Order";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const heal = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a38cc01ee7783b244b0aca0";
    const customerId = "6a37d39f9d26c495b72f3882";
    const adminId = "6a336ffb8bf123a58fff358c";

    // 1. Reset firstOrderQualified to false
    const customer = await User.findById(customerId);
    if (!customer) {
      console.error("Customer not found!");
      process.exit(1);
    }
    console.log(`Current firstOrderQualified: ${customer.firstOrderQualified}`);
    customer.firstOrderQualified = false;
    await customer.save();
    console.log(`Reset customer firstOrderQualified to: ${customer.firstOrderQualified}`);

    // 2. Fetch order
    const order = await Order.findById(orderId);
    if (!order) {
      console.error("Order not found!");
      process.exit(1);
    }

    // 3. Create missing settlements
    console.log("Generating missing settlements/transactions...");
    await SettlementEngine.createSettlements(order);

    // 4. Pend the newly created settlements
    console.log("Pending new settlements/transactions...");
    await SettlementEngine.pendSettlements(order._id);

    // 5. Release the newly created settlements
    console.log("Releasing new settlements/transactions...");
    const stats = await SettlementEngine.releaseEligibleSettlements(undefined, order._id, adminId);
    console.log("Release stats:", stats);

    // 6. Verify final transactions
    console.log("\n=== Final Referral Transactions for Order ===");
    const txs = await ReferralTransaction.find({ orderId });
    txs.forEach(t => {
      console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Level: ${t.level}, Status: ${t.status}`);
    });

    // 7. Verify wallet balances
    console.log("\n=== Recipient Wallets ===");
    const recipients = Array.from(new Set(txs.map(t => t.recipientUserId.toString())));
    for (const rid of recipients) {
      const u = await User.findById(rid);
      const w = await Wallet.findOne({ userId: rid });
      console.log(`User: ${u?.name} (${rid})`);
      console.log(`  - Wallet Balance: ${w?.availableBalance}, Pending: ${w?.pendingBalance}`);
      console.log(`  - User Doc Balance: ${u?.wallet?.balance}, Hold: ${u?.wallet?.holdBalance}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Heal execution failed:", err);
    process.exit(1);
  }
};

heal();
