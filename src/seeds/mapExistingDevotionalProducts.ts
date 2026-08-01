import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';

dotenv.config();

export const mapExistingDevotionalProducts = async (isDryRun = false) => {
  console.log(`[MapExistingDevotionalProducts] Running product mapping (isDryRun: ${isDryRun})...`);

  const devotionalParent = await Category.findOne({ slug: 'devotional', level: 1 });
  if (!devotionalParent) {
    throw new Error('Devotional parent category not found in DB!');
  }

  // Find all products assigned to Devotional parent or subcategories
  const products = await Product.find({
    $or: [
      { categoryId: devotionalParent._id },
      { category: 'devotional' },
    ],
  });

  console.log(`Found ${products.length} Devotional products to inspect.`);

  const defaultChild = await Category.findOne({ slug: 'devotional-pooja-essentials-daily-pooja-packs' });

  let updatedCount = 0;
  for (const prod of products) {
    let targetChild = prod.childCategoryId ? await Category.findById(prod.childCategoryId) : null;
    if (!targetChild && defaultChild) {
      targetChild = defaultChild;
    }

    if (!isDryRun) {
      prod.childCategoryId = targetChild ? targetChild._id : prod.childCategoryId;
      prod.subCategoryId = targetChild?.parentId ? targetChild.parentId : prod.subCategoryId;
      (prod as any).schemaVersion = 1;
      await prod.save();
    }
    updatedCount++;
  }

  console.log(`[MapExistingDevotionalProducts] Completed! Inspected: ${products.length}, Updated: ${updatedCount} (isDryRun: ${isDryRun}).`);
  return { inspected: products.length, updatedCount, isDryRun };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const isDry = process.argv.includes('--dry-run');
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      await mapExistingDevotionalProducts(isDry);
      process.exit(0);
    } catch (err) {
      console.error('Product map error:', err);
      process.exit(1);
    }
  }
};

runDirect();
