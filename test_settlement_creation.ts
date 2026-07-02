import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { User } from "./src/models/User";
import { SettlementEngine } from "./src/services/SettlementEngine";

dotenv.config();

const test = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    // Find any order that has 0 settlements
    const order = await Order.findOne();
    if (!order) {
      console.log("No order found");
      process.exit(1);
    }

    console.log(`Testing with Order ID: ${order._id}, orderNumber: ${order.orderNumber}`);
    console.log(`Customer ID: ${order.customerId}`);

    // Check if customer exists
    const customer = await User.findById(order.customerId);
    if (!customer) {
      console.log(`Customer ${order.customerId} does not exist in User collection!`);
    } else {
      console.log(`Customer exists: ${customer.name}, referralHierarchy:`, JSON.stringify(customer.referralHierarchy, null, 2));
      console.log(`Customer firstOrderQualified: ${customer.firstOrderQualified}`);
    }

    // Check items count
    console.log(`Order items count: ${order.items?.length}`);
    if (order.items && order.items.length > 0) {
      console.log(`First item product ID: ${order.items[0].productId}`);
    }

    console.log("Running SettlementEngine.createSettlements...");
    // Let's capture output of createSettlements
    await SettlementEngine.createSettlements(order);
    console.log("SettlementEngine.createSettlements finished.");

    // Check if settlements or transactions were created
    const settlementsCount = await mongoose.model("CommissionSettlement").countDocuments({ orderId: order._id });
    const referralTxsCount = await mongoose.model("ReferralTransaction").countDocuments({ orderId: order._id });
    console.log(`Created CommissionSettlements: ${settlementsCount}`);
    console.log(`Created ReferralTransactions: ${referralTxsCount}`);

    process.exit(0);
  } catch (err) {
    console.error("Error running test:", err);
    process.exit(1);
  }
};

test();
