import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dairyConsumption } from '../services/dairyConsumption';
test('consumption includes confirmed deliveries once and never treats gram packs or missing sizes as litres', () => {
  const subs = ['milk', 'curd', 'unknown'].map(productId => ({ _id: productId, productId, quantity: 2, customerName: 'Sample customer' }));
  const tasks = subs.flatMap(sub => [{ subscriptionId: sub._id, date: '2026-11-06', status: 'delivered' }, { subscriptionId: sub._id, date: '2026-11-06', status: 'delivered' }, { subscriptionId: sub._id, date: '2026-11-07', status: 'failed' }, { subscriptionId: sub._id, date: '2026-12-01', status: 'delivered' }]);
  const result = dairyConsumption(subs, tasks, [{ _id: 'milk', dairyDetails: { packSize: 500, packUnit: 'ml' } }, { _id: 'curd', dairyDetails: { packSize: 500, packUnit: 'g' } }], '2026-11-01', '2026-11-30');
  assert.deepEqual(result.map(row => row.deliveries), [1, 1, 1]); assert.deepEqual(result.map(row => row.packs), [2, 2, 2]); assert.deepEqual(result.map(row => row.litres), [1, null, null]);
});
