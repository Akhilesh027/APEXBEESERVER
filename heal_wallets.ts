import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { Referral } from "./src/models/Referral";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { Wallet } from "./src/models/Wallet";
import { WalletEngine } from "./src/services/WalletEngine";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    const users = await User.find({});
    console.log(`Rebuilding and healing wallets for ${users.length} users...`);

    for (const user of users) {
      // Find all transactions, settlements, and referrals for this user
      const txs = await ReferralTransaction.find({ recipientUserId: user._id });
      const settlements = await CommissionSettlement.find({ recipientId: user._id });
      const referrals = await Referral.find({ referrerUserId: user._id, status: "rewarded" });

      if (txs.length === 0 && settlements.length === 0 && referrals.length === 0) {
        // No earnings, ensure wallet exists and is empty
        await WalletEngine.getOrCreateWallet(user._id);
        continue;
      }

      console.log(`\nHealing wallet for: ${user.name} (${user.email})...`);
      
      // Get or create wallet
      let wallet: any = await Wallet.findOne({ userId: user._id });
      if (wallet) {
        // Clear wallet entries so we can rebuild cleanly
        wallet.availableBalance = 0;
        wallet.pendingBalance = 0;
        wallet.withdrawnBalance = 0;
        wallet.totalCredits = 0;
        wallet.totalDebits = 0;
        wallet.ledgerEntries = [];
        await wallet.save();
      } else {
        wallet = await WalletEngine.getOrCreateWallet(user._id);
      }

      // Rebuild 1: KYC Referral Rewards (Signup Bonus)
      for (const ref of referrals) {
        await WalletEngine.credit(user._id, ref.rewardAmount, {
          category: "Referral Bonus",
          source: "referral",
          remarks: `${ref.referralType?.replace("_", " ").toUpperCase() || "CUSTOMER"} referral approved`,
          referenceId: ref._id,
          referenceType: "REFERRAL"
        });
      }

      // Rebuild 2: Referral Transactions
      for (const tx of txs) {
        if (tx.status === "placed" || tx.status === "pending") {
          await WalletEngine.hold(user._id, tx.amount, {
            category: "Referral Bonus",
            source: tx.transactionType,
            remarks: `Pending referral bonus for order ${tx.orderId}`,
            referenceId: tx.orderId,
            referenceType: "ORDER"
          });
        } else if (tx.status === "released") {
          // Re-create the hold-and-release trace
          const refId = tx.orderId;
          await WalletEngine.hold(user._id, tx.amount, {
            category: "Referral Bonus",
            source: tx.transactionType,
            remarks: `Pending referral bonus for order ${refId}`,
            referenceId: refId,
            referenceType: "ORDER"
          });

          await WalletEngine.release(user._id, tx.amount, {
            category: "Referral Bonus",
            source: tx.transactionType,
            remarks: `Released referral bonus level ${tx.level} for order ${refId}`,
            referenceId: refId,
            referenceType: "ORDER",
            releasedTransactionId: `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`
          });
        }
      }

      // Rebuild 3: Commission Settlements
      for (const s of settlements) {
        const category = s.settlementType === 'vendor' ? "Vendor Earnings" :
                         s.settlementType === 'franchise' ? "Franchise Commission" :
                         s.settlementType === 'entrepreneur' ? "Entrepreneur Commission" : "System Commission";

        if (s.status === "placed" || s.status === "pending") {
          await WalletEngine.hold(user._id, s.amount, {
            category,
            source: `${s.settlementType}_settlement`,
            remarks: `Pending ${s.settlementType} payout for order ${s.orderId}`,
            referenceId: s.orderId,
            referenceType: "ORDER"
          });
        } else if (s.status === "released") {
          await WalletEngine.hold(user._id, s.amount, {
            category,
            source: `${s.settlementType}_settlement`,
            remarks: `Pending ${s.settlementType} payout for order ${s.orderId}`,
            referenceId: s.orderId,
            referenceType: "ORDER"
          });

          await WalletEngine.release(user._id, s.amount, {
            category,
            source: `${s.settlementType}_settlement`,
            remarks: `Released ${s.settlementType} payout for order ${s.orderId}`,
            referenceId: s.orderId,
            referenceType: "ORDER",
            releasedTransactionId: s.releasedTransactionId || `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`
          });
        }
      }

      // Refresh wallet representation
      const updatedWallet = await Wallet.findOne({ userId: user._id });
      console.log(`  -> Restored wallet ID ${updatedWallet?._id}. Balances: Avail=${updatedWallet?.availableBalance}, Pend=${updatedWallet?.pendingBalance}, Ledgers=${updatedWallet?.ledgerEntries.length}`);
    }

    console.log("\nWallet healing and synchronization completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Heal failed:", err);
    process.exit(1);
  }
};

run();
