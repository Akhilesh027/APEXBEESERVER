import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const inspect = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const deliveredOrders = await Order.find({ orderStatus: "Delivered" }).limit(5);
    console.log(`Found ${deliveredOrders.length} delivered orders:`);
    for (const o of deliveredOrders) {
      console.log(`Order: ${o.orderNumber} (${o._id})`);
      const settlements = await CommissionSettlement.find({ orderId: o._id });
      const referralTxs = await ReferralTransaction.find({ orderId: o._id });

      console.log(`  CommissionSettlements: ${settlements.length}`);
      settlements.forEach(s => {
        console.log(`    - Type: ${s.settlementType}, Recipient: ${s.recipientId}, Amount: ${s.amount}, Status: ${s.status}, ReleaseDate: ${s.releaseDate.toISOString()}`);
      });

      console.log(`  ReferralTransactions: ${referralTxs.length}`);
      referralTxs.forEach(tx => {
        console.log(`    - Type: ${tx.transactionType}, Recipient: ${tx.recipientUserId}, Amount: ${tx.amount}, Status: ${tx.status}, ReleaseDate: ${tx.releaseDate.toISOString()}`);
      });
      console.log("------------------");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
