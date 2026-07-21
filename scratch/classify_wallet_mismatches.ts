import mongoose from 'mongoose';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { connectDB } from './integrity_utils';
import fs from 'fs';
import path from 'path';

async function classifyMismatches() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Successfully connected. Running mismatch classification...');

    const wallets = await Wallet.find({});
    console.log(`Auditing ${wallets.length} total wallets in the database...`);

    const summary: Record<string, { count: number; walletIds: string[]; userIds: string[] }> = {
      'Missing transaction history': { count: 0, walletIds: [], userIds: [] },
      'Invalid transaction direction': { count: 0, walletIds: [], userIds: [] },
      'Missing required balance field': { count: 0, walletIds: [], userIds: [] },
      'Available-balance mismatch': { count: 0, walletIds: [], userIds: [] },
      'Pending-balance mismatch': { count: 0, walletIds: [], userIds: [] },
      'Withdrawn-balance mismatch': { count: 0, walletIds: [], userIds: [] },
      'Legacy embedded-ledger mismatch': { count: 0, walletIds: [], userIds: [] },
      'Duplicate transaction reference': { count: 0, walletIds: [], userIds: [] },
      'Transaction ordering problem': { count: 0, walletIds: [], userIds: [] },
      'Likely audit-formula false positive': { count: 0, walletIds: [], userIds: [] },
      'Confirmed wallet corruption': { count: 0, walletIds: [], userIds: [] }
    };

    const details: any[] = [];
    const batchSize = 200;

    // Process wallets in parallel batches of 200
    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(wallets.length / batchSize)}...`);

      await Promise.all(
        batch.map(async (wallet) => {
          const walletId = wallet._id.toString();
          const userId = wallet.userId.toString();

          // Check for missing balance fields
          if (
            wallet.availableBalance === undefined || wallet.availableBalance === null ||
            wallet.pendingBalance === undefined || wallet.pendingBalance === null ||
            wallet.withdrawnBalance === undefined || wallet.withdrawnBalance === null
          ) {
            summary['Missing required balance field'].count++;
            summary['Missing required balance field'].walletIds.push(walletId);
            summary['Missing required balance field'].userIds.push(userId);
            return;
          }

          // Fetch all transactions associated with this wallet
          const txs = await WalletTransaction.find({ walletId: wallet._id }).sort({ createdAt: 1 });

          // Category 1: Missing transaction history
          if (txs.length === 0) {
            if (wallet.availableBalance !== 0 || wallet.pendingBalance !== 0 || wallet.withdrawnBalance !== 0) {
              summary['Missing transaction history'].count++;
              summary['Missing transaction history'].walletIds.push(walletId);
              summary['Missing transaction history'].userIds.push(userId);

              details.push({
                walletId,
                userId,
                storedAvailable: wallet.availableBalance,
                storedPending: wallet.pendingBalance,
                storedWithdrawn: wallet.withdrawnBalance,
                computedAvailable: 0,
                computedPending: 0,
                computedWithdrawn: 0,
                diffAvailable: wallet.availableBalance,
                diffPending: wallet.pendingBalance,
                diffWithdrawn: wallet.withdrawnBalance,
                category: 'Missing transaction history',
                txCount: 0,
                firstTxDate: null,
                lastTxDate: null
              });
            }
            return;
          }

          // Run our Derived WalletEngine accounting calculations
          let computedAvailable = 0;
          let computedPending = 0;
          let computedWithdrawn = 0;
          let invalidDirectionCount = 0;

          for (const tx of txs) {
            // Track invalid direction in active accounting statuses
            if (['completed', 'pending', 'processing'].includes(tx.status)) {
              if (tx.direction !== 'credit' && tx.direction !== 'debit') {
                invalidDirectionCount++;
              }
            }

            // Available balance
            if (tx.direction === 'credit' && tx.status === 'completed') {
              computedAvailable += tx.amount;
            } else if (tx.direction === 'debit') {
              computedAvailable -= tx.amount;
            }

            // Pending balance
            if (['pending', 'processing'].includes(tx.status)) {
              computedPending += tx.amount;
            }

            // Withdrawn balance
            if (tx.type === 'withdrawal' && tx.status === 'completed') {
              computedWithdrawn += tx.amount;
            }
          }

          const diffAvailable = Math.abs(wallet.availableBalance - computedAvailable);
          const diffPending = Math.abs(wallet.pendingBalance - computedPending);
          const diffWithdrawn = Math.abs(wallet.withdrawnBalance - computedWithdrawn);

          let classified = false;

          if (invalidDirectionCount > 0) {
            summary['Invalid transaction direction'].count++;
            summary['Invalid transaction direction'].walletIds.push(walletId);
            summary['Invalid transaction direction'].userIds.push(userId);
            classified = true;
          }

          if (diffAvailable > 0.01) {
            summary['Available-balance mismatch'].count++;
            summary['Available-balance mismatch'].walletIds.push(walletId);
            summary['Available-balance mismatch'].userIds.push(userId);
            classified = true;
          }

          if (diffPending > 0.01) {
            summary['Pending-balance mismatch'].count++;
            summary['Pending-balance mismatch'].walletIds.push(walletId);
            summary['Pending-balance mismatch'].userIds.push(userId);
            classified = true;
          }

          if (diffWithdrawn > 0.01) {
            summary['Withdrawn-balance mismatch'].count++;
            summary['Withdrawn-balance mismatch'].walletIds.push(walletId);
            summary['Withdrawn-balance mismatch'].userIds.push(userId);
            classified = true;
          }

          if (classified) {
            details.push({
              walletId,
              userId,
              storedAvailable: wallet.availableBalance,
              storedPending: wallet.pendingBalance,
              storedWithdrawn: wallet.withdrawnBalance,
              computedAvailable,
              computedPending,
              computedWithdrawn,
              diffAvailable,
              diffPending,
              diffWithdrawn,
              category: 'Confirmed wallet corruption',
              txCount: txs.length,
              firstTxDate: txs[0].createdAt,
              lastTxDate: txs[txs.length - 1].createdAt
            });
          }
        })
      );
    }

    // Write reports
    const reportDir = path.join(__dirname, '..');
    fs.writeFileSync(path.join(reportDir, 'wallet_mismatch_summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(reportDir, 'wallet_mismatch_details.json'), JSON.stringify(details, null, 2));

    // CSV summary export
    let csvContent = 'Category,Count\n';
    for (const [cat, data] of Object.entries(summary)) {
      csvContent += `"${cat}",${data.count}\n`;
    }
    fs.writeFileSync(path.join(reportDir, 'wallet_mismatch_summary.csv'), csvContent);

    console.log('\n--- Classification Result Summary ---');
    for (const [cat, data] of Object.entries(summary)) {
      console.log(`- ${cat}: ${data.count}`);
    }
    console.log('\nClassification report successfully generated!');
  } catch (err) {
    console.error('Classification script error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

classifyMismatches();
