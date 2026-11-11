import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandBundleItems } from '../services/bundleService';
import { receiptQuantities } from '../services/procurementService';
test('kits expand and combine component reservations, including components bought separately', () => {
  const products = [{ _id: 'kit', sellerId: 'seller', bundleComponents: [{ productId: 'oil', quantity: 2 }, { productId: 'wicks', quantity: 3 }] }, { _id: 'oil', sellerId: 'seller', status: 'Live', isActive: true }, { _id: 'wicks', sellerId: 'seller', status: 'Live', isActive: true }];
  const expanded = expandBundleItems([{ productId: 'kit', quantity: 2 }, { productId: 'oil', quantity: 1 }], products);
  assert.equal(expanded.find(item => item.productId === 'kit')?.quantity, 2);
  assert.equal(expanded.find(item => item.productId === 'oil')?.quantity, 5);
  assert.equal(expanded.find(item => item.productId === 'wicks')?.quantity, 6);
  assert.throws(() => expandBundleItems([{ productId: 'kit', quantity: 1 }], products.map(p => p._id === 'oil' ? { ...p, isActive: false } : p)), /unavailable/);
  assert.throws(() => expandBundleItems([{ productId: 'kit', quantity: 1 }], products.map(p => p._id === 'oil' ? { ...p, sellerId: 'other' } : p)), /another seller/);
  assert.throws(() => expandBundleItems([{ productId: 'kit', quantity: 0.5 }], products), /whole number/);
});
test('goods receipts support partial receipts and reject over-receipts or invalid quantities', () => {
  assert.deepEqual(receiptQuantities(10, 2, 1, 4, 1), { accepted: 4, rejected: 1 });
  assert.throws(() => receiptQuantities(10, 2, 1, 8, 0), /outstanding/);
  assert.throws(() => receiptQuantities(10, 0, 0, -1, 1));
  assert.throws(() => receiptQuantities(10, 0, 0, 0, 0));
  assert.throws(() => receiptQuantities(10, 0, 0, 1.0001, 0));
});
