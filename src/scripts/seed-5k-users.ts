import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function seed5kUsers() {
  console.log('Starting 5,000 Users Database Seeding Script...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  const BATCH_SIZE = 500;
  const TOTAL_USERS = 5000;

  try {
    console.log('Generating default password hash (this will take a moment)...');
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log('Password hash generated.');

    console.log('Clearing any existing load-test user data...');
    const deleteUsersResult = await User.deleteMany({ email: /@loadtest\.com$/ });
    console.log(`Deleted ${deleteUsersResult.deletedCount} existing load-test users.`);

    let usersBatch: any[] = [];
    let walletsBatch: any[] = [];
    let insertedCount = 0;

    for (let i = 1; i <= TOTAL_USERS; i++) {
      const userId = new mongoose.Types.ObjectId();
      const email = `student_${i}@loadtest.com`;

      usersBatch.push({
        _id: userId,
        name: `LoadTest Student ${i}`,
        email,
        passwordHash,
        phone: `9${String(i).padStart(9, '0')}`.slice(0, 10),
        roles: ['customer'],
        isVerified: true,
        status: 'active',
      });

      walletsBatch.push({
        userId,
        availableBalance: 1000, // Seed ₹1,000 default balance for checkouts
        pendingBalance: 0,
        withdrawnBalance: 0,
        version: 0,
      });

      if (usersBatch.length === BATCH_SIZE || i === TOTAL_USERS) {
        console.log(`Inserting batch of ${usersBatch.length} users (Progress: ${i}/${TOTAL_USERS})...`);
        
        await User.insertMany(usersBatch);
        await Wallet.insertMany(walletsBatch);

        insertedCount += usersBatch.length;
        usersBatch = [];
        walletsBatch = [];
      }
    }

    console.log(`\n=======================================`);
    console.log(`SUCCESSFULLY SEEDED ${insertedCount} USERS & WALLETS!`);
    console.log(`=======================================`);
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ DATABASE SEEDING ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

seed5kUsers();
