import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import router from '../routes/vendorWorkspaceRoutes';
import Category from '../models/Category';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import { VendorCategoryAccess } from '../models/VendorCategoryAccess';
import { BusinessOperation } from '../models/BusinessOperations';
import { StockBatch } from '../models/StockBatch';
import { Order } from '../models/Order';
import { permittedSubcategories, indiaDate } from '../services/vendorWorkspaceService';
import { parseSpecialistRecord, specialistTools } from '../services/businessSpecialists';

const id = (value: number) => new mongoose.Types.ObjectId(value.toString(16).padStart(24, '0'));
const parent = { _id: id(1), name: 'Daily Needs', slug: 'daily-needs', level: 1 };
const children = [
  { _id: id(2), name: 'Fruits & Vegetables', slug: 'fruits-vegetables' },
  { _id: id(3), name: 'Grocery and Staples', slug: 'grocery-and-staples' },
  { _id: id(4), name: 'Organic & Healthy Foods', slug: 'organic-healthy-foods' },
  { _id: id(5), name: 'Water Cans', slug: 'water-cans' },
].map(child => ({ ...child, level: 2, parentId: parent._id }));
const userId = id(6), vendorId = id(7);
const vendor = { _id: vendorId, userId, status: 'active', marketplaceStatus: 'Approved', categories: ['Daily Needs'], approvedSubcategories: children.map(child => child.name) };

test('production and local category names receive the correct tools through approved workspaces', () => {
  const workspaces = permittedSubcategories(vendor, [parent, ...children], []);
  assert.deepEqual(workspaces.map(workspace => workspace.dailyNeedsProfile), ['produce', 'grocery', 'organic', undefined]);
  const [produce, grocery, organic] = workspaces.map(specialistTools);
  assert.equal(produce.coldStorage, true);
  assert.equal(grocery.freshness, false);
  assert.equal(organic.certification, true);
  const body = { kind: 'expired_disposal', date: '2026-11-07', notes: 'Removed expired shelf stock', requestId: 'expired-product-test-100', quantity: '1' };
  assert.equal(parseSpecialistRecord(body, grocery, body.date).kind, 'expired_disposal');
  assert.throws(() => parseSpecialistRecord(body, specialistTools(workspaces[3]), body.date), /not enabled/);
  assert.throws(() => parseSpecialistRecord({ ...body, kind: 'certification' }, grocery, body.date), /not enabled/);
});

test('Daily Needs reports reject other workspaces and aggregate only selected vendor products and line items', async (context) => {
  const app = express();
  app.use(express.json());
  app.use('/workspace', router);
  const token = jwt.sign({ id: String(userId), roles: ['vendor'] }, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork');
  const query = (value: any) => {
    const cursor = { select: () => cursor, sort: () => cursor, lean: async () => value };
    return cursor;
  };
  const productId = id(8);
  const today = indiaDate();
  context.mock.method(Vendor, 'findOne', async () => vendor as any);
  context.mock.method(Category, 'find', (filter: any) => query(filter.parentId ? [] : [parent, ...children]));
  context.mock.method(VendorCategoryAccess, 'find', () => query([]));
  context.mock.method(Product, 'find', (filter: any) => {
    assert.deepEqual(filter.sellerId.$in, [vendorId, userId]);
    const scope = filter.$or[0].categoryId.$in;
    return query(scope.some((value: any) => String(value) === String(children[2]._id)) ? [{ _id: productId, name: 'Organic rice', stock: 10, attributes: { stock_unit: 'pack' }, baseSellingPrice: 100 }] : []);
  });
  context.mock.method(StockBatch, 'find', (filter: any) => {
    assert.deepEqual(filter.productId.$in, [productId]);
    return query([{ _id: id(9), productId, batchCode: 'LOT-1', remaining: 4, reserved: 1, expiry: '2020-01-01' }]);
  });
  context.mock.method(BusinessOperation, 'aggregate', async (pipeline: any[]) => {
    assert.equal(String(pipeline[0].$match.workspaceId), String(children[2]._id));
    return pipeline[0].$match.kind ? [{ _id: productId, record: { reference: 'ORGANIC-1', expiry: today } }] : [];
  });
  context.mock.method(Order, 'aggregate', async (pipeline: any[]) => {
    assert.deepEqual(pipeline[0].$match.sellerId.$in, [vendorId, userId]);
    assert.deepEqual(pipeline[0].$match['items.productId'].$in, [productId]);
    if (!pipeline.some(stage => stage.$unwind)) return [{ _id: 'Delivered', count: 1 }];
    assert.deepEqual(pipeline[2].$match['items.productId'].$in, [productId]);
    return [{ _id: productId, quantity: 2, itemValue: 200 }];
  });
  const get = (workspaceId: mongoose.Types.ObjectId) => request(app).get(`/workspace/daily-needs/overview?workspaceId=${workspaceId}&from=${today}&through=${today}`).set('Authorization', `Bearer ${token}`);
  await get(children[3]._id).expect(403);
  await get(id(90)).expect(403);
  const result = await get(children[2]._id).expect(200);
  assert.equal(result.body.batches[0].status, 'expired');
  assert.equal(result.body.products[0].unit, 'pack');
  assert.equal(result.body.certificates[0].record.reference, 'ORGANIC-1');
  assert.equal(result.body.sold[0].itemValue, 200);
});
