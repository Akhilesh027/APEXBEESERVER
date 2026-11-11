import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { DairySummaryService } from '../services/DairySummaryService';
import { Vendor } from '../models/Vendor';
import Category from '../models/Category';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import Product from '../models/Product';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { BusinessApplication } from '../models/BusinessApplication';
import { BusinessCalendar } from '../models/BusinessCalendar';
import Notification from '../models/Notification';
import { DairyRequirementSummary } from '../models/DairyOperations';
import { StockBatch } from '../models/StockBatch';

test('the 6 PM India job records tomorrow requirements once, excludes paused and skipped plans and sends one in-app notification', async () => {
  const original: Array<[any, string, any]> = [], mock = (object: any, key: string, value: any) => { original.push([object, key, object[key]]); object[key] = value; };
  const query = (value: any) => { const q: any = { select: () => q, sort: () => q, lean: async () => value, session: () => q, then: (resolve: any, reject: any) => Promise.resolve(value).then(resolve, reject) }; return q; };
  const vendor: any = { _id: 'vendor', userId: 'vendor-user', categories: ['Daily Needs'], approvedSubcategories: ['Milk and Dairy'], status: 'active', marketplaceStatus: 'Approved' };
  let saved = false, vendorReads = 0, notifications = 0, writes = 0, kit = false;
  try {
    mock(Vendor, 'find', async () => { vendorReads++; return [vendor]; });
    mock(Category, 'find', () => query([{ _id: 'daily', name: 'Daily Needs', slug: 'daily-needs', level: 1 }, { _id: 'milk', name: 'Milk and Dairy', slug: 'milk', level: 2, parentId: 'daily' }]));
    mock(VendorCategoryAccess, 'find', () => query([]));
    mock(Product, 'find', (filter:any) => query(filter._id ? [{_id:'component',sellerId:'vendor',name:'Milk 1 L',dairyDetails:{packSize:1000,packUnit:'ml'}}] : [{ _id: 'product',sellerId:'vendor', name: 'Milk 500 ml', stock: 10, dairyDetails: { packSize: 500, packUnit: 'ml', expiryDate: '2026-11-08' },...(kit ? {bundleComponents:[{productId:'component',quantity:3}]} : {}) }]));
    const sub = { productId: 'product', status: 'active', startDate: '2026-11-06', frequency: 'daily', quantity: 2 };
    mock(LocalShopSubscription, 'find', () => query([sub, { ...sub, status: 'paused' }, { ...sub, skippedDates: ['2026-11-06'] }]));
    mock(BusinessApplication, 'findOne', () => query({ businessDetails: { dairy: { weeklyHoliday: 'None' } } }));
    mock(BusinessCalendar, 'exists', () => query(null)); mock(StockBatch, 'find', () => query([]));
    mock(DairyRequirementSummary, 'exists', () => query(saved ? { _id: 'summary' } : null));
    mock(mongoose, 'startSession', async () => ({ withTransaction: async (run: any) => run(), endSession: async () => {} }));
    mock(Notification, 'create', async (items: any[]) => { assert.equal(items[0].recipientId, 'vendor-user'); assert.match(items[0].message, kit ? /1 deliveries · 6 packs · 6 recorded litres/ : /1 deliveries · 2 packs · 1 recorded litres/); assert.match(items[0].deepLink, /workspaceId=milk/); notifications++; return [{ _id: 'notification' }]; });
    mock(DairyRequirementSummary, 'create', async (items: any[]) => { assert.equal(items[0].date, '2026-11-06'); assert.equal(items[0].deliveries, 1); assert.equal(items[0].packs, kit ? 6 : 2); assert.equal(items[0].litres, kit ? 6 : 1); if(kit) assert.equal(items[0].items[0].productId,'component'); saved = true; writes++; });
    assert.equal((await DairySummaryService.run(new Date('2026-11-05T12:29:59Z'))).generated, 0); assert.equal(vendorReads, 0);
    assert.equal((await DairySummaryService.run(new Date('2026-11-05T12:30:00Z'))).generated, 1);
    assert.equal((await DairySummaryService.run(new Date('2026-11-05T13:30:00Z'))).generated, 0);
    assert.equal(notifications, 1); assert.equal(writes, 1);
    kit = true; saved = false;
    assert.equal((await DairySummaryService.run(new Date('2026-11-05T14:30:00Z'))).generated,1);
    assert.equal(writes,2);
  } finally { for (const [object, key, value] of original.reverse()) object[key] = value; }
});
