import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { ReferralSettings } from "./src/models/ReferralSettings";

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

    const customer = await User.findById(order.customerId);
    if (!customer) {
      console.log("Customer not found");
      process.exit(1);
    }

    console.log("customer.firstOrderQualified:", customer.firstOrderQualified);

    const settings = await ReferralSettings.findOne({}) || new ReferralSettings();
    console.log("settings.enabled:", settings.enabled);
    console.log("settings.firstOrderRewards:", settings.firstOrderRewards);

    // Let's run the exact logic
    let totalProductFirstPurchaseAmount = 0;
    let hasAnyProductFirstPurchaseConfig = false;
    if (order.items && order.items.length > 0) {
      const productIds = order.items.map((item: any) => item.productId);
      console.log("Product IDs in items:", productIds);
      const products = await Product.find({ _id: { $in: productIds } });
      console.log("Products found count:", products.length);
      const productsMap = new Map(products.map((p: any) => [p._id.toString(), p]));

      for (const item of order.items) {
        const product = productsMap.get(item.productId.toString());
        console.log("Checking product:", product ? product.name : "null");
        if (product) {
          console.log("product.adminPricing:", JSON.stringify(product.adminPricing, null, 2));
          const share = product.adminPricing?.commissionShares?.find(
            (s: any) => s.type === "firstPurchase" && s.isActive !== false
          );
          console.log("Share type firstPurchase found:", share);
          if (share) {
            hasAnyProductFirstPurchaseConfig = true;
            totalProductFirstPurchaseAmount += (share.amount || 0) * (item.quantity || 1);
          }
        }
      }
    }

    console.log("hasAnyProductFirstPurchaseConfig:", hasAnyProductFirstPurchaseConfig);
    console.log("totalProductFirstPurchaseAmount:", totalProductFirstPurchaseAmount);

    const l1Amount = hasAnyProductFirstPurchaseConfig
      ? totalProductFirstPurchaseAmount
      : settings.firstOrderRewards.level1;

    console.log("l1Amount calculated:", l1Amount);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
