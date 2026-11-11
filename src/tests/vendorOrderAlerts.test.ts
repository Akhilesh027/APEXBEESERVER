import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderDeadlineWarningMs, vendorOrderAlert } from '../services/vendorOrderAlerts';

const now = Date.parse('2026-11-07T06:00:00Z');

test('new order alerts start when an order is placed', () => {
  assert.equal(vendorOrderAlert({ orderStatus: 'Placed' }, now), 'new');
  assert.equal(vendorOrderAlert({ orderStatus: 'placed' }, now), 'new');
  assert.equal(vendorOrderAlert({ orderStatus: 'pending_payment' }, now), null);
});

test('preparation alerts respect the deadline and disappear once packed or cancelled', () => {
  const deadline = (remainingMs: number) => ({ orderStatus: 'preparing', estimatedDeliveryTime: new Date(now + remainingMs) });
  assert.equal(vendorOrderAlert(deadline(orderDeadlineWarningMs + 1), now), null);
  assert.equal(vendorOrderAlert(deadline(orderDeadlineWarningMs), now), 'due_soon');
  assert.equal(vendorOrderAlert(deadline(0), now), 'overdue');
  assert.equal(vendorOrderAlert({ ...deadline(0), orderStatus: 'Packed' }, now), null);
  assert.equal(vendorOrderAlert({ ...deadline(0), orderStatus: 'cancelled' }, now), null);
  assert.equal(vendorOrderAlert({ orderStatus: 'preparing' }, now), null);
});
