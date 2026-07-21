import mongoose from 'mongoose';
import Product from '../src/models/Product';
import { Order } from '../src/models/Order';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { User } from '../src/models/User';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envFile = process.env.NODE_ENV === 'staging' || fs.existsSync(path.join(__dirname, '../.env.staging'))
  ? '../.env.staging'
  : '../.env';
dotenv.config({ path: path.join(__dirname, envFile) });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is missing.');
  process.exit(1);
}

/**
 * DATABASE INTEGRITY ASSUMPTIONS:
 * 1. Initial starting balance of every wallet is assumed to be 0 (default: 0).
 * 2. Every balance modification must record a completed Ledger/Transaction record.
 * 3. Starting promotional or system credits must be recorded as a completed transaction.
 * 4. This script should be run during a maintenance window or against a database snapshot
 *    to prevent concurrent transaction writes from causing false mismatches.
 * 5. Monetary values should preferably be stored as integer minor units (paise) in production
 *    to prevent floating-point reconciliation anomalies.
 * 6. We have derived from WalletEngine.ts that:
 *    - every debit transaction subtracts from availableBalance.
 *    - completed credit transactions add to availableBalance.
 *    - pending/processing transactions (both credits and debits) add to pendingBalance.
 *    - completed withdrawals add to withdrawnBalance.
 */
async function verifyDatabaseIntegrity() {
  let failedChecks = 0;

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connection successful! Running integrity checks...');

    // 1. Check for negative stock levels using countDocuments()
    const negativeStockCount = await Product.countDocuments({ stock: { $lt: 0 } });
    if (negativeStockCount > 0) {
      console.error(`❌ Found ${negativeStockCount} products with negative stock!`);
      failedChecks++;
    } else {
      console.log('✅ No negative stock');
    }

    // 2. Check for negative balances and verify Wallet invariants using countDocuments()
    // Invariants: availableBalance >= 0, pendingBalance >= 0, withdrawnBalance >= 0
    const invalidWalletCount = await Wallet.countDocuments({
      $or: [
        { availableBalance: { $lt: 0 } },
        { pendingBalance: { $lt: 0 } },
        { withdrawnBalance: { $lt: 0 } }
      ]
    });
    if (invalidWalletCount > 0) {
      console.error(`❌ Found ${invalidWalletCount} wallets violating non-negative balance invariants!`);
      failedChecks++;
    } else {
      console.log('✅ Wallet invariants passed');
    }

    // 3. Verify Wallet Ledger integrity: Sum transactions inside the $lookup pipeline
    // Sums available, pending, and lifetime withdrawn amounts on the database side
    const ledgerMismatches = await Wallet.aggregate([
      {
        $lookup: {
          from: 'wallettransactions',
          let: { walletId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ['$walletId', '$$walletId']
                }
              }
            },
            {
              $group: {
                _id: null,
                computedAvailable: {
                  $sum: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              { $eq: ['$direction', 'credit'] },
                              { $eq: ['$status', 'completed'] }
                            ]
                          },
                          then: '$amount'
                        },
                        {
                          case: { $eq: ['$direction', 'debit'] },
                          then: { $multiply: ['$amount', -1] }
                        }
                      ],
                      default: 0
                    }
                  }
                },
                computedPending: {
                  $sum: {
                    $cond: [
                      { $in: ['$status', ['pending', 'processing']] },
                      '$amount',
                      0
                    ]
                  }
                },
                computedWithdrawn: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$type', 'withdrawal'] },
                          { $eq: ['$status', 'completed'] }
                        ]
                      },
                      '$amount',
                      0
                    ]
                  }
                },
                invalidDirectionCount: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $in: ['$status', ['completed', 'pending', 'processing']] },
                          { $not: { $in: ['$direction', ['credit', 'debit']] } }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          as: 'ledgerSummary'
        }
      },
      {
        $set: {
          ledgerSummary: {
            $ifNull: [
              { $arrayElemAt: ['$ledgerSummary', 0] },
              {
                computedAvailable: 0,
                computedPending: 0,
                computedWithdrawn: 0,
                invalidDirectionCount: 0
              }
            ]
          }
        }
      },
      {
        $project: {
          userId: 1,
          availableBalance: 1,
          pendingBalance: 1,
          withdrawnBalance: 1,
          computedAvailable: '$ledgerSummary.computedAvailable',
          computedPending: '$ledgerSummary.computedPending',
          computedWithdrawn: '$ledgerSummary.computedWithdrawn',
          invalidDirectionCount: '$ledgerSummary.invalidDirectionCount',
          availableDifference: {
            $abs: {
              $subtract: [
                { $ifNull: ['$availableBalance', 0] },
                { $ifNull: ['$ledgerSummary.computedAvailable', 0] }
              ]
            }
          },
          pendingDifference: {
            $abs: {
              $subtract: [
                { $ifNull: ['$pendingBalance', 0] },
                { $ifNull: ['$ledgerSummary.computedPending', 0] }
              ]
            }
          },
          withdrawnDifference: {
            $abs: {
              $subtract: [
                { $ifNull: ['$withdrawnBalance', 0] },
                { $ifNull: ['$ledgerSummary.computedWithdrawn', 0] }
              ]
            }
          }
        }
      },
      {
        $match: {
          $or: [
            { availableDifference: { $gt: 0.01 } },
            { pendingDifference: { $gt: 0.01 } },
            { withdrawnDifference: { $gt: 0.01 } },
            { invalidDirectionCount: { $gt: 0 } },
            { availableBalance: { $eq: null } },
            { pendingBalance: { $eq: null } },
            { withdrawnBalance: { $eq: null } }
          ]
        }
      }
    ]);

    if (ledgerMismatches.length > 0) {
      console.error(`❌ Found ${ledgerMismatches.length} wallet ledger mismatches or missing fields!`);
      failedChecks++;
    } else {
      console.log('✅ Wallet ledger reconciliation passed');
    }

    // 4. Check for Orphaned Wallet Transactions
    const orphanTransactions = await WalletTransaction.aggregate([
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
      },
      {
        $count: 'count'
      }
    ]);

    const orphanCount = orphanTransactions[0]?.count || 0;
    if (orphanCount > 0) {
      console.error(`❌ Found ${orphanCount} orphaned wallet transaction logs referencing nonexistent wallets!`);
      failedChecks++;
    } else {
      console.log('✅ No orphaned transactions found');
    }

    // 4b. Verify Settlement shadow holds (User.wallet.holdBalance vs Wallet.pendingBalance)
    const divergentHolds = await User.aggregate([
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'userId',
          as: 'walletDoc'
        }
      },
      {
        $set: {
          walletDoc: { $arrayElemAt: ['$walletDoc', 0] }
        }
      },
      {
        $project: {
          email: 1,
          holdBalance: { $ifNull: ['$wallet.holdBalance', 0] },
          pendingBalance: { $ifNull: ['$walletDoc.pendingBalance', 0] },
          difference: {
            $abs: {
              $subtract: [
                { $ifNull: ['$wallet.holdBalance', 0] },
                { $ifNull: ['$walletDoc.pendingBalance', 0] }
              ]
            }
          }
        }
      },
      {
        $match: {
          difference: { $gt: 0.01 }
        }
      }
    ]);

    if (divergentHolds.length > 0) {
      console.error(`❌ Found ${divergentHolds.length} users with divergent shadow holds (User.wallet.holdBalance !== Wallet.pendingBalance)!`);
      failedChecks++;
    } else {
      console.log('✅ Settlement hold synchronization verified');
    }

    // 5. Blank idempotency keys must fail the audit (not just be ignored)
    const blankIdempotencyKeyCount = await Order.countDocuments({
      checkoutIdempotencyKey: {
        $type: 'string',
        $regex: /^\s*$/
      }
    });

    if (blankIdempotencyKeyCount > 0) {
      console.error(`❌ Found ${blankIdempotencyKeyCount} orders with blank or whitespace-only idempotency keys.`);
      failedChecks++;
    } else {
      console.log('✅ No blank idempotency keys');
    }

    // 6. Orders with checkoutIdempotencyKey but missing customerId must fail the audit
    const keyedOrdersWithoutCustomer = await Order.countDocuments({
      checkoutIdempotencyKey: {
        $type: 'string',
        $ne: ''
      },
      $or: [
        { customerId: null },
        { customerId: { $exists: false } }
      ]
    });

    if (keyedOrdersWithoutCustomer > 0) {
      console.error(`❌ Found ${keyedOrdersWithoutCustomer} keyed orders with missing customerId.`);
      failedChecks++;
    } else {
      console.log('✅ All keyed orders have customerId');
    }

    // 7. Verify unique checkout idempotency keys per customer using compound aggregation (grouped by trimmed key)
    const duplicateCheckouts = await Order.aggregate([
      {
        $match: {
          checkoutIdempotencyKey: {
            $type: 'string',
            $nin: ['', null],
            $not: /^\s*$/
          }
        }
      },
      {
        $set: {
          normalizedIdempotencyKey: {
            $trim: {
              input: '$checkoutIdempotencyKey'
            }
          }
        }
      },
      {
        $group: {
          _id: {
            customerId: '$customerId',
            checkoutIdempotencyKey: '$normalizedIdempotencyKey'
          },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]);

    if (duplicateCheckouts.length > 0) {
      console.error(`❌ Found ${duplicateCheckouts.length} duplicate checkout idempotency keys!`);
      failedChecks++;
    } else {
      console.log('✅ No duplicate checkout keys');
    }

    // 8. Inspect database indexes and verify the compound unique constraint with partialFilterExpression
    const orderIndexes = await Order.collection.indexes();
    const verifiedCompoundIndex = orderIndexes.some(idx => {
      if (!idx.unique || !idx.key) return false;
      const keys = Object.keys(idx.key);
      const hasCorrectKeys = keys.length === 2 &&
                             keys[0] === 'customerId' && idx.key.customerId === 1 &&
                             keys[1] === 'checkoutIdempotencyKey' && idx.key.checkoutIdempotencyKey === 1;
      
      const hasPartialFilter = idx.partialFilterExpression &&
                               idx.partialFilterExpression.checkoutIdempotencyKey &&
                               idx.partialFilterExpression.checkoutIdempotencyKey.$type === 'string';

      return hasCorrectKeys && hasPartialFilter;
    });

    if (!verifiedCompoundIndex) {
      console.error('❌ Required unique compound checkout idempotency index { customerId: 1, checkoutIdempotencyKey: 1 } with partialFilterExpression is missing.');
      failedChecks++;
    } else {
      console.log('✅ Required compound unique index verified');
    }

    if (failedChecks > 0) {
      console.error(`\n❌ INTEGRITY AUDIT FAILED: ${failedChecks} configured checks failed.`);
      process.exitCode = 1;
    } else {
      console.log('All configured database integrity checks passed.');
      process.exitCode = 0;
    }
  } catch (error) {
    console.error('Integrity verify error:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => undefined);
  }
}

verifyDatabaseIntegrity();
