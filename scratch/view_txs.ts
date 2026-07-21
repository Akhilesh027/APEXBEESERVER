import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { WalletTransaction } from '../src/models/WalletTransaction';
import { Wallet } from '../src/models/Wallet';
import { User } from '../src/models/User';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');

  console.log('\n--- USER 1 TXS ---');
  const txs1 = await WalletTransaction.find({ userId: '6a4773fffe6b8d23e56b692a' });
  console.log(txs1.map(t => ({
    _id: t._id,
    amount: t.amount,
    direction: t.direction,
    status: t.status,
    type: t.type,
    notes: t.notes,
    createdAt: t.createdAt
  })));

  console.log('\n--- GSK TXS ---');
  const txsGSK = await WalletTransaction.find({ userId: '6a487770fe6b8d23e5b9e790' });
  console.log(txsGSK.map(t => ({
    _id: t._id,
    amount: t.amount,
    direction: t.direction,
    status: t.status,
    type: t.type,
    notes: t.notes,
    createdAt: t.createdAt
  })));

  console.log('\n--- DIVERGENT SHADOW HOLDS ---');
  const divergent = await User.aggregate([
    {
      $lookup: {
        from: 'wallets',
        localField: '_id',
        foreignField: 'userId',
        as: 'walletDoc'
      }
    },
    { $set: { walletDoc: { $arrayElemAt: ['$walletDoc', 0] } } },
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
    { $match: { difference: { $gt: 0.01 } } }
  ]);
  console.log(divergent);

  await mongoose.disconnect();
}

main().catch(console.error);
