export type DailyNeedsProfile = 'produce' | 'grocery' | 'organic';

const normalize = (value = '') => value.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dailyNeeds = new Set(['daily-needs', 'daily-needs-and-grocery', 'daily-needs-grocery']);
const profiles: Record<string, DailyNeedsProfile> = {
  'fruits-and-vegetables': 'produce', 'fruits-vegetables': 'produce',
  grocery: 'grocery', groceries: 'grocery', 'grocery-and-staples': 'grocery', 'grocery-staples': 'grocery',
  'organic-and-healthy-foods': 'organic', 'organic-healthy-foods': 'organic',
};

export function dailyNeedsProfile(workspace: {categoryName?: string; name?: string; slug?: string}) {
  if (!dailyNeeds.has(normalize(workspace.categoryName))) return undefined;
  return profiles[normalize(workspace.slug)] || profiles[normalize(workspace.name)];
}

export function stockUnit(attributes: any): string {
  const flowerUnits: Record<string, string> = { Grams: 'g', Kg: 'kg', 'Garland Length (Meters)': 'm', Strings: 'strings', Pieces: 'pieces' };
  const unit = attributes?.stock_unit || attributes?.unit || (attributes?.flower_type ? flowerUnits[attributes.selling_unit] : undefined);
  return typeof unit === 'string' && unit.trim() ? unit.trim() : 'sellable units';
}
