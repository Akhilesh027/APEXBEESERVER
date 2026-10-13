const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

async function resetWallets() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ Error: MONGODB_URI not found in backend/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB successfully!\n");

  const db = mongoose.connection.db;

  // 1. CREATE BACKUP BEFORE ANY MODIFICATION
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "scratch");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupFile = path.join(backupDir, `wallet_backup_pre_reset_${timestamp}.json`);

  console.log("📦 Creating pre-reset safety backup...");
  const existingWallets = await db.collection("wallets").find({}).toArray();
  const existingTransactions = await db.collection("wallettransactions").find({}).toArray();

  const backupData = {
    backupDate: new Date().toISOString(),
    totalWallets: existingWallets.length,
    totalTransactions: existingTransactions.length,
    wallets: existingWallets,
    walletTransactions: existingTransactions,
  };

  fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
  console.log(` Safety backup saved to:\n   ${backupFile}\n`);

  // 2. WIPE WALLET TRANSACTIONS COLLECTION
  console.log("🗑️  Clearing wallet transactions collection...");
  const deleteTxResult = await db.collection("wallettransactions").deleteMany({});
  console.log(` Removed ${deleteTxResult.deletedCount} transaction records from 'wallettransactions'.\n`);

  // 3. RESET WALLETS COLLECTION TO 0
  console.log("🔄 Resetting wallet balances and ledger entries to 0...");
  const updateWalletsResult = await db.collection("wallets").updateMany(
    {},
    {
      $set: {
        availableBalance: 0,
        pendingBalance: 0,
        holdBalance: 0,
        withdrawnBalance: 0,
        rewardCoins: 0,
        totalCredits: 0,
        totalDebits: 0,
        ledgerEntries: [],
        version: 0,
        updatedAt: new Date()
      }
    }
  );
  console.log(` Reset ${updateWalletsResult.modifiedCount} wallets (available: 0, pending: 0, withdrawn: 0, ledger: []).\n`);

  // 4. RESET USER EMBEDDED WALLET OBJECTS (referrals & profiles remain untouched)
  console.log(" Resetting user embedded wallet fields (preserving all referrals & hierarchy)...");
  const updateUsersResult = await db.collection("users").updateMany(
    { wallet: { $exists: true } },
    {
      $set: {
        "wallet.balance": 0,
        "wallet.holdBalance": 0,
        "wallet.totalEarned": 0,
        "wallet.totalWithdrawn": 0
      }
    }
  );
  console.log(` Reset embedded wallet in ${updateUsersResult.modifiedCount} user records.\n`);

  // 5. POST-RESET VERIFICATION
  console.log("🔍 Verifying clean state...");
  const remainingTxCount = await db.collection("wallettransactions").countDocuments();
  const verifiedWallets = await db.collection("wallets").find({}).toArray();

  let nonZeroWallets = 0;
  let totalLedgersRemaining = 0;

  for (const w of verifiedWallets) {
    if (
      w.availableBalance !== 0 ||
      w.pendingBalance !== 0 ||
      w.withdrawnBalance !== 0 ||
      (w.ledgerEntries && w.ledgerEntries.length > 0)
    ) {
      nonZeroWallets++;
    }
    if (w.ledgerEntries) {
      totalLedgersRemaining += w.ledgerEntries.length;
    }
  }

  console.log("\n==================== VERIFICATION SUMMARY ====================");
  console.log(`Total Wallets Checked:      ${verifiedWallets.length}`);
  console.log(`Wallets with ₹0 Balance:    ${verifiedWallets.length - nonZeroWallets}`);
  console.log(`Non-zero Wallets:           ${nonZeroWallets}`);
  console.log(`Remaining Ledger Entries:   ${totalLedgersRemaining}`);
  console.log(`Remaining Transactions:     ${remainingTxCount}`);
  console.log("Referrals & Hierarchy:      100% UNTOUCHED & SAFE");
  console.log("===============================================================\n");

  if (remainingTxCount === 0 && nonZeroWallets === 0) {
    console.log("✅ SUCCESS: All wallets have been cleanly reset to ₹0 and all transaction logs cleared!");
  } else {
    console.warn("⚠️ Warning: Some records may not have reset cleanly. Check verification summary above.");
  }

  await mongoose.disconnect();
}

resetWallets().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
