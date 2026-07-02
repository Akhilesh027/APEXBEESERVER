import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to DB:', MONGO_URI);

  const tasks = await SubscriptionDeliveryTask.find();
  console.log(`\n--- ALL SUBSCRIPTION DELIVERY TASKS (${tasks.length}) ---`);
  for (const t of tasks) {
    console.log(`Task ID: ${t._id}`);
    console.log(`  subscriptionId: ${t.subscriptionId}`);
    console.log(`  date: ${t.date}`);
    console.log(`  status: ${t.status}`);
    console.log(`  isPaidToVendor: ${t.isPaidToVendor}`);
    console.log(`  isDebitedFromUser: ${t.isDebitedFromUser}`);
    console.log(`  otpVerified: ${t.otpVerified}`);
    console.log(`  riderId: ${t.riderId}`);
  }

  await mongoose.disconnect();
}

run();
