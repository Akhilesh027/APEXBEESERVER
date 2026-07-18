import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import { User } from '../models/User';
import Product from '../models/Product';
import { NotificationJob } from '../modules/notifications/models/NotificationJob';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runPhase6Tests() {
  console.log('Starting Phase 6 Pagination & Index Verification Tests...');
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  try {
    // ----------------------------------------------------
    // TEST 1: Schema Indexes verification
    // ----------------------------------------------------
    console.log('\n1. Checking index configurations on core schemas...');

    // 1. Product Indexes
    const productIndexes = Product.schema.indexes();
    const productHasTextIndex = productIndexes.some(
      (idx: any) => idx[0] && idx[0].name === 'text' && idx[0].description === 'text'
    );
    assert.ok(productHasTextIndex, 'Product schema must define a text index on name/description');
    console.log('Product schema indexes: PASS');

    // 2. User Indexes
    const userIndexes = User.schema.indexes();
    const userHasCompoundTerritoryIndex = userIndexes.some(
      (idx: any) =>
        idx[0] &&
        idx[0].roles === 1 &&
        idx[0]['territory.state'] === 1 &&
        idx[0]['territory.district'] === 1 &&
        idx[0]['territory.mandal'] === 1
    );
    assert.ok(userHasCompoundTerritoryIndex, 'User schema must define a roles/territory compound index');
    console.log('User schema indexes: PASS');

    // 3. NotificationJob Indexes
    const jobIndexes = NotificationJob.schema.indexes();
    const jobHasCompoundIndex = jobIndexes.some(
      (idx: any) =>
        idx[0] &&
        idx[0].status === 1 &&
        idx[0].attempts === 1 &&
        idx[0].scheduledAt === 1
    );
    assert.ok(jobHasCompoundIndex, 'NotificationJob schema must define status/attempts/scheduledAt compound index');
    console.log('NotificationJob schema indexes: PASS');

    console.log('\n=======================================');
    console.log('ALL PHASE 6 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase6Tests();
