export function mergeVendorBusinessAccess(existing: any, next: any) {
  const unique = (values: any[]) => [...new Map(values.filter(Boolean).map(value => [String(value), value])).values()];
  return { ...next, categories: unique([...(existing.categories || []), ...(next.categories || [])]),
    allowedCategories: unique([...(existing.allowedCategories || []), ...(next.allowedCategories || [])]),
    approvedSubcategories: unique([...(existing.approvedSubcategories || []), ...(next.approvedSubcategories || [])]),
    subCategories: unique([...(existing.subCategories || existing.approvedSubcategories || []), ...(next.subCategories || [])]),
    category: unique([...(existing.categories || []), ...(next.categories || [])]).join(', '),
    primaryCategory: existing.primaryCategory || next.primaryCategory, subCategory: existing.subCategory || next.subCategory };
}
