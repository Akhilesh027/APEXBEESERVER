import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { User } from "./src/models/User";
import { Order } from "./src/models/Order";
import Product from "./src/models/Product";
import { ReferralSettings } from "./src/models/ReferralSettings";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { Wallet } from "./src/models/Wallet";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { WalletEngine } from "./src/services/WalletEngine";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://localhost:27017/apexbee";

async function runVerification() {
  try {
    console.log("Connecting to MongoDB:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected successfully.");

    // 1. Ensure system profiles and wallets exist
    await SettlementEngine.ensureSystemProfiles();
    const companyWallet = await WalletEngine.getOrCreateWallet(SettlementEngine.COMPANY_ID);
    console.log(`Company Wallet ID: ${companyWallet._id}, Initial Available: Rs.${companyWallet.availableBalance}, Pending: Rs.${companyWallet.pendingBalance}`);

    // 2. Ensure ReferralSettings
    let refSettings = await ReferralSettings.findOne({});
    if (!refSettings) {
      refSettings = new ReferralSettings({
        enabled: true,
        firstOrderRewards: { level1: 50, level2: 25, level3: 10 }
      });
      await refSettings.save();
    } else {
      refSettings.enabled = true;
      refSettings.firstOrderRewards = { level1: 50, level2: 25, level3: 10 };
      await refSettings.save();
    }

    // 3. Create unreferred test customer
    const testCustomerId = new mongoose.Types.ObjectId();
    const customer = new User({
      _id: testCustomerId,
      name: "Test Unreferred Customer",
      email: `unreferred_${Date.now()}@test.com`,
      password: "password123",
      roles: ["customer"],
      firstOrderQualified: false,
      referralHierarchy: {
        level1UserId: null,
        level2UserId: null,
        level3UserId: null
      }
    });
    await customer.save();
    console.log("Created test unreferred customer:", customer._id);

    // 4. Create test product with referral shares
    const testSellerId = new mongoose.Types.ObjectId();
    const product = new Product({
      name: "Test Referral Fallback Product",
      slug: `test-ref-product-${Date.now()}`,
      sellerId: testSellerId,
      price: 1000,
      stock: 100,
      adminPricing: {
        platformFeePercent: 10,
        vendorCommissionPercent: 10,
        distributedFrom: "platform_fee",
        commissionBase: "platform_fee",
        commissionShares: [
          { type: "level1", percent: 20, isActive: true },
          { type: "level2", percent: 10, isActive: true },
          { type: "level3", percent: 5, isActive: true },
          { type: "state", percent: 5, isActive: true },
          { type: "district", percent: 5, isActive: true },
          { type: "mandal", percent: 5, isActive: true },
          { type: "entrepreneur", percent: 10, isActive: true },
          { type: "company", percent: 40, isActive: true }
        ]
      }
    });
    await product.save();
    console.log("Created test product:", product._id);

    // 5. Create test order
    const testOrderId = new mongoose.Types.ObjectId();
    const order = new Order({
      _id: testOrderId,
      orderNumber: `TEST-ORD-${Date.now().toString().slice(-6)}`,
      customerId: customer._id,
      sellerId: testSellerId,
      totalAmount: 1000,
      orderStatus: "Delivered",
      paymentStatus: "Paid",
      items: [
        {
          productId: product._id,
          price: 1000,
          quantity: 1
        }
      ]
    });
    await order.save();
    console.log("Created test order:", order._id);

    // 6. Process settlements
    console.log("\n--- Executing SettlementEngine.processOrderSettlements ---");
    await SettlementEngine.processOrderSettlements(order);

    // 7. Verify generated records
    const referralTxs = await ReferralTransaction.find({ orderId: order._id });
    console.log(`\nGenerated ${referralTxs.length} ReferralTransactions:`);
    for (const tx of referralTxs) {
      console.log(`  - Type: ${tx.transactionType}, Level: ${tx.level}, Amount: Rs.${tx.amount}, Recipient: ${tx.recipientUserId} (Is Company: ${tx.recipientUserId.toString() === SettlementEngine.COMPANY_ID.toString()}), Reason: ${tx.rewardReason}`);
    }

    const settlements = await CommissionSettlement.find({ orderId: order._id });
    console.log(`\nGenerated ${settlements.length} CommissionSettlements:`);
    for (const s of settlements) {
      console.log(`  - Type: ${s.settlementType}, Amount: Rs.${s.amount}, Recipient: ${s.recipientId} (Is Company: ${s.recipientId.toString() === SettlementEngine.COMPANY_ID.toString()})`);
    }

    // 8. Test pend & release
    console.log("\n--- Testing Settlement Release to Wallets ---");
    await SettlementEngine.pendSettlements(order._id);
    await ReferralTransaction.updateMany({ orderId: order._id }, { releaseDate: new Date(Date.now() - 10000) });
    await CommissionSettlement.updateMany({ orderId: order._id }, { releaseDate: new Date(Date.now() - 10000) });

    const releaseStats = await SettlementEngine.releaseEligibleSettlements(undefined, order._id);
    console.log(`Released: ${releaseStats.releasedTxs} Referral Txs, ${releaseStats.releasedSettlements} Commission Settlements`);

    const updatedCompanyWallet = await Wallet.findOne({ userId: SettlementEngine.COMPANY_ID });
    console.log(`\nCompany Wallet After Release: Available: Rs.${updatedCompanyWallet?.availableBalance}, Total Credits: Rs.${updatedCompanyWallet?.totalCredits}`);

    // Verify assertions
    const companyRefTxs = referralTxs.filter(t => t.recipientUserId.toString() === SettlementEngine.COMPANY_ID.toString());
    if (companyRefTxs.length >= 4) {
      console.log("\n[SUCCESS] Unreferred first-order bonus and product referral commission fallbacks correctly routed to Company System Wallet!");
    } else {
      console.error("\n[FAILURE] Expected at least 4 company referral transactions, found:", companyRefTxs.length);
    }

    // 9. Cleanup
    await Order.findByIdAndDelete(testOrderId);
    await Product.findByIdAndDelete(product._id);
    await User.findByIdAndDelete(testCustomerId);
    await ReferralTransaction.deleteMany({ orderId: testOrderId });
    await CommissionSettlement.deleteMany({ orderId: testOrderId });
    console.log("\nCleaned up test data.");

  } catch (err: any) {
    console.error("Verification failed with error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  }
}

runVerification();
