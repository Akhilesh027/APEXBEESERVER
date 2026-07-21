import fs from 'fs';
import path from 'path';
import Category from '../models/Category';
import Subcategory from '../models/Subcategory';

export const seedCategories = async (dryRun = false) => {
  console.log(`[Seed Categories] Starting seed. Dry Run: ${dryRun}`);

  const categoriesPath = path.join(__dirname, 'data', 'categories.json');
  const subcategoriesPath = path.join(__dirname, 'data', 'subcategories.json');

  if (!fs.existsSync(categoriesPath) || !fs.existsSync(subcategoriesPath)) {
    throw new Error('Categories or Subcategories seed file is missing in seeds/data/');
  }

  const rawCategories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  const rawSubcategories = JSON.parse(fs.readFileSync(subcategoriesPath, 'utf8'));

  const stats = {
    categories: { inserted: 0, updated: 0, skipped: 0 },
    subcategories: { inserted: 0, updated: 0, skipped: 0 },
  };

  const seedKeyToIdMap: Record<string, string> = {};

  // 1. Seed Categories
  for (const cat of rawCategories) {
    const existing = await Category.findOne({ slug: cat.slug });

    if (dryRun) {
      if (existing) {
        console.log(`[Dry Run] Would update category: ${cat.name} (${cat.slug})`);
        stats.categories.updated++;
      } else {
        console.log(`[Dry Run] Would insert category: ${cat.name} (${cat.slug})`);
        stats.categories.inserted++;
      }
      continue;
    }

    // Since we refactored Category to have media asset IDs, we keep them empty/placeholder for now during seeding.
    // In production/staging, actual IDs can be uploaded and assigned.
    const query = { slug: cat.slug };
    const updateDoc = {
      $set: {
        name: cat.name,
        description: cat.description || '',
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        isFeatured: cat.isFeatured,
        isSeasonal: cat.isSeasonal,
        supportedItemTypes: cat.supportedItemTypes,
        seo: cat.seo || {},
      },
    };

    const result = await Category.findOneAndUpdate(query, updateDoc, {
      upsert: true,
      new: true,
      runValidators: true,
    });

    if (existing) {
      stats.categories.updated++;
    } else {
      stats.categories.inserted++;
    }

    seedKeyToIdMap[cat.seedKey] = (result._id as any).toString();
  }

  console.log('[Seed Categories] Categories seeding done. Processing subcategories...');

  // If dry-run, we might not have updated categories in database, so map keys to match
  if (dryRun) {
    for (const cat of rawCategories) {
      const match = await Category.findOne({ slug: cat.slug });
      if (match) {
        seedKeyToIdMap[cat.seedKey] = (match._id as any).toString();
      } else {
        seedKeyToIdMap[cat.seedKey] = 'dry-run-placeholder-id';
      }
    }
  }

  // 2. Seed Subcategories
  for (const sub of rawSubcategories) {
    const categoryId = seedKeyToIdMap[sub.categorySeedKey];

    if (!categoryId) {
      console.warn(`[Seed Categories] Warning: Category seed key "${sub.categorySeedKey}" not found for subcategory "${sub.name}". Skipping.`);
      stats.subcategories.skipped++;
      continue;
    }

    const existing = await Subcategory.findOne({ slug: sub.slug });

    if (dryRun) {
      if (existing) {
        console.log(`[Dry Run] Would update subcategory: ${sub.name} (${sub.slug})`);
        stats.subcategories.updated++;
      } else {
        console.log(`[Dry Run] Would insert subcategory: ${sub.name} (${sub.slug})`);
        stats.subcategories.inserted++;
      }
      continue;
    }

    const query = { slug: sub.slug };
    const updateDoc = {
      $set: {
        categoryId,
        name: sub.name,
        displayOrder: sub.displayOrder,
        isActive: sub.isActive,
        isFeatured: sub.isFeatured,
      },
    };

    await Subcategory.findOneAndUpdate(query, updateDoc, {
      upsert: true,
      new: true,
      runValidators: true,
    });

    if (existing) {
      stats.subcategories.updated++;
    } else {
      stats.subcategories.inserted++;
    }
  }

  console.log('[Seed Categories] Seeding complete.', stats);
  return stats;
};
