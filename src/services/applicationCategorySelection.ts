import mongoose from 'mongoose';
import Category from '../models/Category';

export interface RequestedCategorySelection {
  categoryId: string;
  subcategoryIds: string[];
}

export function parseCategorySelections(raw: unknown): RequestedCategorySelection[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20) throw new Error('Select at least one business category.');
  const parents = new Set<string>();
  return raw.map(selection => {
    if (!selection || !mongoose.isValidObjectId(selection.categoryId) || !Array.isArray(selection.subcategoryIds) || !selection.subcategoryIds.length || selection.subcategoryIds.length > 200) {
      throw new Error('Choose at least one valid subcategory under each category.');
    }
    const categoryId = String(selection.categoryId);
    if (parents.has(categoryId)) throw new Error('Duplicate business category.');
    parents.add(categoryId);
    const subcategoryIds: string[] = selection.subcategoryIds.map((id: unknown) => {
      if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw new Error('Invalid subcategory.');
      return id;
    });
    if (new Set(subcategoryIds).size !== subcategoryIds.length) throw new Error('Duplicate subcategory.');
    return { categoryId, subcategoryIds };
  });
}

export async function resolveCategorySelections(raw: unknown) {
  const selections = parseCategorySelections(raw);
  const ids = selections.flatMap(selection => [selection.categoryId, ...selection.subcategoryIds]);
  const categories = await Category.find({ _id: { $in: ids }, isActive: true }).select('_id name slug level parentId').lean();
  const byId = new Map(categories.map(category => [String(category._id), category]));
  const names: string[] = [];
  const subcategoryNames: string[] = [];
  for (const selection of selections) {
    const parent = byId.get(selection.categoryId);
    if (!parent || parent.level !== 1 || ['services', 'apexbee-academy', 'academy'].includes(parent.slug) || ['services', 'apexbee academy'].includes(parent.name.toLowerCase())) {
      throw new Error('A selected category is not available for vendor applications.');
    }
    names.push(parent.name);
    for (const id of selection.subcategoryIds) {
      const child = byId.get(id);
      if (!child || child.level !== 2 || String(child.parentId) !== selection.categoryId) throw new Error('A selected subcategory does not belong to its category or is no longer available.');
      subcategoryNames.push(child.name);
    }
  }
  return { selections, names, subcategoryNames };
}
