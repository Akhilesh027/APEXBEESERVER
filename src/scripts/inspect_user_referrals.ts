import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { User } from '../models/User';
import { Referral } from '../models/Referral';
import { ReferralTransaction } from '../models/ReferralTransaction';
import { CommissionSettlement } from '../models/CommissionSettlement';
import { Wallet } from '../models/Wallet';

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to DB');

    // Find users with referrals or transactions
    const txs = await ReferralTransaction.find().lean();
    console.log('Total ReferralTransaction count:', txs.length);
    if (txs.length > 0) {
      console.log('Sample ReferralTransactions:');
      txs.slice(0, 10).forEach(t => {
        console.log({
          id: t._id,
          recipientUserId: t.recipientUserId,
          referredUserId: t.referredUserId,
          amount: t.amount,
          level: t.level,
          transactionType: t.transactionType,
          rewardReason: t.rewardReason,
          status: t.status
        });
      });
    }

    const comms = await CommissionSettlement.find().lean();
    console.log('Total CommissionSettlement count:', comms.length);
    if (comms.length > 0) {
      console.log('Sample CommissionSettlements:');
      comms.slice(0, 10).forEach(c => {
        console.log({
          id: c._id,
          recipientId: c.recipientId,
          amount: c.amount,
          settlementType: c.settlementType,
          status: c.status,
          notes: c.notes
        });
      });
    }

    const users = await User.find({
      $or: [
        { "referralHierarchy.level1UserId": { $ne: null } },
        { referredBy: { $ne: null } }
      ]
    }).select('name email phone referralCode referredBy referralHierarchy').lean();
    console.log('Users with referrer count:', users.length);
    users.slice(0, 10).forEach(u => console.log(u));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
