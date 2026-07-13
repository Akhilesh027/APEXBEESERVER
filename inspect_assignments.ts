import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { DeliveryPartner } from "./src/models/DeliveryPartner";
import { DeliveryAssignment } from "./src/models/DeliveryAssignment";
import { Order } from "./src/models/Order";

dotenv.config();

const inspect = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI is not set");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to DB!");

    const partners = await DeliveryPartner.find({});
    console.log(`=== Delivery Partners (Total: ${partners.length}) ===`);
    for (const p of partners) {
      console.log(`Partner: ${p.name} | Mobile: ${p.mobile} | Status: ${p.status} | ID: ${p._id} | UserID: ${p.userId}`);
    }

    const assignments = await DeliveryAssignment.find({});
    console.log(`\n=== Delivery Assignments (Total: ${assignments.length}) ===`);
    for (const a of assignments) {
      console.log(`Assignment ID: ${a._id}`);
      console.log(`  Partner ID: ${a.partnerId}`);
      console.log(`  Order ID: ${a.orderId}`);
      console.log(`  Status: ${a.status}`);
      console.log(`  Pickup: ${a.pickupAddress}`);
      console.log(`  Delivery: ${a.deliveryAddress}`);
      console.log("------------------");
    }

    const orders = await Order.find({});
    console.log(`\n=== Total Orders: ${orders.length} ===`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
