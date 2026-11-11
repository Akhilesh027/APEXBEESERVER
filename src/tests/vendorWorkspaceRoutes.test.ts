import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Vendor } from '../models/Vendor';
import Category from '../models/Category';
import Product from '../models/Product';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import router from '../routes/vendorWorkspaceRoutes';
import mongoose from 'mongoose';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { indiaDate, nextDate } from '../services/vendorWorkspaceService';
import { Order } from '../models/Order';
import { StockBatch } from '../models/StockBatch';
import { BusinessOperation } from '../models/BusinessOperations';

test('flower overview only returns this seller’s flower orders and use-by times', async context => {
  const userId = new mongoose.Types.ObjectId();
  const vendorId = new mongoose.Types.ObjectId();
  const parentId = new mongoose.Types.ObjectId();
  const flowerId = new mongoose.Types.ObjectId();
  const flowerProductId = new mongoose.Types.ObjectId();
  const unrelatedProductId = new mongoose.Types.ObjectId();
  const query = (value: unknown) => {
    const chain = { select: () => chain, sort: () => chain, lean: async () => value };
    return chain;
  };
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'flower-overview-route-test';
  try {
    context.mock.method(Vendor, 'findOne', async () => ({ _id: vendorId, userId, status: 'active', marketplaceStatus: 'Approved' }));
    context.mock.method(Category, 'find', (filter: { parentId?: unknown }) => query(filter.parentId ? [] : [
      { _id: parentId, level: 1, name: 'Devotional', slug: 'devotional' },
      { _id: flowerId, parentId, level: 2, name: 'Flowers and Garlands', slug: 'flowers-garlands' },
    ]));
    context.mock.method(VendorCategoryAccess, 'find', () => query([{ parentCategoryId: parentId, status: 'approved', approvedSubcategoryIds: [flowerId] }]));
    context.mock.method(Product, 'find', () => query([{ _id: flowerProductId, name: 'Jasmine garland', stock: 2, attributes: { flower_type: 'Jasmine', selling_unit: 'Garland Length (Meters)' } }]));
    const expiryAt = new Date(Date.now() + 60 * 60 * 1000);
    context.mock.method(StockBatch, 'find', () => query([{ _id: 'batch', productId: flowerProductId, expiry: indiaDate(expiryAt), expiryAt }]));
    context.mock.method(BusinessOperation, 'aggregate', async () => []);
    context.mock.method(Order, 'aggregate', async () => []);
    context.mock.method(Order, 'find', (filter: any) => {
      assert.deepEqual(filter.sellerId.$in.map(String), [String(vendorId), String(userId)]);
      assert.deepEqual(filter['items.productId'].$in.map(String), [String(flowerProductId)]);
      return query([{ _id: 'order', orderNumber: 'FLOWER-1', orderStatus: 'placed', items: [
        { productId: flowerProductId, productName: 'Jasmine garland', quantity: 2 },
        { productId: unrelatedProductId, productName: 'Unrelated product', quantity: 5 },
      ] }]);
    });
    const app = express(); app.use('/workspace', router);
    const token = jwt.sign({ id: String(userId), roles: ['vendor'] }, process.env.JWT_SECRET);
    const result = await request(app).get(`/workspace/daily-needs/overview?workspaceId=${flowerId}`).set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(result.body.products[0].unit, 'm');
    assert.equal(result.body.batches[0].status, 'expiring_soon');
    assert.deepEqual(result.body.preparation[0].items, [{ name: 'Jasmine garland', quantity: 2 }]);
  } finally {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('workspace endpoints authenticate users scope products and reject unapproved business ids', async () => {
  const userId = '507f1f77bcf86cd799439011';
  const vendorId = '507f1f77bcf86cd799439012';
  const parentId = '507f1f77bcf86cd799439013';
  const milkId = '507f1f77bcf86cd799439014';
  const productId = '507f1f77bcf86cd799439015';
  const original = { vendor: Vendor.findOne, category: Category.find, access: VendorCategoryAccess.find, product: Product.find,
    subscription: LocalShopSubscription.findOne, taskExists: SubscriptionDeliveryTask.exists, taskUpdate: SubscriptionDeliveryTask.updateMany, session: mongoose.startSession };
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'workspace-route-test-only';
  const token = jwt.sign({ id: userId, email: 'test@example.invalid', roles: ['vendor'] }, process.env.JWT_SECRET);
  let productReads = 0;
  (Vendor as any).findOne = async (filter: any) => {
    assert.equal(filter.userId, userId);
    return { _id: vendorId, userId, status: 'active', marketplaceStatus: 'Approved', categories: ['Daily Needs'], approvedSubcategories: ['Milk and Dairy'] };
  };
  (Category as any).find = (filter: any) => ({ select: () => ({ lean: async () => filter.parentId ? [] : [
    { _id: parentId, level: 1, name: 'Daily Needs', slug: 'daily-needs', isActive: true },
    { _id: milkId, parentId, level: 2, name: 'Milk and Dairy', slug: 'milk-and-dairy', isActive: true },
  ] }) });
  (VendorCategoryAccess as any).find = (filter: any) => {
    assert.equal(filter.vendorId, vendorId);
    return { lean: async () => [] };
  };
  (Product as any).find = (filter: any) => {
    productReads++;
    assert.deepEqual(filter.sellerId.$in.map(String), [vendorId, userId]);
    assert.equal(filter.$or[0].categoryId.$in[0].toString(), milkId);
    return { select: () => ({ lean: async () => [{ _id: productId, name: 'Cow Milk', stock: 8, status: 'Live' }] }) };
  };
  const app = express(); app.use(express.json()); app.use('/workspace', router);
  try {
    await request(app).get('/workspace').expect(401);
    const access = await request(app).get('/workspace').set('Authorization', `Bearer ${token}`).expect(200);
    assert.equal(access.body.workspaces[0].id, milkId);
    await request(app).get('/workspace/dairy?workspaceId=foreign').set('Authorization', `Bearer ${token}`).expect(403);
    await request(app).get(`/workspace/dairy?workspaceId=${milkId}&date=2026-02-31`).set('Authorization', `Bearer ${token}`).expect(400);
    const catalog = await request(app).get(`/workspace/catalog?workspaceId=${milkId}&vendorId=foreign`).set('Authorization', `Bearer ${token}`).expect(200);
    assert.deepEqual(catalog.body.products, [{ id: productId, name: 'Cow Milk', stock: 8, status: 'Live' }]);
    assert.equal(productReads, 1);
    await request(app).patch(`/workspace/dairy/subscriptions/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: milkId, action: 'skip', fromDate: '2020-01-01', toDate: '2020-01-02' }).expect(400);
    let saves = 0;
    let funded = true;
    let lastTaskFilter: any;
    let lastTaskUpdate: any;
    const sub = { _id: productId, status: 'active', skippedDates: [] as string[], deliveryAgentId: null,
      save: async () => { saves++; } };
    (mongoose as any).startSession = async () => ({ withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => {} });
    (LocalShopSubscription as any).findOne = (filter: any) => {
      assert.equal(filter.vendorId, vendorId);
      assert.equal(filter._id, productId);
      assert.deepEqual(filter.productId.$in.map(String), [productId]);
      return { session: async () => sub };
    };
    (SubscriptionDeliveryTask as any).exists = () => ({ session: async () => funded ? { _id: 'funded-task' } : null });
    (SubscriptionDeliveryTask as any).updateMany = async (filter: any, update: any) => { lastTaskFilter = filter; lastTaskUpdate = update; };
    await request(app).patch(`/workspace/dairy/subscriptions/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: milkId, action: 'pause' }).expect(409);
    assert.equal(saves, 0);
    assert.equal(sub.status, 'active');
    funded = false;
    await request(app).patch(`/workspace/dairy/subscriptions/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: milkId, action: 'pause' }).expect(200);
    assert.equal(sub.status, 'paused');
    assert.equal(lastTaskFilter.subscriptionId, productId);
    assert.deepEqual(lastTaskFilter.isDebitedFromUser, { $ne: true });
    assert.equal(lastTaskUpdate.$set.notes, 'vendor_subscription_pause');
    const tomorrow = nextDate(indiaDate());
    await request(app).patch(`/workspace/dairy/subscriptions/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: milkId, action: 'skip', fromDate: tomorrow, toDate: nextDate(tomorrow) }).expect(200);
    assert.deepEqual(sub.skippedDates, [tomorrow, nextDate(tomorrow)]);
    await request(app).patch(`/workspace/dairy/subscriptions/${productId}`).set('Authorization', `Bearer ${token}`)
      .send({ workspaceId: milkId, action: 'resume' }).expect(200);
    assert.equal(sub.status, 'active');
    assert.equal(lastTaskFilter.notes, 'vendor_subscription_pause');
    assert.deepEqual(lastTaskFilter.date.$nin, sub.skippedDates);
    assert.equal(lastTaskUpdate.$set.status, 'pending');
  } finally {
    Vendor.findOne = original.vendor; Category.find = original.category; VendorCategoryAccess.find = original.access; Product.find = original.product;
    LocalShopSubscription.findOne = original.subscription; SubscriptionDeliveryTask.exists = original.taskExists;
    SubscriptionDeliveryTask.updateMany = original.taskUpdate; mongoose.startSession = original.session;
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  }
});
