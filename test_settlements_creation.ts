import mongoose from "mongoose";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { SettlementEngine } from "./src/services/SettlementEngine";

const run = async () => {
  try {
    const mongoURI = "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to local DB!");

    const orderId = "6a35025375abab28b1dd80da";
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found");
      process.exit(1);
    }

    // Let's clear any settlements for this order first
    await CommissionSettlement.deleteMany({ orderId });
    console.log("Cleared old settlements.");

    // Now run SettlementEngine.createSettlements(order)
    console.log("Running createSettlements...");
    await SettlementEngine.createSettlements(order);

    const settlements = await CommissionSettlement.find({ orderId });
    console.log(`Found ${settlements.length} settlements created:`);
    console.log(JSON.stringify(settlements, null, 2));

    process.exit(0);
  } catch (err: any) {
    console.error("Error running createSettlements:", err);
    process.exit(1);
  }
};

run();
