const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

async function inspectBonus() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI missing");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;

  console.log("=== INSPECTING REFERRAL TRANSACTIONS, REFERRALS & WALLETS ===");

  const refTxCount = await db.collection("referraltransactions").countDocuments();
  console.log(`1. Total documents in 'referraltransactions': ${refTxCount}`);

  const refTxs = await db.collection("referraltransactions").find({}).toArray();
  let refTxTotal = 0;
  refTxs.forEach((t, i) => {
    refTxTotal += (t.amount || 0);
    console.log(`   [${i + 1}] Type: ${t.transactionType || t.type}, Amount: ₹${t.amount}, Status: ${t.status}, Recipient: ${t.recipientUserId}`);
  });
  console.log(`   Total referraltransactions amount: ₹${refTxTotal}`);

  const referralsCount = await db.collection("referrals").countDocuments();
  console.log(`\n2. Total documents in 'referrals': ${referralsCount}`);
  const referrals = await db.collection("referrals").find({}).toArray();
  let referralsRewardSum = 0;
  referrals.forEach((r, i) => {
    const rw = r.rewardAmount || r.reward || 0;
    referralsRewardSum += rw;
    console.log(`   [${i + 1}] Referrer: ${r.referrerUserId || r.referrerId}, Referred: ${r.referredUserId}, Status: ${r.status}, rewardAmount: ₹${r.rewardAmount}, reward: ₹${r.reward}`);
  });
  console.log(`   Total rewardAmount in referrals collection: ₹${referralsRewardSum}`);

  const walletTxCount = await db.collection("wallettransactions").countDocuments();
  console.log(`\n3. Total documents in 'wallettransactions': ${walletTxCount}`);

  const commSettlementsCount = await db.collection("commissionsettlements").countDocuments();
  console.log(`\n4. Total documents in 'commissionsettlements': ${commSettlementsCount}`);

  const wallets = await db.collection("wallets").find({
    $or: [
      { availableBalance: { $gt: 0 } },
      { pendingBalance: { $gt: 0 } },
      { holdBalance: { $gt: 0 } },
      { withdrawnBalance: { $gt: 0 } },
    ]
  }).toArray();
  console.log(`\n5. Wallets with non-zero balance: ${wallets.length}`);
  wallets.forEach(w => {
    console.log(`   User: ${w.userId}, Avail: ₹${w.availableBalance}, Pending: ₹${w.pendingBalance}, Hold: ₹${w.holdBalance}, Ledger entries: ${w.ledgerEntries?.length || 0}`);
  });

  await mongoose.disconnect();
}

inspectBonus().catch(err => {
  console.error("Error inspecting:", err);
  process.exit(1);
});
