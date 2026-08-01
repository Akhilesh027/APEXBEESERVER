import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';
import { resolveCategorySchema } from '../services/catalogue/schemaResolutionService';

dotenv.config();

export const verifyDailyNeedsTaxonomy = async () => {
  console.log('[VerifyDailyNeedsTaxonomy] Starting verification of Daily Needs category foundation...');

  // 1. Verify Parent Category
  const parent = await Category.findOne({ slug: 'daily-needs', level: 1 });
  if (!parent) {
    throw new Error('VERIFICATION FAILED: Daily Needs parent category not found.');
  }

  // 2. Verify Subcategories (Level 2)
  const subcategories = await Category.find({ parentId: parent._id, level: 2 });
  if (subcategories.length !== 6) {
    throw new Error(`VERIFICATION FAILED: Expected 6 subcategories under Daily Needs, found ${subcategories.length}`);
  }

  const subIds = subcategories.map((s) => s._id);

  // 3. Verify Child Categories (Level 3)
  const childCategories = await Category.find({ parentId: { $in: subIds }, level: 3 });
  if (childCategories.length !== 78) {
    throw new Error(`VERIFICATION FAILED: Expected 78 child categories under Daily Needs, found ${childCategories.length}`);
  }

  // 4. Check for duplicate slugs across all Daily Needs categories
  const allDailyNeedsCats = await Category.find({
    $or: [{ _id: parent._id }, { parentId: parent._id }, { parentId: { $in: subIds } }],
  });

  const slugSet = new Set<string>();
  let duplicateSlugs = 0;
  allDailyNeedsCats.forEach((cat) => {
    if (slugSet.has(cat.slug)) {
      console.error(`Duplicate slug detected: ${cat.slug}`);
      duplicateSlugs++;
    }
    slugSet.add(cat.slug);
  });

  if (duplicateSlugs > 0) {
    throw new Error(`VERIFICATION FAILED: Found ${duplicateSlugs} duplicate slugs in Daily Needs hierarchy.`);
  }

  // 5. Check for orphan categories
  const orphans = await Category.find({
    level: { $in: [2, 3] },
    $or: [{ parentId: null }, { parentId: { $exists: false } }],
  });

  // Filter orphans belonging to daily needs
  const dailyNeedsOrphans = orphans.filter((o) =>
    o.name.toLowerCase().includes('daily') || o.name.toLowerCase().includes('fruit') || o.name.toLowerCase().includes('milk')
  );

  if (dailyNeedsOrphans.length > 0) {
    throw new Error(`VERIFICATION FAILED: Found ${dailyNeedsOrphans.length} orphan categories.`);
  }

  // 6. Verify CategoryProductSchema records (6 subcategory base + 78 child override = 84)
  const allCatIds = [parent._id, ...subIds, ...childCategories.map((c) => c._id)];
  const schemas = await CategoryProductSchema.find({ categoryId: { $in: [ ...subIds, ...childCategories.map((c) => c._id) ] } });

  if (schemas.length !== 84) {
    throw new Error(`VERIFICATION FAILED: Expected 84 CategoryProductSchema records (6 base + 78 child override), found ${schemas.length}`);
  }

  // 7. Test dynamic schema resolution for child categories
  let missingChildSchemas = 0;
  for (const child of childCategories) {
    try {
      const resolved = await resolveCategorySchema(child._id.toString());
      if (!resolved || !resolved.attributes || resolved.attributes.length === 0) {
        console.error(`Schema resolution empty for child category: ${child.name}`);
        missingChildSchemas++;
      }
    } catch (err: any) {
      console.error(`Schema resolution failed for ${child.name}:`, err.message);
      missingChildSchemas++;
    }
  }

  if (missingChildSchemas > 0) {
    throw new Error(`VERIFICATION FAILED: ${missingChildSchemas} child categories failed dynamic schema resolution.`);
  }

  console.log('====================================================');
  console.log('       DAILY NEEDS TAXONOMY VERIFICATION PASSED     ');
  console.log('====================================================');
  console.log(`Parent Category: 1 (daily-needs)`);
  console.log(`Subcategories: ${subcategories.length} / 6`);
  console.log(`Child Categories: ${childCategories.length} / 78`);
  console.log(`Category Schemas: ${schemas.length} / 84`);
  console.log(`Duplicate Slugs: ${duplicateSlugs}`);
  console.log(`Orphan Categories: 0`);
  console.log(`Missing Child Schemas: 0`);
  console.log('====================================================');

  return {
    parentCount: 1,
    subCount: subcategories.length,
    childCount: childCategories.length,
    schemaCount: schemas.length,
    duplicateSlugs,
    orphans: 0,
    missingChildSchemas: 0,
  };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Verifying Daily Needs taxonomy...');
      await verifyDailyNeedsTaxonomy();
      process.exit(0);
    } catch (err: any) {
      console.error('Verification Error:', err.message);
      process.exit(1);
    }
  }
};

runDirect();
