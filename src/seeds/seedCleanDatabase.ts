import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedCoreTaxonomies } from './seedCoreTaxonomies';
import { seedThreeTierSubscriptionSystem } from './seedThreeTierSubscriptionSystem';
import { seedSubscriptionData } from './seedSubscriptionData';
import { removeSeededProducts } from '../scripts/removeSeededProducts';

dotenv.config();

export const seedCleanDatabase = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoURI);
      console.log('[seedCleanDatabase] Connected to MongoDB.');
    }

    console.log('\n======================================================');
    console.log('🚀 SEEDING CLEAN APEXBEE DATABASE (NO MOCK PRODUCTS)');
    console.log('======================================================\n');

    // 1. Seed Core Category Taxonomies (Restaurant, Grocery, Devotional, Services, Academy, Shopping)
    console.log('📦 Step 1: Seeding Category Taxonomies & Schemas...');
    await seedCoreTaxonomies({ dryRun: false });

    // 2. Seed 3-Tier Subscription Profiles & Entitlements
    console.log('\n💳 Step 2: Seeding 3-Tier Vendor Subscription Profiles & Entitlements...');
    await seedThreeTierSubscriptionSystem();
    await seedSubscriptionData();

    // 3. Purge any stray seeded products
    console.log('\n🧹 Step 3: Purging dummy/seeded products...');
    await removeSeededProducts();

    console.log('\n======================================================');
    console.log('✅ CLEAN DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('   - Essential Categories & Taxonomies Ready');
    console.log('   - 3-Tier Subscription System Active');
    console.log('   - Zero Dummy Products in Database');
    console.log('======================================================\n');

    return { success: true };
  } catch (err: any) {
    console.error('[seedCleanDatabase Error]:', err);
    return { success: false, error: err.message };
  }
};

const runCLI = async () => {
  if (require.main === module) {
    const result = await seedCleanDatabase();
    process.exit(result.success ? 0 : 1);
  }
};

runCLI();
