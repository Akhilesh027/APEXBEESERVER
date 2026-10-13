const mongoose = require("mongoose");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

async function runRestore() {
  const backupFileArg = process.argv[2];
  const backupDir = path.join(__dirname, "backups");

  let targetFile = backupFileArg;

  if (!targetFile) {
    if (!fs.existsSync(backupDir)) {
      console.error("❌ No backups directory found.");
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) {
      console.error("❌ No backup JSON files found in backend/backups/");
      process.exit(1);
    }
    // Pick the most recent backup
    files.sort();
    targetFile = path.join(backupDir, files[files.length - 1]);
    console.log(`ℹ️ No specific file passed. Using latest backup:\n   ${targetFile}\n`);
  } else if (!path.isAbsolute(targetFile)) {
    targetFile = path.join(__dirname, targetFile);
  }

  if (!fs.existsSync(targetFile)) {
    console.error(`❌ Backup file not found: ${targetFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(targetFile, "utf-8");
  const data = JSON.parse(raw);

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ Error: MONGODB_URI not found in backend/.env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log(" Connected to MongoDB successfully!\n");

  const db = mongoose.connection.db;

  console.log(`Restoring from backup created at: ${data.metadata?.generatedAt || "unknown"}`);

  // Restore wallets
  if (Array.isArray(data.wallets) && data.wallets.length > 0) {
    console.log(`Restoring ${data.wallets.length} wallets...`);
    for (const w of data.wallets) {
      const { _id, ...rest } = w;
      await db.collection("wallets").replaceOne(
        { _id: new mongoose.Types.ObjectId(_id) },
        { ...rest, _id: new mongoose.Types.ObjectId(_id) },
        { upsert: true }
      );
    }
    console.log(" Wallets restored.");
  }

  // Restore wallet transactions
  if (Array.isArray(data.walletTransactions) && data.walletTransactions.length > 0) {
    console.log(`Restoring ${data.walletTransactions.length} wallet transactions...`);
    await db.collection("wallettransactions").deleteMany({});
    const docs = data.walletTransactions.map((tx) => ({
      ...tx,
      _id: new mongoose.Types.ObjectId(tx._id),
      walletId: tx.walletId ? new mongoose.Types.ObjectId(tx.walletId) : undefined,
      userId: tx.userId ? new mongoose.Types.ObjectId(tx.userId) : undefined,
    }));
    await db.collection("wallettransactions").insertMany(docs);
    console.log(" Wallet transactions restored.");
  }

  // Restore user embedded wallets
  if (Array.isArray(data.usersWithWallets) && data.usersWithWallets.length > 0) {
    console.log(`Restoring user embedded wallet data for ${data.usersWithWallets.length} users...`);
    for (const u of data.usersWithWallets) {
      if (u.wallet) {
        await db.collection("users").updateOne(
          { _id: new mongoose.Types.ObjectId(u._id) },
          { $set: { wallet: u.wallet } }
        );
      }
    }
    console.log(" User embedded wallet data restored.");
  }

  console.log("\n✅ RESTORE COMPLETE! All wallet balances and transactions are back to the backed up state.");
  await mongoose.disconnect();
}

runRestore().catch((err) => {
  console.error("❌ Restore failed:", err);
  process.exit(1);
});
