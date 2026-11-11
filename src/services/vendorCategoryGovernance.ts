import type { ClientSession } from 'mongoose';
import Category from '../models/Category';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import type { IVendor } from '../models/Vendor';

type TaxonomyCategory = { _id: unknown; name: string; slug: string; level: number; parentId?: unknown; isActive?: boolean };

export class CategoryGovernanceInputError extends Error {}

function categoryKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function resolveSelection<T extends TaxonomyCategory>(values: unknown[], choices: T[], label: string) {
  const selected = new Map<string, T>();
  for (const value of values) {
    const key = categoryKey(value);
    const matches = choices.filter(choice => String(choice._id) === String(value) || [choice.name, choice.slug].some(name => categoryKey(name) === key));
    if (matches.length !== 1) throw new CategoryGovernanceInputError(`Choose an active ${label} from the selected catalog categories: ${String(value)}.`);
    selected.set(String(matches[0]._id), matches[0]);
  }
  return [...selected.values()];
}

export function resolveVendorCategoryGovernance<T extends TaxonomyCategory>(body: any, taxonomy: T[], retainedIds: string[] = []) {
  const active = taxonomy.filter(category => category.isActive !== false);
  const parentInputs = Array.isArray(body.allowedCategories) && body.allowedCategories.length
    ? body.allowedCategories.map((value: any) => value?._id ?? value)
    : Array.isArray(body.categories) ? body.categories : String(body.primaryCategory || body.category || '').split(',').map(value => value.trim()).filter(Boolean);
  const parents = resolveSelection(parentInputs, active.filter(category => category.level === 1), 'category');
  if (!parents.length) throw new CategoryGovernanceInputError('Select at least one category.');
  const parentIds = new Set(parents.map(parent => String(parent._id)));
  const available = active.filter(category => category.level === 2 && parentIds.has(String(category.parentId)));
  const subcategoryInputs = body.approvedSubcategories === undefined && body.subCategory ? [body.subCategory] : body.approvedSubcategories;
  const selected = subcategoryInputs === undefined ? undefined : resolveSelection(
    Array.isArray(subcategoryInputs) ? subcategoryInputs : [subcategoryInputs], available, 'subcategory',
  );
  const primary = parents.find(parent => [parent.name, parent.slug, parent._id].some(value => categoryKey(value) === categoryKey(body.primaryCategory))) ?? parents[0];
  const retained = available.filter(child => retainedIds.includes(String(child._id)));
  const subcategories = selected || retainedIds.length ? [...new Map([...(selected || []), ...retained].map(child => [String(child._id), child])).values()] : undefined;
  return { parents, primary, subcategories };
}

export async function saveVendorCategoryAccess(vendor: IVendor, body: any, session: ClientSession, preserve?: { removeSubcategory?: string }) {
  const taxonomy = await Category.find({ level: { $in: [1, 2] } }).select('_id name slug level parentId isActive').session(session).lean();
  const existing = preserve ? await VendorCategoryAccess.find({ vendorId: vendor._id }).session(session).lean() : [];
  const allowedParentIds = new Set((vendor.allowedCategories || []).map(String));
  const allowedParentNames = new Set((vendor.categories || []).map(categoryKey));
  const legacyNames = new Set((vendor.approvedSubcategories || []).map(categoryKey));
  const retainedIds = taxonomy.filter(child => {
    const name = categoryKey(child.name);
    if (!preserve || child.level !== 2 || name === categoryKey(preserve.removeSubcategory)) return false;
    const access = existing.find(row => String(row.parentCategoryId) === String(child.parentId));
    if (access) {
      if (!['approved', 'partially_approved'].includes(access.status)) return false;
      return access.approvedSubcategoryIds?.length ? access.approvedSubcategoryIds.some(id => String(id) === String(child._id)) : legacyNames.has(name);
    }
    const parent = taxonomy.find(row => String(row._id) === String(child.parentId));
    return legacyNames.has(name) && !!parent && (allowedParentIds.has(String(parent._id)) || allowedParentNames.has(categoryKey(parent.name)));
  }).map(child => String(child._id));
  const { parents, primary, subcategories } = resolveVendorCategoryGovernance(body, taxonomy, retainedIds);
  const categories = parents.map(parent => parent.name);
  const allowedCategories = parents.map(parent => parent._id);
  const subcategoryFields = subcategories ? {
    subCategory: subcategories[0]?.name ?? '',
    approvedSubcategories: subcategories.map(child => child.name),
  } : {};
  const categoryFields = { categories, category: categories.join(', '), primaryCategory: primary.name, ...subcategoryFields };
  Object.assign(vendor, categoryFields, { allowedCategories });
  if (subcategories) vendor.subCategories = subcategories.map(child => child.name);
  await vendor.save({ session });

  for (const parent of parents) {
    const children = subcategories?.filter(child => String(child.parentId) === String(parent._id));
    await VendorCategoryAccess.findOneAndUpdate(
      { vendorId: vendor._id, parentCategoryId: parent._id },
      {
        $set: {
          storeId: vendor._id, status: 'approved', approvedAt: new Date(),
          ...(children ? { approvedSubcategoryIds: children.map(child => child._id) } : {}),
        },
        $setOnInsert: {
          approvedCapabilities: ['general_store', 'retail_store', 'shopping_store', 'pooja_store'],
          approvedItemTypes: ['product', 'service'],
          restrictions: { canCreateProducts: true, canCreateServices: true, canJoinFestivalCombos: true,
            canAcceptBulkOrders: true, canSellWholesale: true, canOfferSubscriptions: true },
        },
      },
      { upsert: true, session, runValidators: true },
    );
  }
  await VendorCategoryAccess.updateMany(
    { vendorId: vendor._id, parentCategoryId: { $nin: allowedCategories } },
    { $set: { status: 'rejected' } }, { session },
  );
  return { ...categoryFields, allowedCategories, subCategory: vendor.subCategory, approvedSubcategories: vendor.approvedSubcategories };
}
