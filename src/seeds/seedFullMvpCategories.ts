import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';

dotenv.config();

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const seedFullMvpCategories = async () => {
  console.log('[SeedFullMvpCategories] Seeding full MVP taxonomy (6 Main Categories, Subcategories, Child Categories)...');

  const jsonPath = path.join(__dirname, 'data', 'categories_full_mvp.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('categories_full_mvp.json file missing!');
  }

  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let catCount = 0;
  let subCount = 0;
  let childCount = 0;

  for (let cIdx = 0; cIdx < rawData.length; cIdx++) {
    const mainData = rawData[cIdx];
    const mainSlug = mainData.slug || makeSlug(mainData.name);

    const mainCategory = await Category.findOneAndUpdate(
      { slug: mainSlug },
      {
        $set: {
          name: mainData.name,
          slug: mainSlug,
          description: `${mainData.name} main category`,
          level: 1,
          parentId: null,
          supportedItemTypes: mainData.supportedItemTypes || ['product'],
          displayOrder: cIdx + 1,
          isActive: true,
          isFeatured: true,
        },
      },
      { upsert: true, new: true }
    );
    catCount++;

    const subcats = mainData.subcategories || [];
    for (let sIdx = 0; sIdx < subcats.length; sIdx++) {
      const subData = subcats[sIdx];
      const subSlug = `${mainSlug}-${subData.slug || makeSlug(subData.name)}`;

      const subCategory = await Category.findOneAndUpdate(
        { slug: subSlug },
        {
          $set: {
            name: subData.name,
            slug: subSlug,
            description: `${subData.name} subcategory under ${mainData.name}`,
            level: 2,
            parentId: mainCategory._id,
            supportedItemTypes: mainData.supportedItemTypes || ['product'],
            displayOrder: sIdx + 1,
            isActive: true,
          },
        },
        { upsert: true, new: true }
      );
      subCount++;

      const childList = subData.childCategories || [];
      for (let chIdx = 0; chIdx < childList.length; chIdx++) {
        const childName = childList[chIdx];
        const childSlug = `${subSlug}-${makeSlug(childName)}`;

        await Category.findOneAndUpdate(
          { slug: childSlug },
          {
            $set: {
              name: childName,
              slug: childSlug,
              description: `${childName} child category under ${subData.name}`,
              level: 3,
              parentId: subCategory._id,
              supportedItemTypes: mainData.supportedItemTypes || ['product'],
              displayOrder: chIdx + 1,
              isActive: true,
            },
          },
          { upsert: true, new: true }
        );
        childCount++;
      }
    }
  }

  console.log(`[SeedFullMvpCategories] Completed successfully! Seeded ${catCount} L1 Main Categories, ${subCount} L2 Subcategories, and ${childCount} L3 Child Categories.`);
  return { catCount, subCount, childCount };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to DB. Seeding...');
      await seedFullMvpCategories();
      process.exit(0);
    } catch (err) {
      console.error('Seed error:', err);
      process.exit(1);
    }
  }
};

runDirect();
