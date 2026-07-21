import mongoose from 'mongoose';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { connectDB, parseArgs, logRepair } from './integrity_utils';

async function repairOrphanTransactions() {
  const { apply, repairRunId } = parseArgs();

  if (!repairRunId) {
    console.error('❌ Error: --repair-run-id <id> is required.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Successfully connected.');

    // Find orphaned transactions
    const orphans = await WalletTransaction.aggregate([
      {
        $lookup: {
          from: 'wallets',
          localField: 'walletId',
          foreignField: '_id',
          as: 'wallet'
        }
      },
      {
        $match: {
          wallet: { $size: 0 }
        }
      }
    ]);

    console.log(`Found ${orphans.length} orphaned transactions...`);

    let relinkedCount = 0;
    let quarantinedCount = 0;
    let unresolvedCount = 0;

    for (const rawOrphan of orphans) {
      // Re-fetch full Mongoose document to be able to modify/save/remove
      const tx = await WalletTransaction.findById(rawOrphan._id);
      if (!tx) continue;

      const userId = tx.userId;
      if (!userId) {
        unresolvedCount++;
        console.log(`⚠️ Transaction ${tx._id} has no userId. Unresolved.`);
        continue;
      }

      // Check if user has exactly one wallet
      const wallets = await Wallet.find({ userId });

      if (wallets.length === 1) {
        const wallet = wallets[0];
        console.log(`Found matching wallet ${wallet._id} for user ${userId}. Relinking transaction ${tx._id}...`);

        if (apply) {
          const session = await mongoose.startSession();
          session.startTransaction();

          try {
            const previousState = tx.toObject();
            tx.walletId = wallet._id;
            await tx.save({ session });

            // Log repair
            await logRepair({
              repairRunId,
              collection: 'wallettransactions',
              documentId: tx._id,
              previousValue: previousState,
              newValue: tx.toObject(),
              repairReason: `Relinked orphaned transaction to matching user wallet ${wallet._id}`,
              timestamp: new Date()
            });

            await session.commitTransaction();
            relinkedCount++;
          } catch (err) {
            await session.abortTransaction();
            console.error(`❌ Failed to relink transaction ${tx._id}:`, err);
            throw err;
          } finally {
            session.endSession();
          }
        } else {
          relinkedCount++;
        }
      } else {
        // Quarantine transaction
        console.log(`Quarantining orphaned transaction ${tx._id} (User ${userId} has ${wallets.length} wallets)...`);

        if (apply) {
          const session = await mongoose.startSession();
          session.startTransaction();

          try {
            const db = mongoose.connection.db;
            if (!db) throw new Error('Database connection not established');

            // Insert to quarantine
            await db.collection('wallettransaction_quarantine').insertOne({
              originalTransactionId: tx._id,
              originalWalletId: tx.walletId,
              userId: tx.userId,
              repairRunId,
              quarantineReason: `Orphaned transaction with no matching or unique wallet for user ${userId} (${wallets.length} wallets found)`,
              originalTransactionData: tx.toObject(),
              timestamp: new Date()
            }, { session });

            // Remove from active transactions
            await tx.deleteOne({ session });

            // Log repair
            await logRepair({
              repairRunId,
              collection: 'wallettransactions',
              documentId: tx._id,
              previousValue: tx.toObject(),
              newValue: null,
              repairReason: `Quarantined orphaned transaction to wallettransaction_quarantine collection`,
              timestamp: new Date()
            });

            await session.commitTransaction();
            quarantinedCount++;
          } catch (err) {
            await session.abortTransaction();
            console.error(`❌ Failed to quarantine transaction ${tx._id}:`, err);
            throw err;
          } finally {
            session.endSession();
          }
        } else {
          quarantinedCount++;
        }
      }
    }

    console.log('\n--- Orphan Records Action Summary ---');
    console.log(`- Relinked to wallets: ${relinkedCount}`);
    console.log(`- Quarantined: ${quarantinedCount}`);
    console.log(`- Unresolved (skipped): ${unresolvedCount}`);
    console.log('------------------------------------');

  } catch (err) {
    console.error('Orphan transactions repair script error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

repairOrphanTransactions();
