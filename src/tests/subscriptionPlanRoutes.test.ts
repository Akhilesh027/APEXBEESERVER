import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import router from '../routes/localShopRoutes';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { WalletEngine } from '../services/WalletEngine';
import { indiaDate } from '../services/vendorWorkspaceService';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';

test('subscription creation stores daily delivery with an independent billing cycle and enforces ownership', async () => {
  const id = '507f1f77bcf86cd799439011';
  const vendorId = '507f1f77bcf86cd799439015';
  const original = { wallet: WalletEngine.getOrCreateWallet, save: LocalShopSubscription.prototype.save, product: Product.findById, vendor: Vendor.findOne };
  const secret = process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork';
  const token = jwt.sign({ id, roles: ['customer'], email: 'qa@example.invalid' }, secret);
  const app = express(); app.use(express.json()); app.use('/local-shop', router);
  let writes = 0; let walletReads = 0;
  try {
    (WalletEngine as any).getOrCreateWallet = async () => { walletReads++; return { availableBalance: 1000 }; };
    (LocalShopSubscription.prototype as any).save = async function () { writes++; return this; };
    (Product as any).findById = () => ({ select: async () => ({ sellerId: id, name: 'Test Cow Milk 500 ml', baseSellingPrice: 30, status: 'Live', isActive: true, isSubscriptionAvailable: true }) });
    (Vendor as any).findOne = async () => ({ _id: vendorId, userId: id, status: 'active', marketplaceStatus: 'Approved' });
    const body = { userId: id, productId: id, vendorId: id, productName: 'Test Cow Milk 500 ml', quantity: 2, unitPrice: 30,
      scheduleVersion: 2, billingCycle: 'weekly', frequency: 'daily', startDate: indiaDate(), deliverySlot: '06:00 AM - 07:00 AM',
      customerName: 'QA member', customerPhone: '0000000000', address: 'Test address' };
    await request(app).post('/local-shop/subscriptions').send(body).expect(401);
    await request(app).post('/local-shop/subscriptions').set('Authorization', `Bearer ${token}`).send({ ...body, userId: '507f1f77bcf86cd799439012' }).expect(403);
    await request(app).post('/local-shop/subscriptions').set('Authorization', `Bearer ${token}`).send({ ...body, frequency: 'weekly' }).expect(400);
    assert.equal(walletReads, 0); assert.equal(writes, 0);
    await request(app).post('/local-shop/subscriptions').set('Authorization', `Bearer ${token}`).send({ ...body, vendorId: '507f1f77bcf86cd799439099' }).expect(400);
    for (const billingCycle of ['weekly', 'monthly']) {
      const result = await request(app).post('/local-shop/subscriptions').set('Authorization', `Bearer ${token}`).send({ ...body, billingCycle }).expect(201);
      assert.equal(result.body.subscription.frequency, 'daily');
      assert.equal(result.body.subscription.billingCycle, billingCycle);
      assert.equal(result.body.subscription.startDate, body.startDate);
      assert.equal(result.body.subscription.scheduleVersion, 2);
      assert.equal(result.body.subscription.vendorId, vendorId);
      assert.equal(result.body.subscription.unitPrice, 30);
    }
    assert.equal(writes, 2);
  } finally { WalletEngine.getOrCreateWallet = original.wallet; LocalShopSubscription.prototype.save = original.save; Product.findById = original.product; Vendor.findOne = original.vendor; }
});
