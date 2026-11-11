import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCategorySeedPlan } from '../seeds/seedVendorApplicationCategories';

test('category seed reuses existing parent and milk identities and is repeatable', () => {
  const definitions = [{ name: 'Daily Needs', slug: 'daily-needs', supportedItemTypes: ['product'],
    subcategories: [{ name: 'Milk and Dairy', slug: 'milk-and-dairy', aliases: ['milk'] }, { name: 'Grocery and Staples', slug: 'grocery-and-staples' }] }];
  const existing = [{ _id: 'daily-id', level: 1, name: 'Daily needs', slug: 'daily-needs', parentId: null, description: 'User description' },
    { _id: 'milk-id', level: 2, name: 'milk', slug: 'milk', parentId: 'daily-id', image: 'existing-image' },
    { _id: 'other-id', level: 1, name: 'Other', slug: 'other', parentId: null }];
  const plan = createCategorySeedPlan(definitions, existing);
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.inserts[0].level, 2);
  assert.equal(String(plan.inserts[0].parentId), 'daily-id');
  assert.equal(plan.targets.find(item => item.name === 'Milk and Dairy')?._id, 'milk-id');
  assert.equal(plan.targets.find(item => item.name === 'Milk and Dairy')?.slug, 'milk');
  assert.equal(plan.targets.find(item => item.name === 'Milk and Dairy')?.image, 'existing-image');
  assert.equal(plan.targets[0].description, 'User description');
  assert.equal(plan.renames.length, 2);
  const saved = [...existing.map(item => ({ ...item, name: plan.renames.find(rename => rename.id === item._id)?.to || item.name })), ...plan.inserts];
  const repeat = createCategorySeedPlan(definitions, saved);
  assert.equal(repeat.inserts.length, 0);
  assert.equal(repeat.renames.length, 0);
  assert.equal(existing[0].name, 'Daily needs');
});

test('category seed refuses ambiguous matches and cross-parent slug collisions', () => {
  const definition = [{ name: 'Daily Needs', slug: 'daily-needs', supportedItemTypes: ['product'], subcategories: [{ name: 'Milk and Dairy', slug: 'milk-and-dairy', aliases: ['milk'] }] }];
  assert.throws(() => createCategorySeedPlan(definition, [{ _id: 'wrong', name: 'Other', slug: 'daily-needs', level: 2, parentId: 'different-parent' }]), /Slug conflict/);
  assert.throws(() => createCategorySeedPlan(definition, [{ _id: 'daily', name: 'Daily Needs', slug: 'daily-needs', level: 1 },
    { _id: 'milk1', name: 'milk', slug: 'milk', level: 2, parentId: 'daily' },
    { _id: 'milk2', name: 'milk', slug: 'other-milk', level: 2, parentId: 'daily' }]), /Multiple existing matches/);
});
