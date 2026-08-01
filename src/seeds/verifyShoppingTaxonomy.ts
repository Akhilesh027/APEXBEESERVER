import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

dotenv.config();

export interface IShoppingVerificationResult {
  passed: boolean;
  parent: number;
  subcategories: number;
  childCategories: number;
  schemas: number;
  duplicateSlugsCount: number;
  orphanCategoriesCount: number;
  errors: string[];
}

export const verifyShoppingTaxonomy = async (): Promise<IShoppingVerificationResult> => {
  const errors: string[] = [];

  const parentCat = await Category.findOne({ slug: 'shopping', level: 1 });
  let subCount = 0;
  let childCount = 0;
  let schemaCount = 0;

  if (parentCat) {
    const subDocs = await Category.find({ parentId: parentCat._id, level: 2 });
    subCount = subDocs.length;
    const subIds = subDocs.map(s => s._id);

    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    childCount = childDocs.length;
    const childIds = childDocs.map(c => c._id);

    const allCatIds = [parentCat._id, ...subIds, ...childIds];
    schemaCount = await CategoryProductSchema.countDocuments({ categoryId: { $in: allCatIds } });
  }

  // Duplicate Slugs Check
  const duplicates = await Category.aggregate([
    { $group: { _id: '$slug', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  const duplicateSlugsCount = duplicates.length;

  // Orphan Check
  const level2And3 = await Category.find({ level: { $in: [2, 3] } }).lean();
  const parentIds = [...new Set(level2And3.map(c => c.parentId).filter(Boolean))];
  const existingParents = await Category.find({ _id: { $in: parentIds } }, { _id: 1 }).lean();
  const existingParentSet = new Set(existingParents.map(p => p._id.toString()));
  let orphanCategoriesCount = 0;
  for (const cat of level2And3) {
    if (!cat.parentId || !existingParentSet.has(cat.parentId.toString())) {
      orphanCategoriesCount++;
    }
  }

  // Target Assertions
  if (!parentCat || parentCat.level !== 1) {
    errors.push('Shopping parent category (slug: shopping, level: 1) missing or invalid.');
  }

  if (subCount !== 3) {
    errors.push(`Shopping subcategories count mismatch: expected 3, got ${subCount}`);
  }

  if (childCount !== 36) {
    errors.push(`Shopping child categories count mismatch: expected 36, got ${childCount}`);
  }

  if (schemaCount !== 39) {
    errors.push(`Shopping CategoryProductSchema count mismatch: expected 39, got ${schemaCount}`);
  }

  if (duplicateSlugsCount > 0) {
    errors.push(`Duplicate slugs found: ${duplicateSlugsCount}`);
  }

  if (orphanCategoriesCount > 0) {
    errors.push(`Orphan categories found: ${orphanCategoriesCount}`);
  }

  const passed = errors.length === 0;

  return {
    passed,
    parent: parentCat ? 1 : 0,
    subcategories: subCount,
    childCategories: childCount,
    schemas: schemaCount,
    duplicateSlugsCount,
    orphanCategoriesCount,
    errors,
  };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB. Running Shopping taxonomy verification...');
      const result = await verifyShoppingTaxonomy();
      console.log('Verification Result:', JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    } catch (err) {
      console.error('Verification error:', err);
      process.exit(1);
    }
  }
};

runDirect();
