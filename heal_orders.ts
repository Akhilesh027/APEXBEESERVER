import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { SettlementEngine } from "./src/services/SettlementEngine";

dotenv.config();

const heal = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orders = await Order.find({});
    console.log(`Processing ${orders.length} total orders...`);

    let healedCount = 0;
    for (const o of orders) {
      const settlementsCount = await CommissionSettlement.countDocuments({ orderId: o._id });
      const referralTxsCount = await ReferralTransaction.countDocuments({ orderId: o._id });

      if (settlementsCount === 0 && referralTxsCount === 0) {
        console.log(`Order ${o.orderNumber} (${o._id}) has 0 settlements. Generating now...`);
        
        // Reset customer firstOrderQualified to false temporarily if we want to regenerate first order rewards
        // but let's just run createSettlements
        await SettlementEngine.createSettlements(o);
        
        const newSettle = await CommissionSettlement.countDocuments({ orderId: o._id });
        const newRef = await ReferralTransaction.countDocuments({ orderId: o._id });
        console.log(`  -> Generated ${newSettle} settlements, ${newRef} referral transactions.`);
        healedCount++;
      }
    }

    console.log(`Successfully healed ${healedCount} orders.`);
    process.exit(0);
  } catch (err) {
    console.error("Heal failed:", err);
    process.exit(1);
  }
};

heal();
