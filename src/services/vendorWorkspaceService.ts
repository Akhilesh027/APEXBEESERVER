import Category from '../models/Category';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import { dailyNeedsProfile, type DailyNeedsProfile } from './dailyNeedsProfile';

export const indiaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function nextDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export function isDeliveryDue(sub: { status: string; startDate: string; frequency: string; scheduleVersion?: number; customDays?: string[]; skippedDates?: string[]; currentPeriodEnd?: string; autoRenew?: boolean }, date: string, holiday = false) {
  if (!validDate(date) || !validDate(sub.startDate) || sub.status !== 'active' || sub.startDate > date || holiday || sub.skippedDates?.includes(date) ||
    (sub.autoRenew === false && sub.currentPeriodEnd && date > sub.currentPeriodEnd)) return false;
  const day = new Date(`${date}T00:00:00Z`);
  const start = new Date(`${sub.startDate}T00:00:00Z`);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (sub.frequency) {
    case 'daily': return true;
    case 'alternate': return ((day.getTime() - start.getTime()) / 86400000) % 2 === 0;
    case 'weekly': return day.getUTCDay() === start.getUTCDay();
    case 'monthly': return day.getUTCDate() === (sub.scheduleVersion === 2
      ? Math.min(start.getUTCDate(), new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate())
      : start.getUTCDate());
    case 'custom': return !!sub.customDays?.some(value => {
      const normalized = value.trim().toLowerCase(); const weekday = weekdays[day.getUTCDay()].toLowerCase();
      return normalized === weekday || normalized === weekday.slice(0, 3);
    });
    default: return false;
  }
}

export type BusinessWorkspace = {
  id: string; categoryId: string; categoryName: string; name: string; slug: string;
  kind: 'dairy' | 'food' | 'flowers' | 'catalog'; canOfferSubscriptions: boolean;
  dailyNeedsProfile?: DailyNeedsProfile;
};

const categoryKey = (value: string = '') => value.toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function isWaterWorkspace(workspace: { categoryName?: string; name?: string; slug?: string }) {
  return ['daily-needs', 'daily-needs-and-grocery', 'daily-needs-grocery'].includes(categoryKey(workspace.categoryName)) &&
    [workspace.name, workspace.slug].some(value => ['water-cans', 'water-and-hydration', 'water-hydration', 'drinking-water'].includes(categoryKey(value)));
}

export function businessWorkspaceKind(parent: { name: string; slug: string }, child: { name: string; slug: string }): BusinessWorkspace['kind'] {
  const parentKeys = [categoryKey(parent.slug), categoryKey(parent.name)];
  const childKeys = [categoryKey(child.slug), categoryKey(child.name)];
  if (parentKeys.some(key => ['restaurant', 'food-and-dining', 'food-dining'].includes(key))) return 'food';
  if (parentKeys.includes('devotional') && childKeys.some(key => ['flowers-garlands', 'flowers-and-garlands'].includes(key))) return 'flowers';
  if (parentKeys.some(key => ['daily-needs', 'daily-needs-and-grocery', 'daily-needs-grocery'].includes(key)) &&
    childKeys.some(key => ['milk', 'milk-and-dairy', 'milk-dairy'].includes(key))) return 'dairy';
  return 'catalog';
}

// An explicit suspended/rejected/pending access record always overrides legacy profile fields.
export function permittedSubcategories(vendor: any, categories: any[], accessRecords: any[]): BusinessWorkspace[] {
  if (vendor.status !== 'active' || vendor.marketplaceStatus !== 'Approved') return [];
  const approvedNames = new Set((vendor.approvedSubcategories || []).map((name: string) => name.toLowerCase().trim()));
  const parentIds = new Set((vendor.allowedCategories || []).map(String));
  const parentNames = new Set((vendor.categories || [vendor.primaryCategory || vendor.category]).filter(Boolean).map((name: string) => name.toLowerCase().trim()));
  return categories.filter(category => category.level === 2 && category.isActive !== false).flatMap(child => {
    const parent = categories.find(category => String(category._id) === String(child.parentId) && category.level === 1 && category.isActive !== false);
    if (!parent || ['services', 'apexbee-academy', 'academy'].includes(parent.slug)) return [];
    const access = accessRecords.find(record => String(record.parentCategoryId) === String(parent._id));
    if (!access && !parentIds.has(String(parent._id)) && !parentNames.has(parent.name.toLowerCase().trim())) return [];
    if (access && !['approved', 'partially_approved'].includes(access.status)) return [];
    const explicitIds = (access?.approvedSubcategoryIds || []).map(String);
    const approved = explicitIds.length
      ? explicitIds.includes(String(child._id))
      : approvedNames.has(child.name.toLowerCase().trim()) || (businessWorkspaceKind(parent, child) === 'dairy' && child.slug === 'milk' && approvedNames.has('milk'));
    if (!approved) return [];
    return [{ id: String(child._id), categoryId: String(parent._id), categoryName: parent.name, name: child.name, slug: child.slug,
      kind: businessWorkspaceKind(parent, child),
      dailyNeedsProfile: dailyNeedsProfile({ categoryName: parent.name, name: child.name, slug: child.slug }),
      canOfferSubscriptions: access ? access.restrictions?.canOfferSubscriptions === true : true }];
  });
}

export async function approvedWorkspaces(vendor: any) {
  const [categories, records] = await Promise.all([
    Category.find({ level: { $in: [1, 2] } }).select('_id name slug level parentId isActive').lean(),
    VendorCategoryAccess.find({ vendorId: vendor._id }).lean(),
  ]);
  return permittedSubcategories(vendor, categories, records);
}
