import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import router from '../routes/vendorWorkspaceRoutes';
import { Vendor } from '../models/Vendor';
import Category from '../models/Category';
import Product from '../models/Product';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { BusinessApplication } from '../models/BusinessApplication';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { User } from '../models/User';
import { indiaDate } from '../services/vendorWorkspaceService';

test('vendor daily plans retain billing cycles and required litres exclude pauses and skips', async () => {
  const user = '507f1f77bcf86cd799439011', vendor = '507f1f77bcf86cd799439012', parent = '507f1f77bcf86cd799439013', milk = '507f1f77bcf86cd799439014', product = '507f1f77bcf86cd799439015';
  const originals: Array<[any, string, any]> = [];
  const mock = (model: any, method: string, replacement: any) => { originals.push([model, method, model[method]]); model[method] = replacement; };
  const query = (value: any) => { const result: any = { select: () => result, sort: () => result, lean: async () => value }; return result; };
  try {
    mock(Vendor, 'findOne', async () => ({ _id: vendor, userId: user, status: 'active', marketplaceStatus: 'Approved', categories: ['Daily Needs'], approvedSubcategories: ['Milk and Dairy'] }));
    mock(Category, 'find', (filter: any) => query(filter.parentId ? [] : [
      { _id: parent, level: 1, name: 'Daily Needs', slug: 'daily-needs' },
      { _id: milk, parentId: parent, level: 2, name: 'Milk and Dairy', slug: 'milk' },
    ]));
    mock(VendorCategoryAccess, 'find', () => query([]));
    let combo = false;
    mock(Product, 'find', (filter:any) => query(filter._id ? [{_id:'component',sellerId:vendor,name:'Milk component',dairyDetails:{packSize:1000,packUnit:'ml'}}] : [{ _id: product,sellerId:vendor, name: 'Cow Milk 500 ml', stock: 20, dairyDetails: { packSize: 500, packUnit: 'ml' },...(combo ? {bundleComponents:[{productId:'component',quantity:3}]} : {}) }]));
    const base = { productId: product, productName: 'Cow Milk 500 ml', vendorId: vendor, userId: user, quantity: 2, unitPrice: 30, scheduleVersion: 2, billingCycle: 'weekly', frequency: 'daily', startDate: '2026-11-05', status: 'active', skippedDates: [], deliverySlot: 'Morning' };
    mock(LocalShopSubscription, 'find', () => query([{ ...base, _id: 'active' }, { ...base, _id: 'paused', quantity: 10, status: 'paused' }, { ...base, _id: 'skipped', quantity: 3, skippedDates: ['2026-11-06'] }, { ...base, _id: 'expired', status: 'expired', currentPeriodEnd: '2026-11-04', autoRenew: false }]));
    mock(BusinessApplication, 'findOne', () => query({ businessDetails: { dairy: { weeklyHoliday: 'None' } } }));
    mock(BusinessCalendar, 'find', () => query([]));
    mock(SubscriptionDeliveryTask, 'find', (filter: any) => query(filter.fundingReminderDate ? [{ subscriptionId: 'active', date: indiaDate() }] : []));
    mock(User, 'find', () => query([]));
    const app = express(); app.use(express.json()); app.use('/workspace', router);
    const token = jwt.sign({ id: user, roles: ['vendor'], email: 'qa@example.invalid' }, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
    const result = await request(app).get(`/workspace/dairy?workspaceId=${milk}&date=2026-11-05`).set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(result.body.subscriptions[0].frequency, 'daily'); assert.equal(result.body.subscriptions[0].billingCycle, 'weekly');
    assert.equal(result.body.demand.length, 1); assert.equal(result.body.demand[0].quantity, 2); assert.equal(result.body.demand[0].litres, 1);
    assert.equal(result.body.summary.tomorrowDeliveries, 1);
    assert.equal(result.body.summary.expired, 1);
    assert.equal(result.body.summary.pendingPayment, 1);
    assert.equal(result.body.subscriptions[0].pendingPaymentDate, indiaDate());
    assert.equal(result.body.subscriptions.find((sub: any) => sub.status === 'expired').currentPeriodEnd, '2026-11-04');
    combo = true;
    const kit = await request(app).get(`/workspace/dairy?workspaceId=${milk}&date=2026-11-05`).set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(kit.body.demand[0].productName,'Milk component'); assert.equal(kit.body.demand[0].quantity,6); assert.equal(kit.body.demand[0].litres,6);
    assert.equal(kit.body.subscriptions[0].componentPacks,6); assert.equal(kit.body.summary.tomorrowDeliveries,1);
  } finally { for (const [model, method, original] of originals.reverse()) model[method] = original; }
});
