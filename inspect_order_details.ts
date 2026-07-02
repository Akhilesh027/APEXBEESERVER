import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import { User } from "./src/models/User";
import Product from "./src/models/Product";
import { BusinessRelationship } from "./src/models/BusinessRelationship";

dotenv.config();

const inspect = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderId = "6a37c8c0fd9043df7b3e93bd"; // order number: AB-1782040768163-4335
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found!");
      process.exit(1);
    }

    console.log("--- Order Details ---");
    console.log(`Order Number: ${order.orderNumber}`);
    console.log(`Customer: ${order.customerId}`);
    console.log(`Seller: ${order.sellerId}`);
    console.log(`Payment Status: ${order.paymentStatus}`);
    console.log(`Order Status: ${order.orderStatus}`);
    console.log(`Commission Release Status: ${order.commissionReleaseStatus}`);
    console.log("Items:");
    for (const item of order.items) {
      console.log(`  - ProductId: ${item.productId}, Qty: ${item.quantity}, Price: ${item.price}`);
      const prod = await Product.findById(item.productId);
      if (prod) {
        console.log(`    Product Name: ${prod.name}`);
        console.log(`    Product Seller: ${prod.sellerId}`);
        console.log(`    Admin Pricing Shares:`, JSON.stringify(prod.adminPricing?.commissionShares, null, 2));
      } else {
        console.log(`    Product not found in Product collection!`);
      }
    }

    const customer = await User.findById(order.customerId);
    if (customer) {
      console.log("--- Customer Details ---");
      console.log(`Name: ${customer.name}`);
      console.log(`Email: ${customer.email}`);
      console.log(`ReferredBy: ${customer.referredBy}`);
      console.log(`Referral Code: ${customer.referralCode}`);
      console.log(`Hierarchy:`, JSON.stringify(customer.referralHierarchy, null, 2));
    } else {
      console.log("Customer not found in User collection!");
    }

    const seller = await User.findById(order.sellerId);
    if (seller) {
      console.log("--- Seller Details ---");
      console.log(`Name: ${seller.name}`);
      console.log(`Roles:`, seller.roles);
      const rel = await BusinessRelationship.findOne({ userId: seller._id });
      console.log(`BusinessRelationship:`, JSON.stringify(rel, null, 2));
    } else {
      console.log("Seller not found in User collection!");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

inspect();
