import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { activateAdditionalVendorAccess } from '../services/additionalVendorActivation';
import { BusinessApplication } from '../models/BusinessApplication';
import { Vendor } from '../models/Vendor';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import Category from '../models/Category';
import Notification from '../models/Notification';

test('additional-category verification preserves profile, bank data and old permissions and grants only reviewed businesses once', async () => {
  const original: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { original.push([object, key, object[key]]); object[key] = value; };
  const session = { withTransaction: async (run: any) => run(), endSession: async () => {} };
  const query = (value: any) => { const q: any = { session: () => q, select: () => q, lean: async () => value, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) }; return q; };
  let grants = 0, notices = 0;
  const vendor: any = { _id: 'vendor', userId: 'owner', status: 'active', marketplaceStatus: 'Approved', businessName: 'Original store', address: 'Original address', bankAccounts: [{ id: 'existing-bank' }], categories: ['Daily Needs'], allowedCategories: ['daily'], primaryCategory: 'Daily Needs', subCategory: 'Milk and Dairy', approvedSubcategories: ['Milk and Dairy'], save: async (options: any) => assert.equal(options.session, session) };
  const app: any = { _id: 'application', userId: 'owner', applicationType: 'vendor', isAdditionalCategoryApplication: true, status: 'kyc_submitted', kycStatus: 'pending', requestedSubcategories: ['Grocery and Staples', 'Flowers and Garlands'], subcategoryDecisions: [{ subcategoryName: 'Grocery and Staples', status: 'approved' }, { subcategoryName: 'Flowers and Garlands', status: 'pending' }], categorySelections: [{ subcategoryIds: ['grocery', 'flowers'] }], save: async (options: any) => assert.equal(options.session, session) };
  try {
    mock(mongoose, 'startSession', async () => session); mock(BusinessApplication, 'findById', () => query(app)); mock(Vendor, 'findOne', () => query(vendor));
    mock(Category, 'find', (filter: any) => query(filter.level === 2 ? [{ _id: 'grocery', parentId: 'daily', name: 'Grocery and Staples' }] : [{ _id: 'daily', name: 'Daily Needs' }]));
    mock(VendorCategoryAccess, 'findOne', () => query({ status: 'approved', approvedSubcategoryIds: ['milk'], restrictions: { canOfferSubscriptions: false } }));
    mock(VendorCategoryAccess, 'findOneAndUpdate', async (filter: any, update: any, options: any) => { assert.equal(filter.vendorId, 'vendor'); assert.equal(options.session, session); assert.deepEqual(update.$set.approvedSubcategoryIds, ['milk', 'grocery']); assert.equal(update.$set.restrictions.canOfferSubscriptions, false); grants++; });
    mock(Notification, 'create', async (items: any[], options: any) => { assert.equal(options.session, session); assert.equal(items[0].recipientId, 'owner'); notices++; });
    await activateAdditionalVendorAccess('application');
    assert.equal(vendor.businessName, 'Original store'); assert.equal(vendor.address, 'Original address'); assert.deepEqual(vendor.bankAccounts, [{ id: 'existing-bank' }]);
    assert.deepEqual(vendor.approvedSubcategories, ['Milk and Dairy', 'Grocery and Staples']); assert.equal(vendor.subCategory, 'Milk and Dairy');
    assert.equal(app.status, 'verified'); assert.equal(app.kycStatus, 'verified'); assert.equal(grants, 1); assert.equal(notices, 1);
    await activateAdditionalVendorAccess('application'); assert.equal(grants, 1); assert.equal(notices, 1);
    app.status = 'pending'; await assert.rejects(activateAdditionalVendorAccess('application'), /document submission/);
    app.status = 'kyc_submitted'; app.kycStatus = 'pending'; vendor.status = 'suspended'; await assert.rejects(activateAdditionalVendorAccess('application'), /active and approved/);
  } finally { for (const [object, key, value] of original.reverse()) object[key] = value; }
});
