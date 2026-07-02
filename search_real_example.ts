import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // Search by User IDs
    const manitejaId = "6a34ebbc35363fae65b72216";
    const checkId = "6a34ec1ee06436166e832111";
    const orderId = "6a35025375abab28b1dd80da";
    const orderNumber = "AB-1781858899894-6609";
    const productId = "6a342092050e2cbdbbc35692";

    console.log("\n--- Checking User: Maniteja Goud ---");
    const u1 = await User.findById(manitejaId) || await User.findOne({ name: /Maniteja/i });
    console.log("Found User 1:", u1 ? `${u1.name} (${u1._id})` : "NOT FOUND");
    if (u1) {
      console.log("Referral Code:", u1.referralCode);
      console.log("Referred By:", u1.referredBy);
      console.log("Hierarchy:", JSON.stringify(u1.referralHierarchy, null, 2));
    }

    console.log("\n--- Checking User: check ---");
    const u2 = await User.findById(checkId) || await User.findOne({ name: "check" }) || await User.findOne({ email: "ahileshreddy2@gmail.com" });
    console.log("Found User 2:", u2 ? `${u2.name} (${u2._id})` : "NOT FOUND");
    if (u2) {
      console.log("Referral Code:", u2.referralCode);
      console.log("Referred By:", u2.referredBy);
      console.log("Hierarchy:", JSON.stringify(u2.referralHierarchy, null, 2));
    }

    console.log("\n--- Checking Product ---");
    const prod = await Product.findById(productId);
    console.log("Found Product:", prod ? `${prod.name} (${prod._id})` : "NOT FOUND");

    console.log("\n--- Checking Order ---");
    const ordById = await Order.findById(orderId);
    const ordByNum = await Order.findOne({ orderNumber });
    console.log("Found Order by ID:", ordById ? `${ordById.orderNumber} (${ordById._id})` : "NOT FOUND");
    console.log("Found Order by Number:", ordByNum ? `${ordByNum.orderNumber} (${ordByNum._id})` : "NOT FOUND");

    const targetOrder = ordById || ordByNum;
    if (targetOrder) {
      console.log("Order Status:", targetOrder.orderStatus);
      console.log("Payment Status:", targetOrder.paymentStatus);
      console.log("Customer ID:", targetOrder.customerId);
      console.log("Seller ID:", targetOrder.sellerId);
      console.log("Total Amount:", targetOrder.totalAmount);
      console.log("Items:", JSON.stringify(targetOrder.items, null, 2));
      console.log("Timeline:", JSON.stringify(targetOrder.timeline, null, 2));

      console.log("\n--- Checking Settlements for Target Order ---");
      const settlements = await CommissionSettlement.find({ orderId: targetOrder._id });
      console.log(`Found ${settlements.length} CommissionSettlement records:`);
      console.log(JSON.stringify(settlements, null, 2));

      console.log("\n--- Checking Referral Transactions for Target Order ---");
      const referralTxs = await ReferralTransaction.find({ orderId: targetOrder._id });
      console.log(`Found ${referralTxs.length} ReferralTransaction records:`);
      console.log(JSON.stringify(referralTxs, null, 2));
    } else {
      console.log("\n--- Checking Referral Transactions generally matching these users ---");
      const rtxs = await ReferralTransaction.find({
        $or: [
          { referredUserId: checkId },
          { recipientUserId: checkId },
          { referredUserId: manitejaId },
          { recipientUserId: manitejaId }
        ]
      });
      console.log(`Found ${rtxs.length} general referral transactions:`);
      rtxs.forEach(r => {
        console.log(`  RTX ${r._id}: from=${r.referredUserId} to=${r.recipientUserId} type=${r.transactionType} amount=${r.amount} status=${r.status} order=${r.orderId}`);
      });

      console.log("\n--- Checking Commission Settlements generally matching Maniteja or check ---");
      const csets = await CommissionSettlement.find({
        $or: [
          { recipientId: checkId },
          { recipientId: manitejaId }
        ]
      });
      console.log(`Found ${csets.length} general commission settlements:`);
      csets.forEach(c => {
        console.log(`  Settle ${c._id}: recipient=${c.recipientId} type=${c.settlementType} amount=${c.amount} status=${c.status} order=${c.orderId}`);
      });
    }

    console.log("\n--- Checking Wallets for both users ---");
    const w1 = await Wallet.findOne({ userId: manitejaId });
    console.log("Maniteja Goud Wallet:", w1 ? JSON.stringify(w1, null, 2) : "NOT FOUND");
    
    const w2 = await Wallet.findOne({ userId: checkId });
    console.log("check Wallet:", w2 ? JSON.stringify(w2, null, 2) : "NOT FOUND");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
