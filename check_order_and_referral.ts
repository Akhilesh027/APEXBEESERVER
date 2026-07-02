import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { User } from "./src/models/User";
import { Order } from "./src/models/Order";
import { ReferralSettings } from "./src/models/ReferralSettings";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const inspect = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a38cc01ee7783b244b0aca0";
    const referredUserId = "6a37d39f9d26c495b72f3882";

    console.log("\n=== 1. Referral Settings ===");
    const settings = await ReferralSettings.findOne({});
    console.log(JSON.stringify(settings, null, 2));

    console.log("\n=== 2. Referred User Profile ===");
    const user = await User.findById(referredUserId);
    console.log(JSON.stringify(user, null, 2));

    console.log("\n=== 3. Orders for Referred User ===");
    const orders = await Order.find({ customerId: referredUserId });
    console.log(`Found ${orders.length} orders:`);
    orders.forEach(o => {
      console.log(`  - Order ID: ${o._id}, Status: ${o.orderStatus}, Number: ${o.orderNumber}, Paid: ${o.paymentStatus}`);
    });

    console.log("\n=== 4. Referral Transactions for this Order ===");
    const txs = await ReferralTransaction.find({ orderId });
    console.log(`Found ${txs.length} transactions for order ${orderId}:`);
    txs.forEach(t => {
      console.log(`  - Type: ${t.transactionType}, Recipient: ${t.recipientUserId}, Amount: ${t.amount}, Level: ${t.level}, Status: ${t.status}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
