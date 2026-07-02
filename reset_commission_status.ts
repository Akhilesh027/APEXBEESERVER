import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const reset = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderNumbers = ["AB-1782040768163-4335", "AB-1782040820764-9850"];

    for (const num of orderNumbers) {
      const order = await Order.findOne({ orderNumber: num });
      if (!order) {
        console.log(`Order ${num} not found.`);
        continue;
      }

      console.log(`Order: ${order.orderNumber}`);
      console.log(`  Current commissionReleaseStatus: ${order.commissionReleaseStatus}`);
      console.log(`  Timeline length: ${order.timeline.length}`);

      // Reset release status
      order.commissionReleaseStatus = "Pending";
      order.commissionReleasedAt = undefined as any;

      // Filter out 'Commissions Released' timeline entry
      order.timeline = order.timeline.filter(t => t.status !== "Commissions Released");

      const txs = await ReferralTransaction.find({ orderId: order._id });
      const sets = await CommissionSettlement.find({ orderId: order._id });

      // Reset to placed status
      for (const t of txs) {
        t.status = "placed";
        t.released = false;
        t.walletCredited = false;
        t.releasedAt = undefined;
        await t.save();
      }
      for (const s of sets) {
        s.status = "placed";
        s.released = false;
        s.walletCredited = false;
        s.releasedAt = undefined;
        await s.save();
      }

      await order.save();

      console.log(`  -> Reset to Pending, removed timeline entry, and set commissions status back to placed.`);
      console.log(`  -> Found ${txs.length} referral txs, status: ${txs.map(t => t.status).join(", ")}`);
      console.log(`  -> Found ${sets.length} commission settlements, status: ${sets.map(s => s.status).join(", ")}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Reset failed:", err);
    process.exit(1);
  }
};

reset();
