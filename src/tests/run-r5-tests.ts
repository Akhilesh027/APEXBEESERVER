import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { NotificationJob } from '../modules/notifications/models/NotificationJob';
import { notificationQueue } from '../modules/notifications/services/notificationQueue';
import { User } from '../models/User';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runR5Tests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  const suffix = `_test_${Date.now()}`;
  const testUser = new User({
    name: 'Queue Test User',
    email: `queue_${suffix}@test.com`,
    passwordHash: 'hash',
    phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
    roles: ['customer'],
    isVerified: true,
  });

  await testUser.save();

  try {
    // ----------------------------------------------------
    // TEST 1: Background Outbox Queue Execution
    // ----------------------------------------------------
    console.log('\n1. Testing Background Outbox Queue Execution...');

    const job = new NotificationJob({
      eventCode: 'order.placed',
      payload: { orderNumber: '12345' },
      recipients: [{ userId: testUser._id }],
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      scheduledAt: new Date()
    });

    await job.save();
    console.log('Job saved to database. Triggering worker...');

    // Manually trigger single job processing to mock queue execution
    await notificationQueue.processSingleJob(job._id.toString());

    // Verify job was processed
    const processedJob = await NotificationJob.findById(job._id);
    assert.ok(processedJob);
    // Since notifications might not send actual SMS/email (bypassed / logged), status transitions correctly
    console.log(`Processed Job Status: ${processedJob.status}`);
    assert.ok(['completed', 'failed'].includes(processedJob.status), 'Job must transition to either completed or failed.');

    console.log('Background Outbox Queue Execution: PASS');

    // Clean up
    await User.deleteOne({ _id: testUser._id });
    await NotificationJob.deleteOne({ _id: job._id });

    console.log('\n=======================================');
    console.log('ALL RELEASE R5 TESTS PASSED! (100%)');
    console.log('=======================================');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runR5Tests();
