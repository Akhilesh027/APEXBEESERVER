import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { ReferralSettings } from "./src/models/ReferralSettings";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    
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

    console.log("Customer firstOrderQualified:", customer.firstOrderQualified);
    console.log("Customer referralHierarchy:", customer.referralHierarchy);

    if (order.items && order.items.length > 0) {
      const productIds = order.items.map((item: any) => item.productId);
      console.log("Product IDs in order:", productIds);
      const products = await Product.find({ _id: { $in: productIds } });
      console.log("Found products count:", products.length);
      const productsMap = new Map(products.map((p: any) => [p._id.toString(), p]));

      for (const item of order.items) {
        console.log("Looking up item productId:", item.productId, "toString():", item.productId.toString());
        const product = productsMap.get(item.productId.toString());
        if (product) {
          console.log("Product found:", product.name);
          console.log("product.adminPricing:", JSON.stringify(product.adminPricing, null, 2));
          const share = product.adminPricing?.commissionShares?.find(
            (s: any) => s.type === "firstPurchase" && s.isActive !== false
          );
          console.log("Share found:", share);
        } else {
          console.log("Product NOT found in map!");
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
