import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { Wallet } from "./src/models/Wallet";
import { User } from "./src/models/User";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import Product from "./src/models/Product";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a35025375abab28b1dd80da";
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found");
      process.exit(1);
    }

    console.log("Existing CommissionSettlements:", await CommissionSettlement.countDocuments({ orderId }));
    console.log("Existing ReferralTransactions:", await ReferralTransaction.countDocuments({ orderId }));

    console.log("\nStarting dry run of createSettlements & pendSettlements...");
    
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // 1. Check first order status of buyer
      const customer = await User.findById(order.customerId).session(session);
      console.log(`Buyer: ${customer?.name}, firstOrderQualified prior to run: ${customer?.firstOrderQualified}`);
      
      // Let's temporarily set firstOrderQualified to false if we want to see first purchase commission creation!
      // The user description states B places first order, A receives first purchase commission.
      // Since firstOrderQualified is already true on B ("check"), B's first purchase commission was not created.
      // Let's reset B's firstOrderQualified to false in this transaction to simulate B placing first order.
      if (customer) {
        customer.firstOrderQualified = false;
        await customer.save({ session });
      }

      // Check product details
      const item = order.items[0];
      const product = await Product.findById(item.productId).session(session);
      console.log(`Product sellerId: ${product?.sellerId}`);
      if (product) {
        const rel = await BusinessRelationship.findOne({
          businessId: product.sellerId,
          businessType: "vendor",
          status: "active"
        }).session(session);
        console.log(`BusinessRelationship found:`, rel ? rel._id : "null");
      }

      await SettlementEngine.createSettlements(order, session);
      
      const settlements = await CommissionSettlement.find({ orderId }).session(session);
      const transactions = await ReferralTransaction.find({ orderId }).session(session);
      
      console.log(`\n=== DRY RUN: createSettlements ===`);
      console.log(`Created CommissionSettlements count: ${settlements.length}`);
      settlements.forEach(s => {
        console.log(`  - Type: ${s.settlementType}, Recipient: ${s.recipientId}, Amount: ${s.amount}, Status: ${s.status}, ReleaseDate: ${s.releaseDate.toISOString()}`);
      });

      console.log(`Created ReferralTransactions count: ${transactions.length}`);
      transactions.forEach(t => {
        console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Level: ${t.level}, Status: ${t.status}, ReleaseDate: ${t.releaseDate.toISOString()}`);
      });

      console.log(`\n=== DRY RUN: pendSettlements ===`);
      await SettlementEngine.pendSettlements(order._id, session);
      
      const pSettlements = await CommissionSettlement.find({ orderId }).session(session);
      const pTransactions = await ReferralTransaction.find({ orderId }).session(session);
      
      console.log(`CommissionSettlements after pend:`);
      pSettlements.forEach(s => {
        console.log(`  - Type: ${s.settlementType}, Recipient: ${s.recipientId}, Amount: ${s.amount}, Status: ${s.status}`);
      });
      console.log(`ReferralTransactions after pend:`);
      pTransactions.forEach(t => {
        console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Status: ${t.status}`);
      });

      // Let's inspect wallets in transaction
      console.log("\nWallets after pend (holding balance in pendingBalance):");
      for (const t of pTransactions) {
        const w = await Wallet.findOne({ userId: t.recipientUserId }).session(session);
        console.log(`  - User ${t.recipientUserId} (${w?.userId}): pendingBalance=${w?.pendingBalance}, availableBalance=${w?.availableBalance}`);
      }
      for (const s of pSettlements) {
        const w = await Wallet.findOne({ userId: s.recipientId }).session(session);
        console.log(`  - Recipient ${s.recipientId} (${w?.userId}): pendingBalance=${w?.pendingBalance}, availableBalance=${w?.availableBalance}`);
      }

      console.log(`\n=== DRY RUN: releaseEligibleSettlements ===`);
      // Since releaseEligibleSettlements filters by releaseDate <= now, and releaseDate is in future,
      // it won't release anything by default unless we set releaseDate to now or in the past in the DB.
      // Let's modify the created settlements releaseDate in the transaction to be in the past.
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 10);
      
      await CommissionSettlement.updateMany({ orderId }, { $set: { releaseDate: pastDate } }).session(session);
      await ReferralTransaction.updateMany({ orderId }, { $set: { releaseDate: pastDate } }).session(session);

      const stats = await SettlementEngine.releaseEligibleSettlements(session);
      console.log(`Released stats:`, stats);

      const rSettlements = await CommissionSettlement.find({ orderId }).session(session);
      const rTransactions = await ReferralTransaction.find({ orderId }).session(session);
      
      console.log(`CommissionSettlements after release:`);
      rSettlements.forEach(s => {
        console.log(`  - Type: ${s.settlementType}, Recipient: ${s.recipientId}, Amount: ${s.amount}, Status: ${s.status}, releasedTransactionId: ${s.releasedTransactionId}`);
      });
      console.log(`ReferralTransactions after release:`);
      rTransactions.forEach(t => {
        console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Status: ${t.status}`);
      });

      // Let's inspect wallets in transaction after release
      console.log("\nWallets after release (moving pendingBalance -> availableBalance):");
      for (const t of rTransactions) {
        const w = await Wallet.findOne({ userId: t.recipientUserId }).session(session);
        console.log(`  - User ${t.recipientUserId} (${w?.userId}): pendingBalance=${w?.pendingBalance}, availableBalance=${w?.availableBalance}`);
        console.log(`    Ledger Entries count: ${w?.ledgerEntries.length}`);
        console.log(`    Ledger Entries:`, JSON.stringify(w?.ledgerEntries, null, 2));
      }
      for (const s of rSettlements) {
        const w = await Wallet.findOne({ userId: s.recipientId }).session(session);
        console.log(`  - Recipient ${s.recipientId} (${w?.userId}): pendingBalance=${w?.pendingBalance}, availableBalance=${w?.availableBalance}`);
        console.log(`    Ledger Entries count: ${w?.ledgerEntries.length}`);
        console.log(`    Ledger Entries:`, JSON.stringify(w?.ledgerEntries, null, 2));
      }

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
