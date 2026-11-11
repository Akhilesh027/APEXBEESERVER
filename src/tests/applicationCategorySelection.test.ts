import assert from 'node:assert/strict';
import { test } from 'node:test';
import Category from '../models/Category';
import { parseCategorySelections, resolveCategorySelections } from '../services/applicationCategorySelection';

const parentId = '507f1f77bcf86cd799439011';
const childId = '507f1f77bcf86cd799439012';
const otherId = '507f1f77bcf86cd799439013';
const selection = [{ categoryId: parentId, subcategoryIds: [childId] }];

test('category requests require valid ids and at least one child for each parent', () => {
  for (const value of [null, [], [{}], [{ categoryId: parentId, subcategoryIds: [] }], [{ categoryId: 'daily-needs', subcategoryIds: [childId] }], [{ categoryId: parentId, subcategoryIds: ['Milk and Dairy'] }]]) {
    assert.throws(() => parseCategorySelections(value));
  }
  assert.throws(() => parseCategorySelections([...selection, ...selection]));
  assert.throws(() => parseCategorySelections([{ categoryId: parentId, subcategoryIds: [childId, childId] }]));
  assert.deepEqual(parseCategorySelections(selection), selection);
});

test('resolve trusted names and reject unavailable or incorrectly grouped selections', async () => {
  const originalFind = Category.find;
  let records: any[] = [];
  (Category as any).find = (filter: any) => {
    assert.equal(filter.isActive, true);
    return { select: () => ({ lean: async () => records }) };
  };
  try {
    records = [{ _id: parentId, name: 'Daily Needs', slug: 'daily-needs', level: 1 },
      { _id: childId, name: 'Eggs, Meat and Seafood', level: 2, parentId }];
    const resolved = await resolveCategorySelections(selection);
    assert.deepEqual(resolved.names, ['Daily Needs']);
    assert.deepEqual(resolved.subcategoryNames, ['Eggs, Meat and Seafood']);
    records[1].parentId = otherId;
    await assert.rejects(resolveCategorySelections(selection), /does not belong/);
    records = records.slice(0, 1);
    await assert.rejects(resolveCategorySelections(selection), /no longer available/);
    records[0] = { _id: parentId, name: 'Services', slug: 'services', level: 1 };
    await assert.rejects(resolveCategorySelections(selection), /not available/);
    records[0] = { _id: parentId, name: 'ApexBee Academy', slug: 'apexbee-academy', level: 1 };
    await assert.rejects(resolveCategorySelections(selection), /not available/);
    records = [{ _id: parentId, name: 'Food & Dining', slug: 'restaurant', level: 1 },
      { _id: childId, name: 'Restaurants and Dining', level: 2, parentId }];
    assert.deepEqual((await resolveCategorySelections(selection)).names, ['Food & Dining']);
  } finally { Category.find = originalFind; }
});
