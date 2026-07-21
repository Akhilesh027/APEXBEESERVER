import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

const backupTimestamp = '2026-07-18T06-47-47-060Z';

async function restore() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected.');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No DB connection');

  const collectionsToRestore = [
    { target: 'wallets', backup: `wallets_final_reconciliation_backup_${backupTimestamp}` },
    { target: 'wallettransactions', backup: `wallettransactions_final_reconciliation_backup_${backupTimestamp}` },
    { target: 'orders', backup: `orders_final_reconciliation_backup_${backupTimestamp}` },
    { target: 'paymentattempts', backup: `payments_final_reconciliation_backup_${backupTimestamp}` }
  ];

  for (const item of collectionsToRestore) {
    const backupExists = await db.listCollections({ name: item.backup }).hasNext();
    if (!backupExists) {
      console.log(`⚠️ Backup collection not found: ${item.backup}. Skipping.`);
      continue;
    }

    console.log(`Restoring ${item.target} from ${item.backup}...`);
    // Drop target
    try {
      await db.collection(item.target).drop();
      console.log(`  Dropped existing ${item.target} collection.`);
    } catch (e: any) {
      console.log(`  Target collection ${item.target} could not be dropped (might not exist).`);
    }

    // Copy from backup
    const docs = await db.collection(item.backup).find({}).toArray();
    if (docs.length > 0) {
      await db.collection(item.target).insertMany(docs);
      console.log(`  Restored ${docs.length} documents to ${item.target}.`);
    } else {
      console.log(`  Backup collection ${item.backup} was empty.`);
    }
  }

  // Restore the shadow holdBalance / balance in User collection
  console.log('Restoring User wallet holdBalance/balance fields from original wallets...');
  const walletsDocs = await db.collection('wallets').find({}).toArray();
  for (const w of walletsDocs) {
    await db.collection('users').updateOne(
      { _id: w.userId },
      {
        $set: {
          'wallet.balance': w.availableBalance,
          'wallet.holdBalance': w.pendingBalance,
          'wallet.totalWithdrawn': w.withdrawnBalance,
          'wallet.totalEarned': Number((w.availableBalance + w.withdrawnBalance).toFixed(2))
        }
      }
    );
  }
  console.log('User nested fields restored.');

  console.log('✅ Restore complete!');
  await mongoose.disconnect();
}

restore().catch(console.error);
