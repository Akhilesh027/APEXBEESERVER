import Category from '../models/Category';
import CategoryExperienceConfig from '../models/CategoryExperienceConfig';

export interface IAcademyTaxonomyResult {
  passed: boolean;
  parentCount: number;
  subCount: number;
  childCount: number;
  configCount: number;
  duplicateConfigs: number;
  duplicateSlugs: number;
  orphans: number;
  errors: string[];
}

export const verifyAcademyTaxonomy = async (): Promise<IAcademyTaxonomyResult> => {
  const errors: string[] = [];

  // 1. Fetch Academy parent category
  const parent = await Category.findOne({ slug: 'apexbee-academy', level: 1 });
  const parentCount = parent ? 1 : 0;
  if (!parent) {
    errors.push('Academy parent category not found.');
  }

  // 2. Fetch subcategories
  let subCount = 0;
  let subIds: any[] = [];
  if (parent) {
    const subs = await Category.find({ parentId: parent._id, level: 2 });
    subCount = subs.length;
    subIds = subs.map(s => s._id);
    if (subCount !== 2) {
      errors.push(`Expected 2 subcategories, found ${subCount}.`);
    }
  }

  // 3. Child categories check (must be 0)
  let childCount = 0;
  if (subIds.length > 0) {
    childCount = await Category.countDocuments({ parentId: { $in: subIds }, level: 3 });
    if (childCount !== 0) {
      errors.push(`Expected 0 child categories, found ${childCount}.`);
    }
  }

  // 4. Experience config counts
  const categoryIds = parent ? [parent._id, ...subIds] : [];
  const configs = await CategoryExperienceConfig.find({ categoryId: { $in: categoryIds } });
  const configCount = configs.length;

  if (parent && configCount !== 1 + subIds.length) {
    errors.push(`Expected ${1 + subIds.length} experience configs, found ${configCount}.`);
  }

  // Ensure duplicate configs = 0
  const uniqueCategoryIds = new Set(configs.map(c => c.categoryId.toString()));
  const duplicateConfigs = configs.length - uniqueCategoryIds.size;
  if (duplicateConfigs > 0) {
    errors.push(`Found ${duplicateConfigs} duplicate experience configs.`);
  }

  // Ensure duplicate slugs = 0 under academy category space
  const slugs = await Category.find({ _id: { $in: categoryIds } }).select('slug');
  const uniqueSlugs = new Set(slugs.map(s => s.slug));
  const duplicateSlugs = slugs.length - uniqueSlugs.size;
  if (duplicateSlugs > 0) {
    errors.push(`Found ${duplicateSlugs} duplicate slugs in academy categories.`);
  }

  // Ensure orphans = 0 (Academy subcategories with invalid or missing parent)
  let orphans = 0;
  if (parent) {
    const subsWithParentMismatch = await Category.find({
      level: 2,
      slug: { $in: ['become-an-entrepreneur', 'skill-development'] },
      parentId: { $ne: parent._id }
    });
    orphans = subsWithParentMismatch.length;
    if (orphans > 0) {
      errors.push(`Found ${orphans} orphan subcategories under academy.`);
    }
  }

  return {
    passed: errors.length === 0,
    parentCount,
    subCount,
    childCount,
    configCount,
    duplicateConfigs,
    duplicateSlugs,
    orphans,
    errors,
  };
};

export default verifyAcademyTaxonomy;
