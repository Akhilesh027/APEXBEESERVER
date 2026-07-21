import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { seedCatalog } from './seedProducts';

const main = async () => {
  const isValidate = process.argv.includes('--validate');
  const isDryRun = process.argv.includes('--dry-run');

  // Parse environment if specified
  const envIndex = process.argv.indexOf('--environment');
  if (envIndex !== -1 && envIndex + 1 < process.argv.length) {
    const environment = process.argv[envIndex + 1];
    process.env.NODE_ENV = environment;
    console.log(`[Seed All] Setting NODE_ENV to: ${environment}`);
  }

  console.log(`[Seed All] Starting execution. Validate: ${isValidate}, Dry Run: ${isDryRun}`);

  if (isValidate) {
    console.log('[Seed All] Validation mode. Checking JSON datasets syntax and rules...');
    try {
      const categoriesPath = require('path').join(__dirname, 'data', 'categories.json');
      const subcategoriesPath = require('path').join(__dirname, 'data', 'subcategories.json');
      const productsPath = require('path').join(__dirname, 'data', 'products.json');
      const variantsPath = require('path').join(__dirname, 'data', 'variants.json');
      
      const cats = JSON.parse(require('fs').readFileSync(categoriesPath, 'utf8'));
      const subs = JSON.parse(require('fs').readFileSync(subcategoriesPath, 'utf8'));
      const prods = JSON.parse(require('fs').readFileSync(productsPath, 'utf8'));
      const vars = JSON.parse(require('fs').readFileSync(variantsPath, 'utf8'));

      console.log(`[Validation] Found ${cats.length} categories.`);
      console.log(`[Validation] Found ${subs.length} subcategories.`);
      console.log(`[Validation] Found ${prods.length} products.`);
      console.log(`[Validation] Found ${vars.length} variants.`);

      // Verify category fields
      const categoryKeys = new Set<string>();
      const categorySlugs = new Set<string>();

      for (const cat of cats) {
        if (!cat.seedKey) throw new Error(`Category is missing "seedKey": ${JSON.stringify(cat)}`);
        if (!cat.name) throw new Error(`Category is missing "name": ${JSON.stringify(cat)}`);
        if (!cat.slug) throw new Error(`Category is missing "slug": ${JSON.stringify(cat)}`);
        if (categoryKeys.has(cat.seedKey)) throw new Error(`Duplicate Category seedKey: ${cat.seedKey}`);
        if (categorySlugs.has(cat.slug)) throw new Error(`Duplicate Category slug: ${cat.slug}`);
        categoryKeys.add(cat.seedKey);
        categorySlugs.add(cat.slug);

        if (!Array.isArray(cat.supportedItemTypes) || cat.supportedItemTypes.length === 0) {
          throw new Error(`Category ${cat.name} must have non-empty supportedItemTypes array.`);
        }
      }

      // Verify subcategory fields
      const subcategoryKeys = new Set<string>();
      const subcategorySlugs = new Set<string>();

      for (const sub of subs) {
        if (!sub.seedKey) throw new Error(`Subcategory is missing "seedKey": ${JSON.stringify(sub)}`);
        if (!sub.categorySeedKey) throw new Error(`Subcategory is missing "categorySeedKey": ${JSON.stringify(sub)}`);
        if (!sub.name) throw new Error(`Subcategory is missing "name": ${JSON.stringify(sub)}`);
        if (!sub.slug) throw new Error(`Subcategory is missing "slug": ${JSON.stringify(sub)}`);
        
        if (subcategoryKeys.has(sub.seedKey)) throw new Error(`Duplicate Subcategory seedKey: ${sub.seedKey}`);
        if (subcategorySlugs.has(sub.slug)) throw new Error(`Duplicate Subcategory slug: ${sub.slug}`);
        
        if (!categoryKeys.has(sub.categorySeedKey)) {
          throw new Error(`Subcategory ${sub.name} references unknown categorySeedKey: ${sub.categorySeedKey}`);
        }
        
        subcategoryKeys.add(sub.seedKey);
        subcategorySlugs.add(sub.slug);
      }

      // Verify product fields
      const productKeys = new Set<string>();
      const productSlugs = new Set<string>();

      for (const prod of prods) {
        if (!prod.seedKey) throw new Error(`Product is missing "seedKey": ${JSON.stringify(prod)}`);
        if (!prod.subcategorySeedKey) throw new Error(`Product is missing "subcategorySeedKey": ${JSON.stringify(prod)}`);
        if (!prod.name) throw new Error(`Product is missing "name": ${JSON.stringify(prod)}`);
        if (!prod.slug) throw new Error(`Product is missing "slug": ${JSON.stringify(prod)}`);

        if (productKeys.has(prod.seedKey)) throw new Error(`Duplicate Product seedKey: ${prod.seedKey}`);
        if (productSlugs.has(prod.slug)) throw new Error(`Duplicate Product slug: ${prod.slug}`);

        if (!subcategoryKeys.has(prod.subcategorySeedKey)) {
          throw new Error(`Product ${prod.name} references unknown subcategorySeedKey: ${prod.subcategorySeedKey}`);
        }

        productKeys.add(prod.seedKey);
        productSlugs.add(prod.slug);
      }

      // Verify variant fields
      const variantKeys = new Set<string>();
      const variantSkus = new Set<string>();

      for (const vr of vars) {
        if (!vr.seedKey) throw new Error(`Variant is missing "seedKey": ${JSON.stringify(vr)}`);
        if (!vr.productSeedKey) throw new Error(`Variant is missing "productSeedKey": ${JSON.stringify(vr)}`);
        if (!vr.sku) throw new Error(`Variant is missing "sku": ${JSON.stringify(vr)}`);

        if (variantKeys.has(vr.seedKey)) throw new Error(`Duplicate Variant seedKey: ${vr.seedKey}`);
        if (variantSkus.has(vr.sku)) throw new Error(`Duplicate Variant SKU: ${vr.sku}`);

        if (!productKeys.has(vr.productSeedKey)) {
          throw new Error(`Variant ${vr.sku} references unknown productSeedKey: ${vr.productSeedKey}`);
        }

        variantKeys.add(vr.seedKey);
        variantSkus.add(vr.sku);
      }

      console.log('[Validation] All JSON datasets are valid!');
      process.exit(0);
    } catch (err: any) {
      console.error('[Validation Failed]', err.message);
      process.exit(1);
    }
  }

  // Seeding requires database connection
  await connectDB();

  try {
    const stats = await seedCatalog(isDryRun);
    console.log('[Seed All] Seeding operation completed successfully!');
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('[Seed All Failed]', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed All] Disconnected from MongoDB.');
  }
};

main();
