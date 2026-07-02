import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { BusinessRelationship } from "./src/models/BusinessRelationship";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

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

    // Let's trace SettlementEngine.createSettlements logic
    console.log("Order customerId:", order.customerId);
    console.log("Order items length:", order.items.length);

    for (const item of order.items) {
      console.log("Item:", item);
      const product = await Product.findById(item.productId);
      if (!product) {
        console.log("Product not found:", item.productId);
        continue;
      }
      console.log("Product found:", product._id, product.name);
      console.log("product.sellerId:", product.sellerId);
      console.log("product.adminPricing.finalSellerAmount:", product.adminPricing?.finalSellerAmount);

      const rel = await BusinessRelationship.findOne({
        businessId: product.sellerId,
        businessType: "vendor",
        status: "active"
      });
      console.log("BusinessRelationship found:", rel);

      // Payout amount
      const platformFeePercent = product.adminPricing?.platformFeePercent || 0;
      const totalSellingAmount = item.price * item.quantity;
      const totalPlatformFee = (totalSellingAmount * platformFeePercent) / 100;
      console.log("platformFeePercent:", platformFeePercent);
      console.log("totalSellingAmount:", totalSellingAmount);
      console.log("totalPlatformFee:", totalPlatformFee);

      const finalSellerAmount = (product.adminPricing?.finalSellerAmount || (item.price - (platformFeePercent * item.price / 100) - (product.adminPricing?.shippingCharge || 0) - (product.adminPricing?.packingCharge || 0))) * item.quantity;
      console.log("finalSellerAmount calculated:", finalSellerAmount);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
