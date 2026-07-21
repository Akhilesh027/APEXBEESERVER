import mongoose from 'mongoose';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { connectDB, parseArgs, createIntegrityBackups, logRepair } from './integrity_utils';

async function repairWalletBalances() {
  const { apply, repairRunId } = parseArgs();

  if (!repairRunId) {
    console.error('❌ Error: --repair-run-id <id> is required.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Successfully connected.');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create safety backups before any modification if in apply mode
    if (apply) {
      console.log('Creating safety backups of collections...');
      const backups = await createIntegrityBackups(timestamp);
      console.log(`Backup collections created successfully:`, backups);
    } else {
      console.log('ℹ️ Running in DRY-RUN mode. No changes will be saved.');
    }

    const wallets = await Wallet.find({});
    console.log(`Auditing and repairing ${wallets.length} wallets...`);

    let repairedCount = 0;
    let skippedCount = 0;
    let manualReviewCount = 0;

    for (const wallet of wallets) {
      const walletId = wallet._id.toString();
      const userId = wallet.userId.toString();

      // Fetch transaction history
      const txs = await WalletTransaction.find({ walletId: wallet._id }).sort({ createdAt: 1 });

      if (txs.length === 0) {
        if (wallet.availableBalance !== 0 || wallet.pendingBalance !== 0 || wallet.withdrawnBalance !== 0) {
          // Incomplete transaction history -> Manual review required
          console.log(`⚠️ Wallet ${walletId} (User ${userId}) has balances but NO transaction history. Flagged for manual review.`);
          manualReviewCount++;
        }
        continue;
      }

      // Replay chronological transaction history
      let computedAvailable = 0;
      let computedPending = 0;
      let computedWithdrawn = 0;
      let negativePeakDetected = false;

      for (const tx of txs) {
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

        if (computedAvailable < 0 || computedPending < 0 || computedWithdrawn < 0) {
          negativePeakDetected = true;
        }
      }

      const hasBalanceMismatch =
        Math.abs(wallet.availableBalance - computedAvailable) > 0.01 ||
        Math.abs(wallet.pendingBalance - computedPending) > 0.01 ||
        Math.abs(wallet.withdrawnBalance - computedWithdrawn) > 0.01;

      if (!hasBalanceMismatch) {
        skippedCount++;
        continue;
      }

      // Safeguard: Do not automatically resolve if replayed balances are negative
      if (computedAvailable < 0 || computedPending < 0 || computedWithdrawn < 0 || negativePeakDetected) {
        console.log(`⚠️ Wallet ${walletId} (User ${userId}) results in negative balance or experienced negative peak during replay. Flagged for manual review.`);
        manualReviewCount++;
        continue;
      }

      console.log(`[MISMATCH FOUND] Wallet ${walletId} (User ${userId}):`);
      console.log(`  Stored:  Available=${wallet.availableBalance}, Pending=${wallet.pendingBalance}, Withdrawn=${wallet.withdrawnBalance}`);
      console.log(`  Replayed: Available=${computedAvailable}, Pending=${computedPending}, Withdrawn=${computedWithdrawn}`);

      if (apply) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Backup current state for log
          const previousState = wallet.toObject();

          // Update balances
          wallet.availableBalance = Number(computedAvailable.toFixed(2));
          wallet.pendingBalance = Number(computedPending.toFixed(2));
          wallet.withdrawnBalance = Number(computedWithdrawn.toFixed(2));
          wallet.version = (wallet.version || 0) + 1;

          await wallet.save({ session });

          // Log repair
          await logRepair({
            repairRunId,
            collection: 'wallets',
            documentId: wallet._id,
            previousValue: previousState,
            newValue: wallet.toObject(),
            repairReason: 'Reconciled wallet balances chronologically from WalletTransaction logs',
            sourceTransactions: txs.map(t => t._id),
            timestamp: new Date()
          });

          await session.commitTransaction();
          repairedCount++;
          console.log(`✅ Wallet ${walletId} successfully repaired.`);
        } catch (txErr) {
          await session.abortTransaction();
          console.error(`❌ Failed to repair wallet ${walletId}:`, txErr);
          throw txErr;
        } finally {
          session.endSession();
        }
      } else {
        repairedCount++; // Count as potential repair in dry-run
      }
    }

    console.log('\n--- Repair Result Summary ---');
    console.log(`- Potential/Actual repairs completed: ${repairedCount}`);
    console.log(`- Wallets matched (no change needed): ${skippedCount}`);
    console.log(`- Flagged for manual financial review: ${manualReviewCount}`);
    console.log('------------------------------');

  } catch (err) {
    console.error('Repair balances script error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

repairWalletBalances();
