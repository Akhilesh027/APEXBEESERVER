import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { specialistTools, parseSpecialistRecord } from '../services/businessSpecialists';
import inquiryRouter from '../routes/businessInquiryRoutes';
import localRouter from '../routes/localShopRoutes';
import { BusinessInquiry } from '../models/BusinessOperations';

test('specialist capabilities follow each approved business without mixing water, cold-chain or shopping tools', () => {
  const tools = (name: string, categoryName = 'Daily Needs') => specialistTools({ name, categoryName });
  assert.equal(tools('Fruits and Vegetables').freshness, true); assert.equal(tools('Fruits and Vegetables').weight, true);
  assert.equal(tools('Water and Hydration').containers, true); assert.equal(tools('Water and Hydration').coldStorage, false);
  assert.equal(tools('Organic and Healthy Foods').certification, true);
  assert.equal(tools('Eggs, Meat and Seafood').coldStorage, true);
  assert.equal(tools('Flowers and Garlands', 'Devotional').freshness, true);
  assert.equal(tools('Pooja Kits and Ritual Kits', 'Devotional').bundles, true);
  assert.equal(tools('Temple, Priest and Devotional Services', 'Devotional').bookings, true);
  assert.equal(tools('Fashion & Lifestyle', 'Shopping').customOrders, true);
  assert.equal(tools('Raw Materials', 'Business Hub').bulkQuotes, true);
  assert.equal(tools('Grocery and Staples').containers, false);
});

test('quality checks enforce enabled tools, measured temperatures, grading and certification details', () => {
  const body = { kind: 'freshness_check', date: '2026-11-05', quantity: '2.5', grade: 'A', notes: 'Morning produce inspection', requestId: 'quality-reference-1234' };
  const produce = specialistTools({ name: 'Fruits and Vegetables', categoryName: 'Daily Needs' });
  assert.equal(parseSpecialistRecord(body, produce, '2026-11-05').quantity, 2.5);
  assert.throws(() => parseSpecialistRecord({ ...body, grade: '' }, produce, '2026-11-05'));
  assert.throws(() => parseSpecialistRecord({ ...body, date: '2026-02-31' }, produce, '2026-11-05'));
  const grocery = specialistTools({ name: 'Grocery and Staples', categoryName: 'Daily Needs' });
  assert.throws(() => parseSpecialistRecord(body, grocery, '2026-11-05'), /not enabled/);
  const cold = specialistTools({ name: 'Eggs, Meat and Seafood', categoryName: 'Daily Needs' });
  assert.throws(() => parseSpecialistRecord({ ...body, kind: 'cold_storage_check', storage: 'chilled', temperature: '' }, cold, '2026-11-05'), /temperature/);
  assert.equal(parseSpecialistRecord({ ...body, kind: 'cold_storage_check', storage: 'frozen', temperature: '-18.2' }, cold, '2026-11-05').temperature, -18.2);
  const organic = specialistTools({ name: 'Organic and Healthy Foods', categoryName: 'Daily Needs' });
  assert.throws(() => parseSpecialistRecord({ ...body, kind: 'certification', quantity: 2 }, organic, '2026-11-05'), /reference/);
});

test('billing administration requires an admin and customer quote responses stay scoped to their own requests', async () => {
  const app = express(); app.use(express.json()); app.use('/local', localRouter); app.use('/requests', inquiryRouter);
  const id = '507f1f77bcf86cd799439011', secret = process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork';
  const token = jwt.sign({ id, roles: ['customer'] }, secret);
  await request(app).get('/local/billing/statements').expect(401);
  await request(app).get('/local/billing/statements').set('Authorization', `Bearer ${token}`).expect(403);
  await request(app).patch(`/local/billing/statements/${id}/approve`).set('Authorization', `Bearer ${token}`).expect(403);
  await request(app).post('/local/scheduler/holds').set('Authorization', `Bearer ${token}`).expect(403);
  const original = BusinessInquiry.findOneAndUpdate;
  try {
    (BusinessInquiry as any).findOneAndUpdate = async (filter: any, update: any) => { assert.equal(filter.customerId, id); assert.equal(filter.status, 'quoted'); assert.equal(update.$set.status, 'accepted'); return null; };
    await request(app).patch(`/requests/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'accepted' }).expect(409);
    await request(app).patch(`/requests/${id}`).set('Authorization', `Bearer ${token}`).send({ status: 'completed' }).expect(400);
  } finally { BusinessInquiry.findOneAndUpdate = original; }
});
