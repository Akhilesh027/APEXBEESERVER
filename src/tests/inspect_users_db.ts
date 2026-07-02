import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Address } from '../models/Address';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB');

  const users = await User.find();
  console.log(`\n--- ALL USERS (${users.length}) ---`);
  for (const u of users) {
    console.log(`User ID: ${u._id}, name: ${u.name}, email: ${u.email}, roles: ${u.roles}, phone: ${u.phone}`);
  }

  const addrs = await Address.find();
  console.log(`\n--- ALL ADDRESSES (${addrs.length}) ---`);
  for (const a of addrs) {
    console.log(`Address ID: ${a._id}, userId: ${a.userId}, address: ${a.address}, city: ${a.city}`);
  }

  await mongoose.disconnect();
}

run();
