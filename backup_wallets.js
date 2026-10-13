const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

async function runBackup() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ Error: MONGODB_URI not found in backend/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB successfully!\n");

  const db = mongoose.connection.db;

  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const backupFilePath = path.join(backupDir, `wallet_full_backup_${timestamp}.json`);

  console.log("📥 Extracting complete wallet and financial data...");

  const wallets = await db.collection("wallets").find({}).toArray();
  const walletTransactions = await db.collection("wallettransactions").find({}).toArray();
  const usersWithWallets = await db.collection("users").find({ wallet: { $exists: true } }, {
    projection: { _id: 1, name: 1, email: 1, phone: 1, roles: 1, wallet: 1, referralCode: 1 }
  }).toArray();
  const referralTransactions = await db.collection("referraltransactions").find({}).toArray();
  const commissionSettlements = await db.collection("commissionsettlements").find({}).toArray();

  const backupPayload = {
    metadata: {
      generatedAt: now.toISOString(),
      databaseName: db.databaseName,
      totalWallets: wallets.length,
      totalWalletTransactions: walletTransactions.length,
      totalUsersWithWallets: usersWithWallets.length,
      totalReferralTransactions: referralTransactions.length,
      totalCommissionSettlements: commissionSettlements.length
    },
    wallets,
    walletTransactions,
    usersWithWallets,
    referralTransactions,
    commissionSettlements
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2));

  const stats = fs.statSync(backupFilePath);
  const sizeKb = (stats.size / 1024).toFixed(2);

  console.log("\n==================== BACKUP CREATED SUCCESSFULLY ====================");
  console.log(`📁 File Path:                 ${backupFilePath}`);
  console.log(`📦 File Size:                 ${sizeKb} KB`);
  console.log(`💳 Wallets Backed Up:         ${wallets.length}`);
  console.log(`📝 Wallet Transactions:       ${walletTransactions.length}`);
  console.log(`👤 Users with Wallets:        ${usersWithWallets.length}`);
  console.log(`🤝 Referral Transactions:     ${referralTransactions.length}`);
  console.log(`📊 Commission Settlements:    ${commissionSettlements.length}`);
  console.log("=====================================================================\n");
  console.log("✅ Backup is complete and safe to store. You can now run wallet reset whenever ready.");

  await mongoose.disconnect();
}

runBackup().catch((err) => {
  console.error("❌ Backup failed:", err);
  process.exit(1);
});
