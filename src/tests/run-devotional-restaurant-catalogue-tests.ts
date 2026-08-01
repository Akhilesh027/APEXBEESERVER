import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import Vendor from '../models/Vendor';
import User from '../models/User';
import { seedDevotionalAndRestaurant, verifyCatalogueCore } from '../seeds/seedDevotionalAndRestaurant';
import { resolveCategorySchema, validatePayloadAgainstSchema } from '../services/devotional/schemaResolutionService';

dotenv.config();

let passedCount = 0;
let failedCount = 0;

const assert = (condition: boolean, message: string) => {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedCount++;
  }
};

export const runDevotionalRestaurantCatalogueTests = async () => {
  console.log('=====================================================================');
  console.log('[Test Suite] Devotional + Restaurant Catalogue & Schema Verification');
  console.log('=====================================================================');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB for testing.');

  // 1. Run Initial Seed
  console.log('\n--- Test 1: Core Seeding Execution ---');
  const seedResult1 = await seedDevotionalAndRestaurant();
  assert(seedResult1.passed, 'First seed execution completed without errors');

  // 2. Count Verification
  console.log('\n--- Test 2: Final Category & Schema Target Counts ---');
  assert(seedResult1.devotional.parents === 1, `Devotional Parent count = 1 (actual: ${seedResult1.devotional.parents})`);
  assert(seedResult1.devotional.subcategories === 11, `Devotional Subcategories = 11 (actual: ${seedResult1.devotional.subcategories})`);
  assert(seedResult1.devotional.childCategories === 190, `Devotional Child Categories = 190 (actual: ${seedResult1.devotional.childCategories})`);
  assert(seedResult1.devotional.schemas === 201, `Devotional Schemas = 201 (actual: ${seedResult1.devotional.schemas})`);

  assert(seedResult1.restaurant.parents === 1, `Restaurant Parent count = 1 (actual: ${seedResult1.restaurant.parents})`);
  assert(seedResult1.restaurant.subcategories === 11, `Restaurant Subcategories = 11 (actual: ${seedResult1.restaurant.subcategories})`);
  assert(seedResult1.restaurant.childCategories === 116, `Restaurant Child Categories = 116 (actual: ${seedResult1.restaurant.childCategories})`);
  assert(seedResult1.restaurant.schemas === 127, `Restaurant Schemas = 127 (actual: ${seedResult1.restaurant.schemas})`);

  assert(seedResult1.combined.parents === 2, `Combined Parent Categories = 2 (actual: ${seedResult1.combined.parents})`);
  assert(seedResult1.combined.subcategories === 22, `Combined Subcategories = 22 (actual: ${seedResult1.combined.subcategories})`);
  assert(seedResult1.combined.childCategories === 306, `Combined Child Categories = 306 (actual: ${seedResult1.combined.childCategories})`);
  assert(seedResult1.combined.schemas === 328, `Combined Schemas = 328 (actual: ${seedResult1.combined.schemas})`);

  // 3. Quality Assurance (Slugs & Orphans)
  console.log('\n--- Test 3: Quality Assurance Verification ---');
  assert(seedResult1.duplicateSlugsCount === 0, `0 Duplicate Slugs found (actual: ${seedResult1.duplicateSlugsCount})`);
  assert(seedResult1.orphanCategoriesCount === 0, `0 Orphan Categories found (actual: ${seedResult1.orphanCategoriesCount})`);

  // 4. Idempotency Check
  console.log('\n--- Test 4: Idempotency Verification ---');
  const devotionalParentBefore = await Category.findOne({ slug: 'devotional' });
  const restaurantParentBefore = await Category.findOne({ slug: 'restaurant' });

  const seedResult2 = await seedDevotionalAndRestaurant();
  assert(seedResult2.passed, 'Second seed execution completed successfully');

  const devotionalParentAfter = await Category.findOne({ slug: 'devotional' });
  const restaurantParentAfter = await Category.findOne({ slug: 'restaurant' });

  assert(
    devotionalParentBefore?._id.toString() === devotionalParentAfter?._id.toString(),
    'Devotional Parent ID preserved across re-runs'
  );
  assert(
    restaurantParentBefore?._id.toString() === restaurantParentAfter?._id.toString(),
    'Restaurant Parent ID preserved across re-runs'
  );
  assert(seedResult1.combined.schemas === seedResult2.combined.schemas, 'Schema counts identical across consecutive re-runs');

  // 5. Schema Resolution Tests
  console.log('\n--- Test 5: Dynamic Schema Resolution ---');

  const testCategorySlugs = [
    { slug: 'devotional-pooja-essentials-agarbatti', expectedMode: 'standard' },
    { slug: 'devotional-flowers-garlands-jasmine', expectedMode: 'fresh' },
    { slug: 'devotional-idols-frames-spiritual-decor-custom-photo-frames', expectedMode: 'customizable' },
    { slug: 'devotional-temple-priest-devotional-services-pandit-booking', expectedMode: 'not_applicable' },
    { slug: 'restaurant-restaurants-and-dining-full-service-restaurant', expectedMode: 'food' },
    { slug: 'restaurant-tiffin-and-breakfast-outlets-tiffin-center', expectedMode: 'food' },
    { slug: 'restaurant-street-food-and-mobile-vendors-food-truck', expectedMode: 'food' },
    { slug: 'restaurant-cafes-and-beverage-outlets-juice-shop', expectedMode: 'food' },
    { slug: 'restaurant-bakery-sweets-and-desserts-custom-cake-studio', expectedMode: 'food' },
    { slug: 'restaurant-catering-and-bulk-food-services-wedding-catering', expectedMode: 'made_to_order' },
    { slug: 'restaurant-meal-plans-and-subscriptions-monthly-meal-plan', expectedMode: 'subscription' },
    { slug: 'restaurant-restaurant-raw-materials-vegetables', expectedMode: 'wholesale' },
    { slug: 'restaurant-restaurant-supplies-packaging-materials', expectedMode: 'wholesale' },
  ];

  for (const item of testCategorySlugs) {
    const cat = await Category.findOne({ slug: item.slug });
    if (!cat) {
      assert(false, `Category found for slug '${item.slug}'`);
      continue;
    }
    const resolved = await resolveCategorySchema(cat._id.toString()).catch(() => null);
    assert(resolved !== null, `Schema resolved successfully for category '${cat.name}'`);
    if (resolved) {
      assert(resolved.productMode === item.expectedMode, `Category '${cat.name}' productMode matches '${item.expectedMode}' (got '${resolved.productMode}')`);
    }
  }

  // 6. Schema Payload Validation Unit Tests
  console.log('\n--- Test 6: Schema Payload Validation Unit Tests ---');
  const tiffinCat = await Category.findOne({ slug: 'restaurant-tiffin-and-breakfast-outlets-tiffin-center' });
  if (tiffinCat) {
    const schema = await resolveCategorySchema(tiffinCat._id.toString());

    // Valid Payload
    const validPayload = {
      breakfast_type: 'Dosa',
      food_type: 'veg',
      pieces_per_plate: 2,
      chutney_included: true,
      sambar_included: true,
      available_from: '07:00 AM',
      available_until: '11:00 AM',
    };
    const validRes = validatePayloadAgainstSchema(validPayload, schema);
    assert(validRes.isValid, 'Valid Tiffin payload passed validation');

    // Invalid Payload (missing required & invalid option)
    const invalidPayload = {
      breakfast_type: 'Pizza', // Invalid option for breakfast_type
      food_type: 'veg',
    };
    const invalidRes = validatePayloadAgainstSchema(invalidPayload, schema);
    assert(!invalidRes.isValid, 'Invalid Tiffin payload correctly failed validation (422 sample)');
    assert(invalidRes.errors.length > 0, `Validation produced error messages: ${invalidRes.errors[0]}`);
  }

  console.log('=====================================================================');
  console.log(`[Test Suite Completed] Total Passed: ${passedCount}, Total Failed: ${failedCount}`);
  console.log('=====================================================================');

  return { passedCount, failedCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const res = await runDevotionalRestaurantCatalogueTests();
      process.exit(res.failedCount === 0 ? 0 : 1);
    } catch (err) {
      console.error('Test execution failed:', err);
      process.exit(1);
    }
  }
};

runDirect();
