import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { User } from "./src/models/User";
import { Wallet } from "./src/models/Wallet";
import { WalletTransaction } from "./src/models/WalletTransaction";

dotenv.config();

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not set!");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB successfully!");

  const users = await User.find({}).lean();
  const wallets = await Wallet.find({}).lean();
  const transactions = await WalletTransaction.find({}).sort({ createdAt: -1 }).lean();

  console.log(`Found ${users.length} Users, ${wallets.length} Wallets, ${transactions.length} WalletTransactions in collection.`);

  // Map users by ID
  const userMap = new Map();
  for (const u of users) {
    userMap.set(u._id.toString(), u);
  }

  // Map wallets by userId
  const walletByUserId = new Map();
  for (const w of wallets) {
    if (w.userId) {
      walletByUserId.set(w.userId.toString(), w);
    }
  }

  // Map transactions by userId
  const txsByUserId = new Map();
  for (const tx of transactions) {
    const uId = tx.userId ? tx.userId.toString() : "unknown";
    if (!txsByUserId.has(uId)) {
      txsByUserId.set(uId, []);
    }
    txsByUserId.get(uId).push(tx);
  }

  const results = [];

  for (const user of users) {
    const userIdStr = user._id.toString();
    const wallet = walletByUserId.get(userIdStr);
    const userTxs = txsByUserId.get(userIdStr) || [];

    const ledgerEntries = wallet?.ledgerEntries || [];

    results.push({
      userId: userIdStr,
      name: user.name || "N/A",
      email: user.email || "N/A",
      phone: user.phone || "N/A",
      roles: user.roles || [],
      referralCode: user.referralCode || "",
      walletFound: !!wallet,
      walletId: wallet ? wallet._id.toString() : null,
      availableBalance: wallet ? wallet.availableBalance : 0,
      pendingBalance: wallet ? wallet.pendingBalance : 0,
      holdBalance: wallet ? wallet.holdBalance : 0,
      withdrawnBalance: wallet ? wallet.withdrawnBalance : 0,
      rewardCoins: wallet ? wallet.rewardCoins : 0,
      totalCredits: wallet ? wallet.totalCredits : 0,
      totalDebits: wallet ? wallet.totalDebits : 0,
      ledgerEntriesCount: ledgerEntries.length,
      ledgerEntries: ledgerEntries,
      transactionsCount: userTxs.length,
      walletTransactions: userTxs.map(t => ({
        id: t._id,
        transactionId: t.transactionId,
        type: t.type,
        direction: t.direction,
        grossAmount: t.grossAmount ?? t.amount ?? 0,
        netAmount: t.netAmount ?? t.amount ?? 0,
        openingBalance: t.openingBalance ?? t.balanceBefore ?? 0,
        closingBalance: t.closingBalance ?? t.balanceAfter ?? 0,
        status: t.status,
        createdAt: t.createdAt,
        notes: t.notes || "",
        orderId: t.orderId,
      })),
    });
  }

  // Also check if any wallets have userId not in users collection
  for (const wallet of wallets) {
    const uId = wallet.userId ? wallet.userId.toString() : "unknown";
    if (!userMap.has(uId)) {
      const userTxs = txsByUserId.get(uId) || [];
      results.push({
        userId: uId,
        name: "Unknown / Orphaned User",
        email: "N/A",
        phone: "N/A",
        roles: [],
        referralCode: "",
        walletFound: true,
        walletId: wallet._id.toString(),
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        holdBalance: wallet.holdBalance,
        withdrawnBalance: wallet.withdrawnBalance,
        rewardCoins: wallet.rewardCoins,
        totalCredits: wallet.totalCredits,
        totalDebits: wallet.totalDebits,
        ledgerEntriesCount: wallet.ledgerEntries?.length || 0,
        ledgerEntries: wallet.ledgerEntries || [],
        transactionsCount: userTxs.length,
        walletTransactions: userTxs,
      });
    }
  }

  const outputPath = path.join(__dirname, "all_users_wallet_data.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved detailed report to ${outputPath}`);

  // Summary output to console
  console.log("\n=================== USER WALLETS SUMMARY ===================");
  for (const r of results) {
    console.log(`\nUser: ${r.name} (${r.email || r.phone || "No contact"})`);
    console.log(`  User ID: ${r.userId} | Roles: [${r.roles.join(", ")}]`);
    console.log(`  Wallet: ${r.walletFound ? "EXISTS" : "NONE"}`);
    if (r.walletFound) {
      console.log(`  Available Balance: ₹${r.availableBalance} | Pending: ₹${r.pendingBalance} | Hold: ₹${r.holdBalance} | Withdrawn: ₹${r.withdrawnBalance} | Reward Coins: ${r.rewardCoins}`);
      console.log(`  Ledger Entries Count: ${r.ledgerEntriesCount} | Dedicated WalletTransactions Count: ${r.transactionsCount}`);
      
      if (r.ledgerEntries.length > 0) {
        console.log(`  --- Ledger Entries (${r.ledgerEntries.length}) ---`);
        for (const le of r.ledgerEntries) {
          console.log(`    [${le.createdAt || le.date || "N/A"}] ${le.type?.toUpperCase()} ₹${le.amount} | Cat: ${le.category || le.referenceType || "N/A"} | Status: ${le.status} | Remarks: ${le.remarks || le.description || "-"}`);
        }
      }

      if (r.walletTransactions.length > 0) {
        console.log(`  --- Dedicated Wallet Transactions (${r.walletTransactions.length}) ---`);
        for (const wt of r.walletTransactions) {
          console.log(`    [${wt.createdAt}] ${wt.direction?.toUpperCase()} ₹${wt.netAmount} (${wt.type}) | Bal: ${wt.openingBalance} -> ${wt.closingBalance} | Status: ${wt.status} | Note: ${wt.notes || "-"}`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
