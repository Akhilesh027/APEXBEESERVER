import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function cleanup() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected. Removing seeded load-test users...');

  const userResult = await User.deleteMany({ email: /@loadtest\.com$/ });
  console.log(`Deleted ${userResult.deletedCount} load-test users.`);

  console.log('Done.');
  process.exit(0);
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
