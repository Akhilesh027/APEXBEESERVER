/**
 * cleanup_seed_data.ts
 *
 * Removes ALL data seeded by:
 *   - seed-5k-users.ts       → 5,000 @loadtest.com users + their wallets
 *   - seed-demo-data.ts      → 500   @demotest.com  users + their wallets + DEMO- orders
 *
 * Safe guards:
 *   - Operates only on documents identifiable by seed markers (email regex, orderNumber prefix)
 *   - Prints counts before and after deletion
 *   - Dry-run by default; pass --apply to write changes
 *   - Never touches real production users or orders
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import { User } from '../src/models/User';
import { Wallet } from '../src/models/Wallet';
import { Order } from '../src/models/Order';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
const apply = process.argv.includes('--apply');

async function cleanup() {
  console.log(`\n=== ApexBee Seed Data Cleanup (${apply ? 'APPLY MODE' : 'DRY-RUN MODE'}) ===\n`);

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.\n');

  // ── Identify loadtest users ──────────────────────────────────────────────
  const loadtestUsers = await User.find({ email: /@loadtest\.com$/ }, { _id: 1 });
  const loadtestUserIds = loadtestUsers.map(u => u._id);
  console.log(`Load-test users  (@loadtest.com):  ${loadtestUserIds.length}`);

  const loadtestWallets = await Wallet.countDocuments({ userId: { $in: loadtestUserIds } });
  console.log(`Load-test wallets (by userId):      ${loadtestWallets}`);

  // ── Identify demo users ──────────────────────────────────────────────────
  const demoUsers = await User.find({ email: /@demotest\.com$/ }, { _id: 1 });
  const demoUserIds = demoUsers.map(u => u._id);
  console.log(`Demo users       (@demotest.com):   ${demoUserIds.length}`);

  const demoWallets = await Wallet.countDocuments({ userId: { $in: demoUserIds } });
  console.log(`Demo wallets     (by userId):        ${demoWallets}`);

  const demoOrders = await Order.countDocuments({ orderNumber: /^DEMO-/ });
  console.log(`Demo orders      (orderNumber DEMO-): ${demoOrders}`);

  // ── Orphaned wallets with no user (catch any previous partial-cleanup artifacts)
  const allSeedWallets = await Wallet.find({ userId: { $in: [...loadtestUserIds, ...demoUserIds] } }, { _id: 1 });
  const allSeedWalletCount = allSeedWallets.length;

  console.log(`\nTotal seeded wallets to remove: ${allSeedWalletCount}`);
  console.log(`Total seeded users   to remove: ${loadtestUserIds.length + demoUserIds.length}`);
  console.log(`Total seeded orders  to remove: ${demoOrders}`);

  if (!apply) {
    console.log('\n⚠️  DRY-RUN: No data was deleted. Pass --apply to execute the cleanup.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nProceeding with deletion...\n');

  // ── Delete orders first (no cascade risk) ───────────────────────────────
  const orderResult = await Order.deleteMany({ orderNumber: /^DEMO-/ });
  console.log(`✅ Deleted ${orderResult.deletedCount} demo orders.`);

  // ── Delete wallets (both loadtest + demo) ────────────────────────────────
  const allSeedUserIds = [...loadtestUserIds, ...demoUserIds];
  const walletResult = await Wallet.deleteMany({ userId: { $in: allSeedUserIds } });
  console.log(`✅ Deleted ${walletResult.deletedCount} seeded wallets.`);

  // ── Delete users ─────────────────────────────────────────────────────────
  const loadtestUserResult = await User.deleteMany({ email: /@loadtest\.com$/ });
  console.log(`✅ Deleted ${loadtestUserResult.deletedCount} load-test users.`);

  const demoUserResult = await User.deleteMany({ email: /@demotest\.com$/ });
  console.log(`✅ Deleted ${demoUserResult.deletedCount} demo users.`);

  // ── Verification ─────────────────────────────────────────────────────────
  console.log('\n--- Verification ---');
  const remainingLoadtest = await User.countDocuments({ email: /@loadtest\.com$/ });
  const remainingDemo     = await User.countDocuments({ email: /@demotest\.com$/ });
  const remainingOrders   = await Order.countDocuments({ orderNumber: /^DEMO-/ });
  const remainingWallets  = await Wallet.countDocuments({ userId: { $in: allSeedUserIds } });

  console.log(`Remaining @loadtest.com users:  ${remainingLoadtest}`);
  console.log(`Remaining @demotest.com  users:  ${remainingDemo}`);
  console.log(`Remaining DEMO- orders:          ${remainingOrders}`);
  console.log(`Remaining seeded wallets:        ${remainingWallets}`);

  if (remainingLoadtest + remainingDemo + remainingOrders + remainingWallets === 0) {
    console.log('\n✅ All seed data successfully removed.');
  } else {
    console.error('\n❌ Some records remain — manual investigation required.');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

cleanup().catch(err => {
  console.error('Cleanup script error:', err);
  mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
