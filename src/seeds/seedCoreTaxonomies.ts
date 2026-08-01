import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';
import { seedDevotionalTaxonomy } from './seedDevotionalTaxonomy';
import { seedRestaurantTaxonomy } from './seedRestaurantTaxonomy';
import { seedDailyNeedsTaxonomy } from './seedDailyNeedsTaxonomy';
import { seedShoppingTaxonomy } from './seedShoppingTaxonomy';
import { seedServicesTaxonomy } from './seedServicesTaxonomy';
import { seedAcademyTaxonomy } from './seedAcademyTaxonomy';

import { verifyShoppingTaxonomy } from './verifyShoppingTaxonomy';
import { verifyServicesTaxonomy } from './verifyServicesTaxonomy';
import { verifyAcademyTaxonomy } from './verifyAcademyTaxonomy';

dotenv.config();

export interface ICoreTaxonomyResult {
  passed: boolean;
  devotional: { parents: number; subcategories: number; childCategories: number; schemas: number };
  restaurant: { parents: number; subcategories: number; childCategories: number; schemas: number };
  dailyNeeds: { parents: number; subcategories: number; childCategories: number; schemas: number };
  shopping: { parents: number; subcategories: number; childCategories: number; schemas: number };
  services: { parents: number; subcategories: number; childCategories: number; schemas: number };
  academy?: { parents: number; subcategories: number; childCategories: number; schemas: number };
  combined: { parents: number; subcategories: number; childCategories: number; schemas: number };
  errors: string[];
}

export const verifyCoreTaxonomies = async (): Promise<ICoreTaxonomyResult> => {
  const errors: string[] = [];

  const devParent = await Category.findOne({ slug: 'devotional', level: 1 });
  const restParent = await Category.findOne({ slug: 'restaurant', level: 1 });
  const dailyParent = await Category.findOne({ slug: 'daily-needs', level: 1 });
  const shoppingParent = await Category.findOne({ slug: 'shopping', level: 1 });
  const servicesParent = await Category.findOne({ slug: 'services', level: 1 });
  const academyParent = await Category.findOne({ slug: 'apexbee-academy', level: 1 });

  // 1. Devotional counts
  let devSubs = 0, devChildren = 0, devSchemas = 0;
  if (devParent) {
    const subDocs = await Category.find({ parentId: devParent._id, level: 2 });
    devSubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    devChildren = childDocs.length;
    const devCatIds = [devParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    devSchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: devCatIds } });
  }

  // 2. Restaurant counts
  let restSubs = 0, restChildren = 0, restSchemas = 0;
  if (restParent) {
    const subDocs = await Category.find({ parentId: restParent._id, level: 2 });
    restSubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    restChildren = childDocs.length;
    const restCatIds = [restParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    restSchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: restCatIds } });
  }

  // 3. Daily Needs counts
  let dailySubs = 0, dailyChildren = 0, dailySchemas = 0;
  if (dailyParent) {
    const subDocs = await Category.find({ parentId: dailyParent._id, level: 2 });
    dailySubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    dailyChildren = childDocs.length;
    const dailyCatIds = [dailyParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    dailySchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: dailyCatIds } });
  }

  // 4. Shopping counts
  let shopSubs = 0, shopChildren = 0, shopSchemas = 0;
  if (shoppingParent) {
    const subDocs = await Category.find({ parentId: shoppingParent._id, level: 2 });
    shopSubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    shopChildren = childDocs.length;
    const shopCatIds = [shoppingParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    shopSchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: shopCatIds } });
  }

  // 5. Services counts
  let serviceSubs = 0, serviceChildren = 0, serviceSchemas = 0;
  if (servicesParent) {
    const subDocs = await Category.find({ parentId: servicesParent._id, level: 2 });
    serviceSubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    serviceChildren = childDocs.length;
    const serviceCatIds = [servicesParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    serviceSchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: serviceCatIds } });
  }

  // 6. Academy counts
  let academySubs = 0, academyChildren = 0, academySchemas = 0;
  if (academyParent) {
    const subDocs = await Category.find({ parentId: academyParent._id, level: 2 });
    academySubs = subDocs.length;
    const subIds = subDocs.map((s) => s._id);
    const childDocs = await Category.find({ parentId: { $in: subIds }, level: 3 });
    academyChildren = childDocs.length;
    const academyCatIds = [academyParent._id, ...subIds, ...childDocs.map((c) => c._id)];
    academySchemas = await CategoryProductSchema.countDocuments({ categoryId: { $in: academyCatIds } });
  }

  // Assertions
  if (!devParent || devSubs !== 11 || devChildren !== 190 || devSchemas !== 201) {
    errors.push(`Devotional vertical mismatch: parents=${devParent ? 1 : 0}/1, subs=${devSubs}/11, children=${devChildren}/190, schemas=${devSchemas}/201`);
  }
  if (!restParent || restSubs !== 13 || restChildren !== 136 || restSchemas !== 149) {
    errors.push(`Restaurant (Food & Dining) vertical mismatch: parents=${restParent ? 1 : 0}/1, subs=${restSubs}/13, children=${restChildren}/136, schemas=${restSchemas}/149`);
  }
  if (!dailyParent || dailySubs !== 6 || dailyChildren !== 78 || dailySchemas !== 84) {
    errors.push(`Daily Needs vertical mismatch: parents=${dailyParent ? 1 : 0}/1, subs=${dailySubs}/6, children=${dailyChildren}/78, schemas=${dailySchemas}/84`);
  }
  if (!shoppingParent || shopSubs !== 3 || shopChildren !== 36 || shopSchemas !== 39) {
    errors.push(`Shopping vertical mismatch: parents=${shoppingParent ? 1 : 0}/1, subs=${shopSubs}/3, children=${shopChildren}/36, schemas=${shopSchemas}/39`);
  }
  if (!servicesParent || serviceSubs !== 4 || serviceChildren !== 46 || serviceSchemas !== 50) {
    errors.push(`Services vertical mismatch: parents=${servicesParent ? 1 : 0}/1, subs=${serviceSubs}/4, children=${serviceChildren}/46, schemas=${serviceSchemas}/50`);
  }
  if (!academyParent || academySubs !== 2 || academyChildren !== 0 || academySchemas !== 0) {
    errors.push(`Academy vertical mismatch: parents=${academyParent ? 1 : 0}/1, subs=${academySubs}/2, children=${academyChildren}/0, schemas=${academySchemas}/0`);
  }

  const combinedParents = (devParent ? 1 : 0) + (restParent ? 1 : 0) + (dailyParent ? 1 : 0) + (shoppingParent ? 1 : 0) + (servicesParent ? 1 : 0) + (academyParent ? 1 : 0);
  const combinedSubs = devSubs + restSubs + dailySubs + shopSubs + serviceSubs + academySubs;
  const combinedChildren = devChildren + restChildren + dailyChildren + shopChildren + serviceChildren + academyChildren;
  const combinedSchemas = devSchemas + restSchemas + dailySchemas + shopSchemas + serviceSchemas + academySchemas;

  if (combinedParents !== 6 || combinedSubs !== 39 || combinedChildren !== 486 || combinedSchemas !== 523) {
    errors.push(`Combined taxonomy mismatch: parents=${combinedParents}/6, subs=${combinedSubs}/39, children=${combinedChildren}/486, schemas=${combinedSchemas}/523`);
  }

  return {
    passed: errors.length === 0,
    devotional: { parents: devParent ? 1 : 0, subcategories: devSubs, childCategories: devChildren, schemas: devSchemas },
    restaurant: { parents: restParent ? 1 : 0, subcategories: restSubs, childCategories: restChildren, schemas: restSchemas },
    dailyNeeds: { parents: dailyParent ? 1 : 0, subcategories: dailySubs, childCategories: dailyChildren, schemas: dailySchemas },
    shopping: { parents: shoppingParent ? 1 : 0, subcategories: shopSubs, childCategories: shopChildren, schemas: shopSchemas },
    services: { parents: servicesParent ? 1 : 0, subcategories: serviceSubs, childCategories: serviceChildren, schemas: serviceSchemas },
    academy: { parents: academyParent ? 1 : 0, subcategories: academySubs, childCategories: academyChildren, schemas: academySchemas },
    combined: { parents: combinedParents, subcategories: combinedSubs, childCategories: combinedChildren, schemas: combinedSchemas },
    errors,
  };
};

export const seedCoreTaxonomies = async (options?: { dryRun?: boolean; verifyOnly?: boolean }) => {
  console.log('=====================================================================');
  console.log('[Core Taxonomy Seeder] Starting Devotional + Restaurant + Daily Needs + Shopping + Services Seeding');
  console.log('=====================================================================');

  if (options?.verifyOnly) {
    console.log('[Core Taxonomy Seeder] Mode: VERIFY-ONLY');
    const result = await verifyCoreTaxonomies();
    console.log('[Core Taxonomy Seeder] Verification Result:', JSON.stringify(result, null, 2));
    return result;
  }

  if (options?.dryRun) {
    console.log('[Core Taxonomy Seeder] Mode: DRY-RUN');
    const result = await verifyCoreTaxonomies();
    console.log('[Core Taxonomy Seeder] Dry Run Result:', JSON.stringify(result, null, 2));
    return result;
  }

  // 1. Seed Devotional
  await seedDevotionalTaxonomy();

  // 2. Seed Restaurant
  await seedRestaurantTaxonomy();

  // 3. Seed Daily Needs
  await seedDailyNeedsTaxonomy();

  // 4. Seed Shopping
  await seedShoppingTaxonomy();

  // 5. Seed Services
  await seedServicesTaxonomy();

  // 6. Seed Academy
  await seedAcademyTaxonomy();

  // 7. Verify Combined Core
  console.log('\n[Core Taxonomy Seeder] Running Combined Core Integrity Verification...');
  const verificationResult = await verifyCoreTaxonomies();

  console.log('=====================================================================');
  console.log('[Core Taxonomy Seeder] COMBINED VERIFICATION RESULT');
  console.log('=====================================================================');
  console.log(`Passed: ${verificationResult.passed ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Devotional : Parents: ${verificationResult.devotional.parents}, Subs: ${verificationResult.devotional.subcategories}, Children: ${verificationResult.devotional.childCategories}, Schemas: ${verificationResult.devotional.schemas}`);
  console.log(`Restaurant : Parents: ${verificationResult.restaurant.parents}, Subs: ${verificationResult.restaurant.subcategories}, Children: ${verificationResult.restaurant.childCategories}, Schemas: ${verificationResult.restaurant.schemas}`);
  console.log(`Daily Needs: Parents: ${verificationResult.dailyNeeds.parents}, Subs: ${verificationResult.dailyNeeds.subcategories}, Children: ${verificationResult.dailyNeeds.childCategories}, Schemas: ${verificationResult.dailyNeeds.schemas}`);
  console.log(`Shopping   : Parents: ${verificationResult.shopping.parents}, Subs: ${verificationResult.shopping.subcategories}, Children: ${verificationResult.shopping.childCategories}, Schemas: ${verificationResult.shopping.schemas}`);
  console.log(`Services   : Parents: ${verificationResult.services.parents}, Subs: ${verificationResult.services.subcategories}, Children: ${verificationResult.services.childCategories}, Schemas: ${verificationResult.services.schemas}`);
  console.log(`Academy    : Parents: ${verificationResult.academy?.parents || 0}, Subs: ${verificationResult.academy?.subcategories || 0}, Children: ${verificationResult.academy?.childCategories || 0}, Schemas: ${verificationResult.academy?.schemas || 0}`);
  console.log(`Combined   : Parents: ${verificationResult.combined.parents}, Subs: ${verificationResult.combined.subcategories}, Children: ${verificationResult.combined.childCategories}, Schemas: ${verificationResult.combined.schemas}`);

  if (!verificationResult.passed) {
    console.error('[Core Taxonomy Seeder] ERRORS:');
    verificationResult.errors.forEach((e) => console.error(`  - ${e}`));
  }

  return verificationResult;
};

const runCLI = async () => {
  if (require.main === module) {
    try {
      const args = process.argv.slice(2);
      const isDryRun = args.includes('--dry-run');
      const isVerifyOnly = args.includes('--verify-only');

      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      console.log('Connected to MongoDB.');

      const result = await seedCoreTaxonomies({ dryRun: isDryRun, verifyOnly: isVerifyOnly });
      process.exit(result.passed ? 0 : 1);
    } catch (err) {
      console.error('Execution Error:', err);
      process.exit(1);
    }
  }
};

runCLI();
