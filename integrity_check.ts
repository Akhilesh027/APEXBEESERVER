import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { Referral } from "./src/models/Referral";
import { ReferralTransaction } from "./src/models/ReferralTransaction";
import { CommissionSettlement } from "./src/models/CommissionSettlement";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    const users = await User.find({ roles: { $ne: "business_partner" } }); // Skip system wallets if any
    console.log(`Auditing ${users.length} users...`);

    let discrepanciesFound = 0;

    for (const user of users) {
      // 1. Sum of released referral transactions (First Purchase, Product Commissions)
      const txs = await ReferralTransaction.find({ recipientUserId: user._id, status: "released" });
      const releasedTxsSum = txs.reduce((sum, tx) => sum + tx.amount, 0);

      // 2. Sum of released commission settlements (Vendor, Franchise, Membership, Recurring)
      const settlements = await CommissionSettlement.find({ recipientId: user._id, status: "released" });
      const releasedSettlementsSum = settlements.reduce((sum, s) => sum + s.amount, 0);

      // 3. Sum of rewarded referrals (Signup/KYC direct referral rewards)
      const referrals = await Referral.find({ referrerUserId: user._id, status: "rewarded" });
      const rewardedReferralsSum = referrals.reduce((sum, r) => sum + r.rewardAmount, 0);

      const totalReleasedEarnings = releasedTxsSum + releasedSettlementsSum + rewardedReferralsSum;

      // 4. Wallet balances & Ledger Credits
      const wallet = await Wallet.findOne({ userId: user._id });
      
      const ledgerCreditsSum = wallet
        ? wallet.ledgerEntries
            .filter(e => e.type === "credit" && e.status === "completed" && e.category !== "Refund")
            .reduce((sum, e) => sum + e.amount, 0)
        : 0;

      const expectedWalletBalance = totalReleasedEarnings; // Since all released earnings are credited to available/withdrawn
      const actualWalletBalance = wallet ? (wallet.availableBalance + wallet.withdrawnBalance) : 0;

      // Check discrepancies
      const hasDiscrepancy = 
        Math.abs(totalReleasedEarnings - ledgerCreditsSum) > 0.01 || 
        Math.abs(totalReleasedEarnings - actualWalletBalance) > 0.01;

      if (hasDiscrepancy) {
        discrepanciesFound++;
        console.log(`\n[DISCREPANCY DETECTED] User: ${user.name} (${user.email}) [ID: ${user._id}]`);
        console.log(`  - Released Referral Transactions Sum: ₹${releasedTxsSum.toFixed(2)} (${txs.length} txs)`);
        console.log(`  - Released Commission Settlements Sum: ₹${releasedSettlementsSum.toFixed(2)} (${settlements.length} settlements)`);
        console.log(`  - Rewarded Referrals Sum (KYC):        ₹${rewardedReferralsSum.toFixed(2)} (${referrals.length} refs)`);
        console.log(`  - Total Released Earnings (Expected):  ₹${totalReleasedEarnings.toFixed(2)}`);
        console.log(`  - Wallet Ledger Credits Sum:            ₹${ledgerCreditsSum.toFixed(2)}`);
        console.log(`  - Wallet Available+Withdrawn Balance:   ₹${actualWalletBalance.toFixed(2)}`);
        console.log(`  - Wallet Document ID:                  ${wallet ? wallet._id : "NONE"}`);
        console.log(`  - Wallet Ledger Entries Count:         ${wallet ? wallet.ledgerEntries.length : 0}`);
      }
    }

    console.log(`\nAudit finished. Total discrepancies found: ${discrepanciesFound}`);
    process.exit(0);
  } catch (err) {
    console.error("Integrity check failed:", err);
    process.exit(1);
  }
};

run();
