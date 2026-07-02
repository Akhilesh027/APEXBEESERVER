import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Referral } from '../models/Referral';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function inspectReferrals() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    console.log('User model registered:', User.modelName);
    console.log('Wallet model registered:', Wallet.modelName);

    const refs = await Referral.find()
      .populate('referrerUserId', 'name email referralCode')
      .populate('referredUserId', 'name email roles');

    console.log('\n--- Referrals in DB ---');
    for (const r of refs) {
      console.log(`Referrer: ${(r.referrerUserId as any)?.name} (${(r.referrerUserId as any)?.email})`);
      console.log(`Referred: ${(r.referredUserId as any)?.name} (${(r.referredUserId as any)?.email}, roles: ${(r.referredUserId as any)?.roles})`);
      console.log(`Status: ${r.status}, Reward: ${r.rewardAmount}, Type: ${r.referralType}`);
      
      const wallet = await Wallet.findOne({ userId: r.referrerUserId._id });
      console.log(`Referrer Wallet Available Balance: ${wallet ? wallet.availableBalance : 'N/A'}`);
      console.log('-----------------------');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectReferrals();
