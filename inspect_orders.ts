import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";

dotenv.config();

const inspect = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
    console.log(`Found ${orders.length} orders:`);
    orders.forEach(o => {
      console.log(`Order: ${o.orderNumber} (${o._id})`);
      console.log(`  Status: ${o.orderStatus}`);
      console.log(`  Payment Status: ${o.paymentStatus}`);
      console.log(`  Timeline:`, JSON.stringify(o.timeline, null, 2));
      console.log(`  OrderStatusObj:`, JSON.stringify(o.orderStatusObj, null, 2));
      console.log("------------------");
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
