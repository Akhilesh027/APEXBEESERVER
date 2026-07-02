import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { User } from "./src/models/User";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { Wallet } from "./src/models/Wallet";
import { BusinessRelationship } from "./src/models/BusinessRelationship";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to database:", mongoURI);

    const orderId = "6a35025375abab28b1dd80da";
    const productId = "6a342092050e2cbdbbc35692";

    console.log("\n=== ORDER ===");
    const order = await Order.findById(orderId);
    console.log(JSON.stringify(order, null, 2));

    console.log("\n=== PRODUCT ===");
    const product = await Product.findById(productId);
    console.log(JSON.stringify(product, null, 2));

    console.log("\n=== COMMISSION SETTLEMENTS FOR ORDER ===");
    const settlements = await CommissionSettlement.find({ orderId });
    console.log(`Found ${settlements.length} settlements:`);
    console.log(JSON.stringify(settlements, null, 2));

    console.log("\n=== REFERRAL TRANSACTIONS FOR ORDER ===");
    const rtxs = await ReferralTransaction.find({ orderId });
    console.log(`Found ${rtxs.length} referral transactions:`);
    console.log(JSON.stringify(rtxs, null, 2));

    if (product) {
      console.log("\n=== BUSINESS RELATIONSHIP FOR SELLER ===");
      const rel = await BusinessRelationship.findOne({
        businessId: product.sellerId,
        businessType: "vendor"
      });
      console.log(JSON.stringify(rel, null, 2));
    }

    if (order) {
      console.log("\n=== WALLET FOR CUSTOMER ===");
      const customerWallet = await Wallet.findOne({ userId: order.customerId });
      console.log(JSON.stringify(customerWallet, null, 2));

      const customerUser = await User.findById(order.customerId);
      console.log("\n=== CUSTOMER USER ===");
      console.log(JSON.stringify(customerUser, null, 2));
    }

    // Let's also check all wallets in the DB to see if any have ledger entries
    console.log("\n=== SYSTEM WALLETS ===");
    const companyWallet = await Wallet.findOne({ userId: "660000000000000000000001" });
    const wishlinkWallet = await Wallet.findOne({ userId: "660000000000000000000002" });
    const referralPoolWallet = await Wallet.findOne({ userId: "660000000000000000000003" });
    console.log("Company Wallet:", JSON.stringify(companyWallet, null, 2));
    console.log("Wishlink Wallet:", JSON.stringify(wishlinkWallet, null, 2));
    console.log("Referral Pool Wallet:", JSON.stringify(referralPoolWallet, null, 2));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
