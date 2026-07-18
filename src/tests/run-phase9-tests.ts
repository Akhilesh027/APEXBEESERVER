import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { ConfigService } from '../services/ConfigService';
import SystemConfig from '../models/SystemConfig';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runPhase9Tests() {
  console.log('Starting Phase 9 Metrics & Feature Flag Verification Tests...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  try {
    // 1. Clear existing test config
    await SystemConfig.deleteMany({ key: /^TEST_FLAG/ });

    // 2. Set feature flag
    console.log('1. Testing setting feature flags...');
    await ConfigService.setFlag('TEST_FLAG_A', true);

    const dbRecord = await SystemConfig.findOne({ key: 'TEST_FLAG_A' });
    assert.ok(dbRecord, 'Flag must be persisted in SystemConfig');
    assert.strictEqual(dbRecord.value, true, 'Persisted flag value must be true');
    console.log('Flag persistence: PASS');

    // 3. Get feature flag (uncached)
    console.log('2. Testing getting feature flags...');
    const flagVal = await ConfigService.getFlag('TEST_FLAG_A');
    assert.strictEqual(flagVal, true, 'ConfigService.getFlag must return true');
    console.log('Flag retrieval: PASS');

    // 4. Test cache TTL
    console.log('3. Testing cache invalidation & updates...');
    // Directly update value in database (bypassing ConfigService to verify caching)
    await SystemConfig.updateOne({ key: 'TEST_FLAG_A' }, { $set: { value: false } });

    const cachedVal = await ConfigService.getFlag('TEST_FLAG_A');
    assert.strictEqual(cachedVal, true, 'ConfigService must return cached true value immediately after DB update');
    console.log('Cache retention: PASS');

    // Update via ConfigService (which invalidates cache)
    await ConfigService.setFlag('TEST_FLAG_A', false);
    const updatedVal = await ConfigService.getFlag('TEST_FLAG_A');
    assert.strictEqual(updatedVal, false, 'ConfigService must return updated false value after cache invalidation');
    console.log('Cache invalidation: PASS');

    console.log('\n=======================================');
    console.log('ALL PHASE 9 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase9Tests();
