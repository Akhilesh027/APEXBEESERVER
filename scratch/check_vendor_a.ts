import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

import { CommissionSettlement } from '../src/models/CommissionSettlement';
import { ReferralTransaction } from '../src/models/ReferralTransaction';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  const cs = await CommissionSettlement.find({ recipientId: '6a547149708737bdfb03427d' });
  const rt = await ReferralTransaction.find({ recipientUserId: '6a547149708737bdfb03427d' });
  console.log('CS COUNT:', cs.length, 'RT COUNT:', rt.length);
  console.log('CS DETAILS:', cs.map(c => ({ amount: c.amount, status: c.status })));
  console.log('RT DETAILS:', rt.map(r => ({ amount: r.amount, status: r.status })));
  await mongoose.disconnect();
}

main().catch(console.error);
