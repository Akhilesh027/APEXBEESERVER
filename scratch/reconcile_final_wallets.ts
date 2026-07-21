/**
 * reconcile_final_wallets.ts
 *
 * Final wallet reconciliation script. Uses the evidence file produced by
 * export_manual_wallet_review.ts to repair wallet balances and create
 * missing historical WalletTransaction records.
 *
 * Usage:
 *   npx tsx .\scratch\reconcile_final_wallets.ts \
 *     --evidence-file .\scratch\manual_wallet_review_resolved.json \
 *     --repair-run-id wallet_final_reconciliation_2026_07_18
 *
 *   npx tsx .\scratch\reconcile_final_wallets.ts --apply \
 *     --evidence-file .\scratch\manual_wallet_review_resolved.json \
 *     --repair-run-id wallet_final_reconciliation_2026_07_18
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';
import fs from 'fs';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { User } from '../src/models/User';
import { connectDB, createIntegrityBackups, logRepair } from './integrity_utils';

interface EvidenceSource {
  type: string;
  id: string;
  amount: number;
  direction: 'credit' | 'debit';
  status: string;
  category?: string;
  referenceType?: string;
  referenceId?: string;
  remarks?: string;
  date?: string;
}

interface ResolvedWallet {
  walletId: string;
  userId: string;
  category: string;
  categoryReason: string;
  currentBalances: {
    availableBalance: number;
    pendingBalance: number;
    withdrawnBalance: number;
  };
  expectedBalances: {
    availableBalance: number;
    pendingBalance: number;
    withdrawnBalance: number;
  };
  replayedBalances: {
    availableBalance: number;
    pendingBalance: number;
    withdrawnBalance: number;
  };
  evidenceSources: EvidenceSource[];
  action: 'REPAIR' | 'FREEZE';
}

function generateTxNumber(): string {
  return `TXN_RECON_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
}

async function reconcile() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  const evidenceIdx = args.indexOf('--evidence-file');
  const evidenceFile = evidenceIdx >= 0 ? args[evidenceIdx + 1] : null;

  const runIdIdx = args.indexOf('--repair-run-id');
  const repairRunId = runIdIdx >= 0 ? args[runIdIdx + 1] : null;

  if (!evidenceFile) {
    console.error('❌ --evidence-file <path> is required.');
    process.exitCode = 1;
    return;
  }
  if (!repairRunId) {
    console.error('❌ --repair-run-id <id> is required.');
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(evidenceFile)) {
    console.error(`❌ Evidence file not found: ${evidenceFile}`);
    process.exitCode = 1;
    return;
  }

  const resolved: ResolvedWallet[] = JSON.parse(fs.readFileSync(evidenceFile, 'utf-8'));
  console.log(`\n=== Wallet Final Reconciliation (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`Evidence file: ${evidenceFile}`);
  console.log(`Repair run ID: ${repairRunId}`);
  console.log(`Wallets to process: ${resolved.length}\n`);

  await connectDB();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (apply) {
    console.log('Creating safety backups...');
    // Atlas snapshot is mock simulated via copying collections to dynamic backup tables
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    // Wallets backup
    const wallets = await db.collection('wallets').find({}).toArray();
    const walletsBackupName = `wallets_final_reconciliation_backup_${timestamp}`;
    if (wallets.length > 0) {
      await db.collection(walletsBackupName).insertMany(wallets);
      console.log(`✅ Backed up ${wallets.length} wallets to ${walletsBackupName}`);
    }

    // WalletTransactions backup
    const txs = await db.collection('wallettransactions').find({}).toArray();
    const txsBackupName = `wallettransactions_final_reconciliation_backup_${timestamp}`;
    if (txs.length > 0) {
      await db.collection(txsBackupName).insertMany(txs);
      console.log(`✅ Backed up ${txs.length} transactions to ${txsBackupName}`);
    }

    // Orders backup
    const orders = await db.collection('orders').find({}).toArray();
    const ordersBackupName = `orders_final_reconciliation_backup_${timestamp}`;
    if (orders.length > 0) {
      await db.collection(ordersBackupName).insertMany(orders);
      console.log(`✅ Backed up ${orders.length} orders to ${ordersBackupName}`);
    }

    // Payments backup
    const payments = await db.collection('paymentattempts').find({}).toArray();
    const paymentsBackupName = `payments_final_reconciliation_backup_${timestamp}`;
    if (payments.length > 0) {
      await db.collection(paymentsBackupName).insertMany(payments);
      console.log(`✅ Backed up ${payments.length} payment attempts to ${paymentsBackupName}`);
    }

    // Withdrawals backup (Withdrawals are embedded ledger entries inside wallets collection, so wallets backup covers it)
    // We create a blank copy or copy from wallets since there is no separate withdrawals collection
    const withdrawalsBackupName = `withdrawals_final_reconciliation_backup_${timestamp}`;
    const withdrawals = wallets.filter(w => w.ledgerEntries && w.ledgerEntries.some((e: any) => e.referenceType === 'WITHDRAWAL'));
    if (withdrawals.length > 0) {
      await db.collection(withdrawalsBackupName).insertMany(withdrawals);
      console.log(`✅ Backed up ${withdrawals.length} wallets containing withdrawals to ${withdrawalsBackupName}`);
    } else {
      // Insert a placeholder to prevent empty collection creation errors or keep it empty
      await db.collection(withdrawalsBackupName).insertOne({ placeholder: true });
      console.log(`✅ Created placeholder withdrawals backup collection ${withdrawalsBackupName}`);
    }
    console.log();
  }

  let repairedCount = 0;
  let frozenCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const entry of resolved) {
    const { walletId, userId, category, action } = entry;
    console.log(`--- Processing wallet ${walletId.slice(-8)} (${category}, action=${action}) ---`);

    if (action === 'FREEZE') {
      console.log(`  FROZEN — no authoritative evidence. Skipping.`);
      frozenCount++;
      continue;
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      console.error(`  ❌ Wallet ${walletId} not found in database!`);
      failedCount++;
      continue;
    }

    let targetAvail = 0;
    let targetPending = 0;
    let targetWithdrawn = 0;
    let txsToCreate: any[] = [];

    if (category === 'A_DETERMINISTIC') {
      targetAvail = wallet.availableBalance;
      targetPending = entry.expectedBalances.pendingBalance;
      targetWithdrawn = wallet.withdrawnBalance;

      // Only create pending transactions for pending evidence sources if they don't already exist
      const pendingSources = entry.evidenceSources.filter(src => src.status === 'pending');
      for (const src of pendingSources) {
        txsToCreate.push({
          walletId: new mongoose.Types.ObjectId(walletId),
          userId: new mongoose.Types.ObjectId(userId),
          transactionNumber: generateTxNumber(),
          amount: src.amount,
          type: mapSourceToTxType(src),
          direction: 'credit' as const,
          status: 'pending' as const,
          referenceId: src.referenceId || src.id,
          referenceModel: mapSourceToRefModel(src),
          notes: `Pending wallet hold migration (${repairRunId}): ${src.type} ${src.id}`,
          createdAt: src.date ? new Date(src.date) : new Date(),
          isReconciliationEntry: true,
          repairRunId
        });
      }
    } else if (category === 'B_OPENING_BALANCE_MIGRATION' || category === 'C_MISSING_RECORD') {
      const creditSources = entry.evidenceSources.filter(e => e.direction === 'credit');
      const debitSources = entry.evidenceSources.filter(e => e.direction === 'debit');

      let computedAvail = 0;
      let computedPending = 0;
      let computedWithdrawn = 0;

      for (const src of creditSources) {
        const isPending = ['pending', 'processing'].includes(src.status);
        if (!isPending) {
          computedAvail += src.amount;
        } else {
          computedPending += src.amount;
        }
        txsToCreate.push({
          walletId: new mongoose.Types.ObjectId(walletId),
          userId: new mongoose.Types.ObjectId(userId),
          transactionNumber: generateTxNumber(),
          amount: src.amount,
          type: mapSourceToTxType(src),
          direction: 'credit' as const,
          status: isPending ? ('pending' as const) : ('completed' as const),
          referenceId: src.referenceId || src.id,
          referenceModel: mapSourceToRefModel(src),
          notes: `Historical wallet migration (${repairRunId}): ${src.type} ${src.id}`,
          createdAt: src.date ? new Date(src.date) : new Date(),
          isReconciliationEntry: true,
          repairRunId
        });
      }

      for (const src of debitSources) {
        computedAvail -= src.amount;
        const isPending = ['pending', 'processing'].includes(src.status);
        if (isPending) {
          computedPending += src.amount;
        }
        if (src.type === 'withdrawal' || mapSourceToTxType(src) === 'withdrawal') {
          computedWithdrawn += src.amount;
        }
        txsToCreate.push({
          walletId: new mongoose.Types.ObjectId(walletId),
          userId: new mongoose.Types.ObjectId(userId),
          transactionNumber: generateTxNumber(),
          amount: src.amount,
          type: mapSourceToTxType(src),
          direction: 'debit' as const,
          status: isPending ? ('pending' as const) : ('completed' as const),
          referenceId: src.referenceId || src.id,
          referenceModel: mapSourceToRefModel(src),
          notes: `Historical wallet migration (${repairRunId}): ${src.type} ${src.id}`,
          createdAt: src.date ? new Date(src.date) : new Date(),
          isReconciliationEntry: true,
          repairRunId
        });
      }

      if (txsToCreate.length === 0 && entry.evidenceSources.length === 0) {
        console.log(`  ⚠️ No evidence sources. Treating as unresolvable.`);
        frozenCount++;
        continue;
      }
    } else {
      console.log(`  ⚠️ Unknown category ${category}. Skipping.`);
      skippedCount++;
      continue;
    }

    // Chronologically rebuild targets by replaying existing transactions plus filtered new entries
    const existingTxs = await WalletTransaction.find({ walletId: wallet._id });
    const filteredTxs = txsToCreate.filter(txToCreate => {
      return !existingTxs.some((dbTx: any) => {
        if (dbTx.referenceId && txToCreate.referenceId && dbTx.referenceId.toString() === txToCreate.referenceId.toString()) {
          return true;
        }
        if (dbTx.transactionNumber === txToCreate.transactionNumber) {
          return true;
        }
        if (txToCreate.type === 'adjustment' && dbTx.type === 'adjustment' &&
            Math.abs(dbTx.amount - txToCreate.amount) < 0.01 &&
            dbTx.direction === txToCreate.direction &&
            new Date(dbTx.createdAt).toDateString() === new Date(txToCreate.createdAt).toDateString()) {
          return true;
        }
        return false;
      });
    });

    const mergedTxs = [...existingTxs, ...filteredTxs];
    let replayAvail = 0;
    let replayPending = 0;
    let replayWithdrawn = 0;

    for (const tx of mergedTxs) {
      if (tx.direction === 'credit' && tx.status === 'completed') {
        replayAvail += tx.amount;
      } else if (tx.direction === 'debit') {
        if (tx.status !== 'reversed' && tx.status !== 'failed') {
          replayAvail -= tx.amount;
        }
      }
      if (['pending', 'processing'].includes(tx.status)) {
        replayPending += tx.amount;
      }
      if (tx.type === 'withdrawal' && tx.status === 'completed') {
        replayWithdrawn += tx.amount;
      }
    }

    targetAvail = Number(replayAvail.toFixed(2));
    targetPending = Number(replayPending.toFixed(2));
    targetWithdrawn = Number(replayWithdrawn.toFixed(2));

    if (targetAvail < -0.01 || targetPending < -0.01 || targetWithdrawn < -0.01) {
      console.log(`  ❌ Target balances are negative (avail=${targetAvail}, pend=${targetPending}, wdrn=${targetWithdrawn}). ABORT for this wallet.`);
      failedCount++;
      continue;
    }

    targetAvail = Math.max(0, Number(targetAvail.toFixed(2)));
    targetPending = Math.max(0, Number(targetPending.toFixed(2)));
    targetWithdrawn = Math.max(0, Number(targetWithdrawn.toFixed(2)));

    console.log(`  Current:  avail=${wallet.availableBalance}, pend=${wallet.pendingBalance}, wdrn=${wallet.withdrawnBalance}`);
    console.log(`  Target:   avail=${targetAvail}, pend=${targetPending}, wdrn=${targetWithdrawn}`);
    console.log(`  Txs to create: ${txsToCreate.length}`);

    if (wallet.availableBalance === targetAvail &&
        wallet.pendingBalance === targetPending &&
        wallet.withdrawnBalance === targetWithdrawn &&
        txsToCreate.length === 0) {
      console.log(`  Already at target. Skipping.`);
      skippedCount++;
      continue;
    }

    if (!apply) {
      console.log(`  [DRY-RUN] Would update balances and create ${txsToCreate.length} transactions.`);
      repairedCount++;
      continue;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const previousState = {
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        withdrawnBalance: wallet.withdrawnBalance,
        totalCredits: wallet.totalCredits,
        totalDebits: wallet.totalDebits,
        version: wallet.version,
      };

      let filteredTxs = txsToCreate;
      if (txsToCreate.length > 0) {
        const existingTxs = await WalletTransaction.find({ walletId: wallet._id }).session(session);
        filteredTxs = txsToCreate.filter(txToCreate => {
          return !existingTxs.some((dbTx: any) => {
            if (dbTx.referenceId && txToCreate.referenceId && dbTx.referenceId.toString() === txToCreate.referenceId.toString()) {
              return true;
            }
            if (dbTx.transactionNumber === txToCreate.transactionNumber) {
              return true;
            }
            if (txToCreate.type === 'adjustment' && dbTx.type === 'adjustment' &&
                Math.abs(dbTx.amount - txToCreate.amount) < 0.01 &&
                dbTx.direction === txToCreate.direction &&
                new Date(dbTx.createdAt).toDateString() === new Date(txToCreate.createdAt).toDateString()) {
              return true;
            }
            return false;
          });
        });

        if (filteredTxs.length > 0) {
          await WalletTransaction.insertMany(filteredTxs, { session });
        }
      }

      wallet.availableBalance = targetAvail;
      wallet.pendingBalance = targetPending;
      wallet.withdrawnBalance = targetWithdrawn;

      const allTxs = await WalletTransaction.find({ walletId: wallet._id }).session(session);
      let newTotalCredits = 0;
      let newTotalDebits = 0;
      for (const tx of allTxs) {
        if (tx.direction === 'credit' && tx.status === 'completed') newTotalCredits += tx.amount;
        if (tx.direction === 'debit') newTotalDebits += tx.amount;
      }
      wallet.totalCredits = Number(newTotalCredits.toFixed(2));
      wallet.totalDebits = Number(newTotalDebits.toFixed(2));
      wallet.version = (wallet.version || 0) + 1;

      // Populate balanceBefore/balanceAfter on the newly created reconciliation transactions
      if (filteredTxs.length > 0) {
        // Find them back in DB to get their IDs
        const createdTxsInDb = await WalletTransaction.find({
          walletId: wallet._id,
          repairRunId,
          isReconciliationEntry: true
        }).session(session);

        let tempAvail = previousState.availableBalance;
        let tempPending = previousState.pendingBalance;
        let tempWithdrawn = previousState.withdrawnBalance;

        for (const dbTx of createdTxsInDb) {
          dbTx.balanceBefore = tempAvail;
          dbTx.pendingBalanceBefore = tempPending;
          dbTx.withdrawnBalanceBefore = tempWithdrawn;

          if (dbTx.direction === 'credit' && dbTx.status === 'completed') {
            tempAvail += dbTx.amount;
          } else if (dbTx.direction === 'debit') {
            tempAvail -= dbTx.amount;
          }
          if (['pending', 'processing'].includes(dbTx.status)) {
            tempPending += dbTx.amount;
          }
          if (dbTx.type === 'withdrawal' && dbTx.status === 'completed') {
            tempWithdrawn += dbTx.amount;
          }

          dbTx.balanceAfter = Number(tempAvail.toFixed(2));
          dbTx.pendingBalanceAfter = Number(tempPending.toFixed(2));
          dbTx.withdrawnBalanceAfter = Number(tempWithdrawn.toFixed(2));

          await dbTx.save({ session });
        }
      }

      await wallet.save({ session });

      // Keep legacy User nested fields synchronized in DB
      await User.findByIdAndUpdate(userId, {
        $set: {
          "wallet.balance": targetAvail,
          "wallet.holdBalance": targetPending,
          "wallet.totalWithdrawn": targetWithdrawn,
          "wallet.totalEarned": Number((targetAvail + targetWithdrawn).toFixed(2))
        }
      }).session(session);

      const verifyWallet = await Wallet.findById(walletId).session(session);
      if (!verifyWallet ||
          verifyWallet.availableBalance < -0.01 ||
          verifyWallet.pendingBalance < -0.01 ||
          verifyWallet.withdrawnBalance < -0.01) {
        throw new Error(`Post-repair verification failed for wallet ${walletId}. Rolling back.`);
      }

      await logRepair({
        repairRunId,
        collection: 'wallets',
        documentId: wallet._id,
        previousValue: previousState,
        newValue: {
          availableBalance: verifyWallet.availableBalance,
          pendingBalance: verifyWallet.pendingBalance,
          withdrawnBalance: verifyWallet.withdrawnBalance,
          totalCredits: verifyWallet.totalCredits,
          totalDebits: verifyWallet.totalDebits,
          version: verifyWallet.version,
        },
        repairReason: `Final reconciliation: ${category} — ${entry.categoryReason}`,
        sourceTransactions: filteredTxs.map(t => t.transactionNumber),
        timestamp: new Date(),
      });

      await session.commitTransaction();
      repairedCount++;
      console.log(`  ✅ Repaired successfully.`);
    } catch (err: any) {
      await session.abortTransaction();
      console.error(`  ❌ Repair failed:`, err.message);
      failedCount++;
    } finally {
      session.endSession();
    }
  }

  console.log('\n=== Reconciliation Summary ===');
  console.log(`Repaired:  ${repairedCount}`);
  console.log(`Frozen:    ${frozenCount}`);
  console.log(`Skipped:   ${skippedCount}`);
  console.log(`Failed:    ${failedCount}`);
  console.log('==============================\n');

  if (failedCount > 0) {
    process.exitCode = 1;
  }

  await mongoose.disconnect().catch(() => undefined);
}

function mapSourceToTxType(src: EvidenceSource): string {
  const t = (src.type || '').toLowerCase();
  const cat = (src.category || '').toLowerCase();
  if (t.includes('commission') || t.includes('settlement')) return 'commission';
  if (t.includes('referral')) return 'commission';
  if (t.includes('refund')) return 'refund';
  if (t.includes('withdrawal') || cat.includes('withdrawal')) return 'withdrawal';
  if (cat.includes('subscription')) return 'subscription_credit';
  if (cat.includes('reversal') || (src.referenceType || '').includes('REVERSAL')) return 'reversal';
  if (cat.includes('payment') || (src.referenceType || '').includes('ORDER')) return 'payment';
  return 'adjustment';
}

function mapSourceToRefModel(src: EvidenceSource): string {
  const t = (src.type || '').toLowerCase();
  if (t.includes('commission') || t.includes('settlement')) return 'CommissionSettlement';
  if (t.includes('referral')) return 'ReferralTransaction';
  if (t.includes('refund')) return 'Refund';
  if (t.includes('ledger')) return 'LegacyLedgerEntry';
  return 'Order';
}

reconcile().catch(err => {
  console.error('Reconciliation error:', err);
  process.exitCode = 1;
});
