import assert from 'node:assert/strict';
import { test } from 'node:test';
import { businessWorkspaceKind, indiaDate, isDeliveryDue, nextDate, permittedSubcategories, validDate } from '../services/vendorWorkspaceService';

const vendor = { status: 'active', marketplaceStatus: 'Approved', categories: ['Daily Needs'], approvedSubcategories: ['Milk and Dairy'] };
const categories = [{ _id: 'daily', name: 'Daily Needs', slug: 'daily-needs', level: 1, isActive: true },
  { _id: 'milk', name: 'Milk and Dairy', slug: 'milk-and-dairy', level: 2, parentId: 'daily', isActive: true },
  { _id: 'grocery', name: 'Grocery and Staples', slug: 'grocery-and-staples', level: 2, parentId: 'daily', isActive: true }];

test('only an approved Devotional flower subcategory opens the flower workspace', () => {
  const parent = { _id: 'devotional', name: 'Devotional', slug: 'devotional', level: 1 };
  const flowers = { _id: 'flowers', name: 'Flowers and Garlands', slug: 'flowers-garlands', level: 2, parentId: 'devotional' };
  const kits = { _id: 'kits', name: 'Pooja Kits and Ritual Kits', slug: 'pooja-kits-ritual-kits', level: 2, parentId: 'devotional' };
  const flowerVendor = { ...vendor, categories: ['Devotional'], approvedSubcategories: [] };
  assert.deepEqual(permittedSubcategories(flowerVendor, [parent, flowers, kits], []), []);
  const access = { parentCategoryId: parent._id, status: 'approved', approvedSubcategoryIds: [flowers._id] };
  assert.deepEqual(permittedSubcategories(flowerVendor, [parent, flowers, kits], [access]).map(workspace => [workspace.id, workspace.kind]), [['flowers', 'flowers']]);
  assert.equal(businessWorkspaceKind({ name: 'Daily Needs', slug: 'daily-needs' }, flowers), 'catalog');
});

test('existing milk subcategory opens dairy tools without granting additional access', () => {
  const parent = { name: 'Daily needs', slug: 'daily-needs' };
  for (const name of ['milk', 'Milk and Dairy', 'Milk & Dairy']) {
    assert.equal(businessWorkspaceKind(parent, { name, slug: name === 'milk' ? 'milk' : 'custom-slug' }), 'dairy');
  }
  assert.equal(businessWorkspaceKind({ name: 'Shopping', slug: 'shopping' }, { name: 'milk', slug: 'milk' }), 'catalog');
  const legacyCategories = categories.map(item => item._id === 'milk' ? { ...item, name: 'milk', slug: 'milk' } : item);
  assert.equal(permittedSubcategories({ ...vendor, approvedSubcategories: ['milk'] }, legacyCategories, [])[0].kind, 'dairy');
  assert.equal(permittedSubcategories({ ...vendor, approvedSubcategories: ['milk'] }, legacyCategories.map(item => item._id === 'milk' ? { ...item, name: 'Milk and Dairy' } : item), [])[0].kind, 'dairy');
  assert.deepEqual(permittedSubcategories({ ...vendor, approvedSubcategories: [] }, legacyCategories, []), []);
});

test('approved access is explicit and suspension cannot fall back to profile names', () => {
  assert.deepEqual(permittedSubcategories(vendor, categories, []).map(item => item.id), ['milk']);
  for (const status of ['suspended', 'pending', 'rejected', 'changes_requested']) {
    assert.deepEqual(permittedSubcategories(vendor, categories, [{ parentCategoryId: 'daily', status }]), []);
  }
  assert.deepEqual(permittedSubcategories({ ...vendor, marketplaceStatus: 'Pending Review' }, categories, []), []);
  assert.deepEqual(permittedSubcategories({ ...vendor, status: 'suspended' }, categories, []), []);
  assert.deepEqual(permittedSubcategories({ ...vendor, approvedSubcategories: [] }, categories, []), []);
  const access = [{ parentCategoryId: 'daily', status: 'partially_approved', approvedSubcategoryIds: ['grocery'], restrictions: { canOfferSubscriptions: false } }];
  const permitted = permittedSubcategories(vendor, categories, access);
  assert.deepEqual(permitted.map(item => item.id), ['grocery']);
  assert.equal(permitted[0].canOfferSubscriptions, false);
  assert.deepEqual(permittedSubcategories(vendor, categories.map(item => item._id === 'milk' ? { ...item, isActive: false } : item), []), []);
});

test('services and academy are excluded while approved food remains visible', () => {
  const other = [
    { _id: 'service', name: 'Services', slug: 'services', level: 1 },
    { _id: 'academy', name: 'ApexBee Academy', slug: 'apexbee-academy', level: 1 },
    { _id: 'food', name: 'Food & Dining', slug: 'restaurant', level: 1 },
    { _id: 'repair', name: 'Repair', slug: 'repair', parentId: 'service', level: 2 },
    { _id: 'skills', name: 'Skills', slug: 'skills', parentId: 'academy', level: 2 },
    { _id: 'cafe', name: 'Cafes', slug: 'cafes', parentId: 'food', level: 2 },
  ];
  const result = permittedSubcategories({ ...vendor, categories: ['Services', 'ApexBee Academy', 'Food & Dining'], approvedSubcategories: ['Repair', 'Skills', 'Cafes'] }, other, []);
  assert.deepEqual(result.map(item => [item.id, item.kind]), [['cafe', 'food']]);
  assert.deepEqual(permittedSubcategories({ ...vendor, categories: [], approvedSubcategories: ['Cafes'] }, other, []), []);
});

test('delivery calendar respects start dates frequencies skips and pauses', () => {
  const sub = { status: 'active', startDate: '2026-11-05', frequency: 'daily', skippedDates: [] as string[] };
  assert.equal(isDeliveryDue(sub, '2026-11-04'), false);
  assert.equal(isDeliveryDue(sub, '2026-11-05'), true);
  assert.equal(isDeliveryDue({ ...sub, status: 'paused' }, '2026-11-05'), false);
  assert.equal(isDeliveryDue({ ...sub, skippedDates: ['2026-11-05'] }, '2026-11-05'), false);
  assert.equal(isDeliveryDue(sub, '2026-11-05', true), false);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'alternate' }, '2026-11-06'), false);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'alternate' }, '2026-11-07'), true);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'weekly' }, '2026-11-12'), true);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'weekly' }, '2026-11-13'), false);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'custom', customDays: ['friday'] }, '2026-11-06'), true);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'monthly', startDate: '2026-01-31' }, '2026-02-28'), false);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'monthly' }, '2026-12-05'), true);
  assert.equal(isDeliveryDue({ ...sub, frequency: 'unknown' }, '2026-11-05'), false);
});

test('India dates handle midnight leap days and month boundaries', () => {
  assert.equal(indiaDate(new Date('2026-11-04T18:29:59Z')), '2026-11-04');
  assert.equal(indiaDate(new Date('2026-11-04T18:30:00Z')), '2026-11-05');
  assert.equal(nextDate('2026-11-30'), '2026-12-01');
  assert.equal(nextDate('2028-02-28'), '2028-02-29');
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2026-02-31'), false);
  assert.equal(validDate('2026-1-01'), false);
});
