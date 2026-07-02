import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { BusinessRelationship } from "./src/models/BusinessRelationship";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected successfully!");

    const orderId = "6a34f665e75c25e1ec6d1924";
    const order = await Order.findById(orderId);
    if (!order) {
      console.log("Order not found:", orderId);
      process.exit(1);
    }

    console.log("=== Order details ===");
    console.log(`Order: ${order.orderNumber} (${order._id})`);
    console.log(`Status: ${order.orderStatus}`);
    console.log(`Customer ID: ${order.customerId}`);

    const customer = await User.findById(order.customerId);
    if (!customer) {
      console.log("Customer not found!");
    } else {
      console.log(`Customer name: ${customer.name}, firstOrderQualified: ${customer.firstOrderQualified}, referralHierarchy:`, JSON.stringify(customer.referralHierarchy, null, 2));
    }

    console.log("Items count:", order.items?.length);
    for (const item of order.items || []) {
      console.log("--- Item ---");
      console.log("Product ID:", item.productId);
      const product = await Product.findById(item.productId);
      if (!product) {
        console.log("Product not found in database!");
        continue;
      }
      console.log(`Product: ${product.name}, Seller: ${product.sellerId}, sellerType: ${product.sellerType}`);
      console.log(`adminPricing:`, JSON.stringify(product.adminPricing, null, 2));
      console.log(`referralCommission:`, JSON.stringify(product.referralCommission, null, 2));

      const rel = await BusinessRelationship.findOne({
        businessId: product.sellerId,
        businessType: "vendor",
        status: "active"
      });
      console.log(`BusinessRelationship (businessType="vendor"):`, rel);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
