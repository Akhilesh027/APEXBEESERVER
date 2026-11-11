import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ClientSession } from 'mongoose';
import Category from '../models/Category';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import type { IVendor } from '../models/Vendor';
import { resolveVendorCategoryGovernance, saveVendorCategoryAccess } from '../services/vendorCategoryGovernance';
import { permittedSubcategories } from '../services/vendorWorkspaceService';

const taxonomy = [
  { _id: 'daily', name: 'Daily Needs', slug: 'daily-needs', level: 1 },
  { _id: 'milk', name: 'Milk and Dairy', slug: 'milk-and-dairy', level: 2, parentId: 'daily' },
  { _id: 'water', name: 'Water Cans', slug: 'water-cans', level: 2, parentId: 'daily' },
  { _id: 'shopping', name: 'Shopping', slug: 'shopping', level: 1 },
  { _id: 'clothing', name: 'Clothing', slug: 'clothing', level: 2, parentId: 'shopping' },
];

test('admin category edits only accept active subcategories under the selected parents', () => {
  assert.throws(() => resolveVendorCategoryGovernance({ allowedCategories: ['daily'], approvedSubcategories: ['Clothing'] }, taxonomy), /active subcategory/);
  assert.throws(() => resolveVendorCategoryGovernance({ allowedCategories: ['daily'], approvedSubcategories: ['Custom Name'] }, taxonomy), /active subcategory/);
  assert.equal(resolveVendorCategoryGovernance({ allowedCategories: ['daily'], approvedSubcategories: ['Milk & Dairy'] }, taxonomy).subcategories?.[0]._id, 'milk');
});

test('saving new subcategories replaces stale approved IDs and the workspace reflects additions and removals', async context => {
  const session = {} as ClientSession;
  const vendor = { _id: 'vendor', status: 'active', marketplaceStatus: 'Approved', categories: ['Daily Needs'], approvedSubcategories: ['Milk and Dairy'],
    save: async (options: { session: ClientSession }) => assert.equal(options.session, session),
  } as unknown as IVendor;
  const access = { parentCategoryId: 'daily', status: 'approved', approvedSubcategoryIds: ['milk'], restrictions: { canOfferSubscriptions: false } };
  const query = { select: () => query, session: () => query, lean: async () => taxonomy };
  context.mock.method(Category, 'find', () => query);
  context.mock.method(VendorCategoryAccess, 'findOneAndUpdate', async (filter: any, update: any, options: any) => {
    assert.equal(filter.parentCategoryId, 'daily');
    assert.equal(options.session, session);
    assert.equal(update.$set.restrictions, undefined);
    Object.assign(access, update.$set);
  });
  context.mock.method(VendorCategoryAccess, 'updateMany', async (filter: any) => {
    assert.deepEqual(filter.parentCategoryId.$nin, ['daily']);
  });
  await saveVendorCategoryAccess(vendor, { allowedCategories: ['daily'], approvedSubcategories: ['Water Cans'] }, session);
  assert.deepEqual(permittedSubcategories(vendor, taxonomy, [access]).map(workspace => workspace.id), ['water']);
  assert.equal(permittedSubcategories(vendor, taxonomy, [access])[0].canOfferSubscriptions, false);
  await saveVendorCategoryAccess(vendor, { allowedCategories: ['daily'], approvedSubcategories: [] }, session);
  assert.deepEqual(access.approvedSubcategoryIds, []);
  assert.deepEqual(permittedSubcategories(vendor, taxonomy, [access]), []);
});
