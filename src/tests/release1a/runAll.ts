import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { testProductIsolation } from './productIsolation.test';
import { testOrderIsolation } from './orderIsolation.test';
import { testProfileIsolation } from './profileIsolation.test';
import { testCouponIsolation } from './couponIsolation.test';
import { testNotificationIsolation } from './notificationIsolation.test';
import { testAdminRoutes } from './adminRoutes.test';

dotenv.config();

const HOST = 'http://127.0.0.1:5500';

async function loginUser(email: string, passwordHash: string): Promise<string> {
  const res = await fetch(`${HOST}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: passwordHash })
  });
  if (!res.ok) {
    throw new Error(`Failed to login as ${email}: ${res.statusText}`);
  }
  const body = await res.json() as any;
  return body.token;
}

async function run() {
  console.log('Starting Release 1A Integration Tests...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/apexbee_test';
  await mongoose.connect(mongoUri);
  console.log('Connected to Database.');

  // Login users to acquire tokens
  console.log('Fetching auth tokens...');
  const tokens = {
    admin: await loginUser('admin@apexmarket.in', 'admin123'),
    vendorA: await loginUser('vendor_a@apexbee.in', 'Password123'),
    vendorB: await loginUser('vendor_b@apexbee.in', 'Password123'),
    customer: await loginUser('customer@apexbee.in', 'Password123')
  };
  console.log('Auth tokens fetched successfully.');

  // Fetch real User IDs from DB
  const vendorAUser = await User.findOne({ email: 'vendor_a@apexbee.in' });
  const vendorBUser = await User.findOne({ email: 'vendor_b@apexbee.in' });
  const customerUser = await User.findOne({ email: 'customer@apexbee.in' });

  if (!vendorAUser || !vendorBUser || !customerUser) {
    throw new Error('Could not find seeded test users in the database.');
  }

  const userIds = {
    vendorA: vendorAUser._id.toString(),
    vendorB: vendorBUser._id.toString(),
    customer: customerUser._id.toString()
  };

  try {
    await testProductIsolation(tokens, HOST, userIds);
    await testOrderIsolation(tokens, HOST, userIds);
    await testProfileIsolation(tokens, HOST, userIds);
    await testCouponIsolation(tokens, HOST, userIds);
    await testNotificationIsolation(tokens, HOST, userIds);
    await testAdminRoutes(tokens, HOST, userIds);

    console.log('\n=======================================');
    console.log('ALL RELEASE 1A ISOLATION TESTS PASSED!');
    console.log('=======================================');
    process.exit(0);
  } catch (err: any) {
    console.error('\n=======================================');
    console.error('RELEASE 1A ISOLATION TEST SUITE FAILED!');
    console.error(err);
    console.error('=======================================');
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

run();
