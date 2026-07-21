/**
 * cleanup_orphaned_wallets.ts
 * Removes wallets whose userId no longer has a corresponding User document.
 * These are leftovers from the 5k loadtest seed where users were deleted
 * by the old cleanup-loadtest-users.ts script that did not delete wallets.
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import { Wallet } from '../src/models/Wallet';
import { User } from '../src/models/User';

const apply = process.argv.includes('--apply');

(async () => {
  console.log(`\n=== Orphaned Wallet Cleanup (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`);
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log('Connected.\n');

  const allWallets = await Wallet.find({}, { _id: 1, userId: 1 });
  const walletUserIds = [...new Set(allWallets.map(w => w.userId.toString()))];

  const existingUsers = await User.find(
    { _id: { $in: walletUserIds } },
    { _id: 1 }
  );
  const existingSet = new Set(existingUsers.map(u => u._id.toString()));

  const orphaned = allWallets.filter(w => !existingSet.has(w.userId.toString()));

  console.log(`Total wallets in DB:       ${allWallets.length}`);
  console.log(`Wallets with valid userId: ${allWallets.length - orphaned.length}`);
  console.log(`Orphaned wallets:          ${orphaned.length}`);

  if (!apply) {
    console.log('\nDRY-RUN — pass --apply to delete.\n');
    await mongoose.disconnect();
    return;
  }

  const orphanedIds = orphaned.map(w => w._id);
  const result = await Wallet.deleteMany({ _id: { $in: orphanedIds } });
  console.log(`\n✅ Deleted ${result.deletedCount} orphaned wallets.`);

  const remaining = await Wallet.countDocuments({});
  console.log(`Remaining wallets: ${remaining}`);

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exitCode = 1; });
