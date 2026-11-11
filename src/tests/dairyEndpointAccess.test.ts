import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import router from '../routes/localShopRoutes';
test('dairy review endpoints authenticate and retired task payouts cannot bypass statement settlement', async () => {
  const previous = process.env.JWT_SECRET; process.env.JWT_SECRET = 'dairy-endpoint-test-only';
  const app = express(); app.use(express.json()); app.use('/local-shop', router);
  const token = (roles: string[]) => jwt.sign({ id: '507f1f77bcf86cd799439011', roles }, process.env.JWT_SECRET!);
  try {
    await request(app).get('/local-shop/subscriptions/507f1f77bcf86cd799439012/review').expect(401);
    await request(app).post('/local-shop/subscriptions/507f1f77bcf86cd799439012/review').send({ overall: 5 }).expect(401);
    await request(app).patch('/local-shop/billing/tasks/507f1f77bcf86cd799439012/approve').expect(401);
    await request(app).patch('/local-shop/billing/tasks/507f1f77bcf86cd799439012/approve').set('Authorization', `Bearer ${token(['customer'])}`).expect(403);
    const response = await request(app).patch('/local-shop/billing/tasks/507f1f77bcf86cd799439012/approve').set('Authorization', `Bearer ${token(['admin'])}`).expect(410);
    assert.match(response.body.message, /statement settlement/);
  } finally { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; }
});
