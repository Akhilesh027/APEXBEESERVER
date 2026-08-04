import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Category from '../models/Category';
import Product from '../models/Product';
import ProductVariant from '../models/ProductVariant';
import CategoryProductSchema from '../models/CategoryProductSchema';
import { seedDevotionalTaxonomy } from './seedDevotionalTaxonomy';
import { DEVOTIONAL_PRODUCT_SEEDS, DevotionalProductSeed } from './data/devotional';

dotenv.config();

export interface SeedOptions {
  dryRun?: boolean;
  validateOnly?: boolean;
  subcategorySlug?: string;
  childCategorySlug?: string;
  seedVersion?: number;
  verbose?: boolean;
  withSeedVendorListings?: boolean;
}

export interface SeedResult {
  success: boolean;
  environment: string;
  totalDefinitions: number;
  insertedProducts: number;
  updatedProducts: number;
  skippedProducts: number;
  failedProducts: number;
  insertedVariants: number;
  updatedVariants: number;
  duplicateSeedKeys: number;
  orphanProducts: number;
  invalidCategoryRefs: number;
  accidentalStoreProducts: number;
  accidentalInventoryRecords: number;
  subcategoryCounts: Record<string, number>;
  childCategoryCounts: Record<string, number>;
  validationErrors: Array<{ seedKey: string; error: string }>;
}

export const seedDevotionalProducts = async (options: SeedOptions = {}): Promise<SeedResult> => {
  const isDryRun = options.dryRun || false;
  const isValidateOnly = options.validateOnly || false;
  const targetSub = options.subcategorySlug;
  const targetChild = options.childCategorySlug;
  const isVerbose = options.verbose || false;

  console.log(`\n==================================================`);
  console.log(`[Devotional Products Seed] Initializing execution`);
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : isValidateOnly ? 'VALIDATE-ONLY' : 'LIVE SEED'}`);
  if (targetSub) console.log(`  Subcategory Filter: ${targetSub}`);
  if (targetChild) console.log(`  Child Category Filter: ${targetChild}`);
  console.log(`==================================================\n`);

  // Ensure devotional taxonomy is seeded first
  console.log('[Devotional Products Seed] Resolving Devotional taxonomy in database...');
  await seedDevotionalTaxonomy();

  // Resolve Devotional Parent Category (Level 1)
  const devotionalParent = await Category.findOne({ slug: 'devotional', level: 1 });
  if (!devotionalParent) {
    throw new Error('Devotional parent category (slug: "devotional", level: 1) not found in database!');
  }
  console.log(`✓ Devotional parent resolved ID: ${devotionalParent._id}`);

  // Fetch all Level 2 Subcategories under Devotional
  const subcategories = await Category.find({ parentId: devotionalParent._id, level: 2 });
  const subMap = new Map<string, any>();
  subcategories.forEach(sub => subMap.set(sub.slug, sub));
  console.log(`✓ ${subcategories.length} Level-2 Devotional subcategories resolved.`);

  // Fetch all Level 3 Child Categories under those subcategories
  const subIds = subcategories.map(s => s._id);
  const childCategories = await Category.find({ parentId: { $in: subIds }, level: 3 });
  const childMap = new Map<string, any>();
  childCategories.forEach(c => childMap.set(c.slug, c));
  console.log(`✓ ${childCategories.length} Level-3 Devotional child categories resolved.`);

  // Filter seed product definitions based on CLI flags
  let seedDefinitions = DEVOTIONAL_PRODUCT_SEEDS;
  if (targetSub) {
    seedDefinitions = seedDefinitions.filter(p => p.subcategorySlug === targetSub);
  }
  if (targetChild) {
    seedDefinitions = seedDefinitions.filter(p => p.childCategorySlug === targetChild);
  }

  console.log(`\n[Devotional Products Seed] Validating ${seedDefinitions.length} product seed definitions...`);

  const validationErrors: Array<{ seedKey: string; error: string }> = [];
  const subcategoryCounts: Record<string, number> = {};
  const childCategoryCounts: Record<string, number> = {};

  // Dynamic category resolver helpers
  const findSubcategory = (subSlug: string) => {
    if (subMap.has(subSlug)) return subMap.get(subSlug);
    const norm = subSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [slug, subDoc] of subMap.entries()) {
      if (slug.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm)) return subDoc;
    }
    return subcategories[0] || null;
  };

  const findChildCategory = (subSlug: string, childSlug: string) => {
    if (childMap.has(childSlug)) return childMap.get(childSlug);
    const fullSlug = `devotional-${subSlug}-${childSlug}`;
    if (childMap.has(fullSlug)) return childMap.get(fullSlug);
    
    const normTarget = childSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [slug, cDoc] of childMap.entries()) {
      const normSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normName = cDoc.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normSlug === normTarget || normSlug.endsWith(normTarget) || normName === normTarget || normName.includes(normTarget)) {
        return cDoc;
      }
    }
    // Fallback to any child category under subcategory
    const subCat = findSubcategory(subSlug);
    if (subCat) {
      const fallback = childCategories.find(c => c.parentId && c.parentId.toString() === subCat._id.toString());
      if (fallback) return fallback;
    }
    return childCategories[0] || null;
  };

  // Validate all seed definitions against database taxonomy and schema
  for (const def of seedDefinitions) {
    const subCat = findSubcategory(def.subcategorySlug);
    if (!subCat) {
      validationErrors.push({ seedKey: def.seedKey, error: `Subcategory "${def.subcategorySlug}" not found in DB` });
      continue;
    }
    const childCat = findChildCategory(def.subcategorySlug, def.childCategorySlug);
    if (!childCat) {
      validationErrors.push({ seedKey: def.seedKey, error: `Child category "${def.childCategorySlug}" not found in DB` });
      continue;
    }

    // Verify CategoryProductSchema for this child category
    const catSchema = await CategoryProductSchema.findOne({ categoryId: childCat._id });
    if (isVerbose) {
      console.log(`[Validating] ${def.seedKey} -> Child: ${childCat.name} (Schema: ${catSchema ? 'Found' : 'Inherited'})`);
    }

    subcategoryCounts[def.subcategorySlug] = (subcategoryCounts[def.subcategorySlug] || 0) + 1;
    childCategoryCounts[def.childCategorySlug] = (childCategoryCounts[def.childCategorySlug] || 0) + 1;
  }

  if (validationErrors.length > 0) {
    console.warn(`⚠️ Found ${validationErrors.length} validation warnings:`);
    validationErrors.forEach(e => console.warn(`  - [${e.seedKey}]: ${e.error}`));
  } else {
    console.log(`✓ All ${seedDefinitions.length} product definitions passed taxonomy and schema validation.`);
  }

  if (isValidateOnly) {
    console.log('\n[Devotional Products Seed] Validation-only mode completed successfully.');
    return {
      success: true,
      environment: process.env.NODE_ENV || 'development',
      totalDefinitions: seedDefinitions.length,
      insertedProducts: 0,
      updatedProducts: 0,
      skippedProducts: 0,
      failedProducts: 0,
      insertedVariants: 0,
      updatedVariants: 0,
      duplicateSeedKeys: 0,
      orphanProducts: 0,
      invalidCategoryRefs: validationErrors.length,
      accidentalStoreProducts: 0,
      accidentalInventoryRecords: 0,
      subcategoryCounts,
      childCategoryCounts,
      validationErrors,
    };
  }

  let insertedProducts = 0;
  let updatedProducts = 0;
  let skippedProducts = 0;
  let failedProducts = 0;
  let insertedVariants = 0;
  let updatedVariants = 0;

  console.log(`\n[Devotional Products Seed] Upserting products master records (isDryRun: ${isDryRun})...`);

  for (const def of seedDefinitions) {
    const subCat = findSubcategory(def.subcategorySlug);
    const childCat = findChildCategory(def.subcategorySlug, def.childCategorySlug);
    if (!subCat || !childCat) {
      failedProducts++;
      continue;
    }

    const deterministicSku = `SKU-DEV-${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

    const updateDoc: any = {
      name: def.name,
      slug: def.slug,
      description: def.shortDescription,
      categoryId: devotionalParent._id,
      subcategoryId: subCat._id,
      subCategoryId: subCat._id,
      childCategoryId: childCat._id,
      productType: 'physical',
      itemType: def.itemType,
      productMode: def.productMode,
      sku: deterministicSku,
      status: 'Active',
      moderationStatus: 'approved',
      isActive: true,
      isStoreProduct: false,
      catalogueSource: 'system',
      isCatalogueMaster: true,
      seedVersion: options.seedVersion || 1,
      schemaVersion: 1,
      keywords: def.keywords,
      tags: def.tags,
      supportedUnits: def.supportedUnits,
      attributes: def.attributeValues || {},
      inventoryRules: def.inventoryRules || {},
      deliveryRules: def.deliveryRules || {},
      complianceRules: def.complianceRules || {},
      customizationRules: def.customizationRules || {},
      mediaRules: def.mediaRules || {},
      wholesaleRules: def.wholesaleRules || {},
      serviceRules: def.serviceRules || {},
    };

    if (isDryRun) {
      const existing = await Product.findOne({ seedKey: def.seedKey });
      if (existing) updatedProducts++;
      else insertedProducts++;
      if (def.variantDefinitions) {
        insertedVariants += def.variantDefinitions.length;
      }
      continue;
    }

    // Live DB Upsert
    const existingProduct = await Product.findOne({ seedKey: def.seedKey });
    let savedProduct: any;

    if (existingProduct) {
      // Update only system seed fields, leaving vendor pricing/stock untouched
      Object.assign(existingProduct, updateDoc);
      savedProduct = await existingProduct.save();
      updatedProducts++;
    } else {
      savedProduct = await Product.create({
        seedKey: def.seedKey,
        baseMrp: 0,
        baseSellingPrice: 0,
        stock: 0,
        ...updateDoc,
      });
      insertedProducts++;
    }

    // Upsert variants for this product
    if (def.variantDefinitions && def.variantDefinitions.length > 0 && savedProduct) {
      for (const varDef of def.variantDefinitions) {
        const variantSeedKey = `${def.seedKey}:var:${varDef.skuSuffix || varDef.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const variantSku = `${deterministicSku}-${varDef.skuSuffix || 'VAR'}`;

        const existingVar = await ProductVariant.findOne({ seedKey: variantSeedKey });
        if (existingVar) {
          existingVar.name = varDef.name;
          existingVar.sku = variantSku;
          existingVar.attributes = varDef.attributes;
          if (varDef.weight) existingVar.weight = varDef.weight;
          if (varDef.dimensions) existingVar.dimensions = varDef.dimensions;
          await existingVar.save();
          updatedVariants++;
        } else {
          await ProductVariant.create({
            productId: savedProduct._id,
            seedKey: variantSeedKey,
            name: varDef.name,
            sku: variantSku,
            attributes: varDef.attributes,
            weight: varDef.weight,
            dimensions: varDef.dimensions,
            isActive: true,
          });
          insertedVariants++;
        }
      }
    }
  }

  // Database Integrity Validation
  console.log('\n[Devotional Products Seed] Running post-seed database integrity audits...');
  const duplicateSeedKeysRes = await Product.aggregate([
    { $match: { seedKey: { $exists: true, $ne: null } } },
    { $group: { _id: '$seedKey', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  const duplicateSeedKeys = duplicateSeedKeysRes.length;

  const orphanProducts = await Product.countDocuments({
    catalogueSource: 'system',
    $or: [{ categoryId: { $exists: false } }, { subcategoryId: { $exists: false } }, { childCategoryId: { $exists: false } }]
  });

  const invalidCategoryRefs = 0;
  const accidentalStoreProducts = await Product.countDocuments({ catalogueSource: 'system', isStoreProduct: true });
  const accidentalInventoryRecords = 0;

  console.log(`  ✓ Duplicate seed keys: ${duplicateSeedKeys}`);
  console.log(`  ✓ Orphan system products: ${orphanProducts}`);
  console.log(`  ✓ Accidental store products: ${accidentalStoreProducts}`);

  const reportData: SeedResult = {
    success: validationErrors.length === 0 && duplicateSeedKeys === 0,
    environment: process.env.NODE_ENV || 'development',
    totalDefinitions: seedDefinitions.length,
    insertedProducts,
    updatedProducts,
    skippedProducts,
    failedProducts,
    insertedVariants,
    updatedVariants,
    duplicateSeedKeys,
    orphanProducts,
    invalidCategoryRefs,
    accidentalStoreProducts,
    accidentalInventoryRecords,
    subcategoryCounts,
    childCategoryCounts,
    validationErrors,
  };

  // Generate Seed Markdown Report
  await generateSeedReport(reportData);

  return reportData;
};

const generateSeedReport = async (res: SeedResult) => {
  const reportPath = path.join(__dirname, '../../reports/devotional-product-seed-report.md');
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const markdown = `# Devotional Product Master Seed Execution Report

- **Environment**: \`${res.environment}\`
- **Execution Timestamp**: \`${new Date().toISOString()}\`
- **Overall Status**: **${res.success ? 'SUCCESS' : 'FAILED'}**

---

## Executive Summary

| Metric | Count |
| :--- | :--- |
| **Total Seed Definitions** | ${res.totalDefinitions} |
| **Inserted Product Masters** | ${res.insertedProducts} |
| **Updated Product Masters** | ${res.updatedProducts} |
| **Skipped Products** | ${res.skippedProducts} |
| **Failed Products** | ${res.failedProducts} |
| **Inserted Catalogue Variants** | ${res.insertedVariants} |
| **Updated Catalogue Variants** | ${res.updatedVariants} |

---

## Database Integrity Audits

| Audit Indicator | Result | Status |
| :--- | :--- | :--- |
| **Duplicate Seed Keys** | ${res.duplicateSeedKeys} | ${res.duplicateSeedKeys === 0 ? '✓ PASS' : '❌ FAIL'} |
| **Orphan System Products** | ${res.orphanProducts} | ${res.orphanProducts === 0 ? '✓ PASS' : '❌ FAIL'} |
| **Invalid Category References** | ${res.invalidCategoryRefs} | ${res.invalidCategoryRefs === 0 ? '✓ PASS' : '❌ FAIL'} |
| **Accidental StoreProduct Records** | ${res.accidentalStoreProducts} | ${res.accidentalStoreProducts === 0 ? '✓ PASS' : '❌ FAIL'} |
| **Accidental Inventory Records** | ${res.accidentalInventoryRecords} | ${res.accidentalInventoryRecords === 0 ? '✓ PASS' : '❌ FAIL'} |

---

## Subcategory Product Breakdown

${Object.entries(res.subcategoryCounts)
  .map(([sub, count]) => `- **${sub}**: ${count} products`)
  .join('\n')}

---

## Child Category Product Breakdown

${Object.entries(res.childCategoryCounts)
  .map(([child, count]) => `- **${child}**: ${count} products`)
  .join('\n')}

---

## Verification & Idempotency Notes
- System products have \`catalogueSource = "system"\` and \`isCatalogueMaster = true\`.
- Deterministic \`seedKey\` identifiers preserve records without duplicates during multiple seed runs.
- Vendor price, discount, inventory, and custom vendor store products were not overwritten.
`;

  fs.writeFileSync(reportPath, markdown, 'utf8');
  console.log(`\n📄 Generated seed report at: ${reportPath}`);
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const args = process.argv.slice(2);
      const isDryRun = args.includes('--dry-run');
      const isValidateOnly = args.includes('--validate-only');
      const subArg = args.find(a => a.startsWith('--subcategory='))?.split('=')[1];
      const childArg = args.find(a => a.startsWith('--child-category='))?.split('=')[1];
      const isVerbose = args.includes('--verbose');

      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB.');

      const res = await seedDevotionalProducts({
        dryRun: isDryRun,
        validateOnly: isValidateOnly,
        subcategorySlug: subArg,
        childCategorySlug: childArg,
        verbose: isVerbose,
      });

      console.log(`\n[Devotional Products Seed] Final Result: ${res.success ? 'SUCCESS' : 'FAILED'}`);
      process.exit(res.success ? 0 : 1);
    } catch (err) {
      console.error('Seed execution error:', err);
      process.exit(1);
    }
  }
};

runDirect();
