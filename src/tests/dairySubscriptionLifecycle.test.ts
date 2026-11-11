import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dairyDelayDeadline, dairyLifecycleAction, runDairyRenewals } from '../services/dairySubscriptionLifecycle';
import LocalShopSubscription from '../models/LocalShopSubscription';
import Notification from '../models/Notification';
import Product from '../models/Product';
import { currentSubscriptionCycleEnd, parseSubscriptionPlan } from '../services/subscriptionPlan';
import { subscriptionSkipDates } from '../services/subscriptionScheduleService';
import { enforceDairyOrderMode } from '../services/dairyOrderRules';
import { isDeliveryDue } from '../services/vendorWorkspaceService';

test('customer vacation ranges are inclusive, future-only and bounded', () => {
  assert.deepEqual(subscriptionSkipDates('2026-11-30', '2026-12-02', '2026-11-07'), ['2026-11-30', '2026-12-01', '2026-12-02']);
  assert.throws(() => subscriptionSkipDates('2026-11-07', '2026-11-10', '2026-11-07'), /tomorrow/);
  assert.throws(() => subscriptionSkipDates('2026-11-08', '2027-02-07', '2026-11-07'), /91 days/);
});

test('delivery frequency is independent from billing and a monthly delivery handles a short month', () => {
  const monthly = parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'monthly', billingCycle: 'weekly', startDate: '2027-01-31' }, '2027-01-20');
  assert.equal(monthly.billingCycle, 'weekly');
  assert.equal(isDeliveryDue({ ...monthly, status: 'active' }, '2027-02-28'), true);
  assert.equal(isDeliveryDue({ ...monthly, status: 'active' }, '2027-03-28'), false);
  assert.equal(isDeliveryDue({ ...monthly, status: 'active' }, '2027-03-31'), true);
});

test('renewal preserves the original delivery anchor and disabled plans stop after the closed cycle', () => {
  const sub = { startDate: '2026-11-05', status: 'active', frequency: 'alternate', scheduleVersion: 2, billingCycle: 'weekly', currentPeriodEnd: '2026-11-11' };
  assert.equal(dairyLifecycleAction(sub, '2026-11-07'), null);
  assert.equal(dairyLifecycleAction(sub, '2026-11-08'), 'remind');
  assert.equal(dairyLifecycleAction(sub, '2026-11-12'), 'renew');
  assert.equal(currentSubscriptionCycleEnd(sub, '2026-11-12'), '2026-11-18');
  assert.equal(isDeliveryDue({ ...sub, autoRenew: true }, '2026-11-13'), true);
  assert.equal(isDeliveryDue({ ...sub, autoRenew: false }, '2026-11-13'), false);
  assert.equal(dairyLifecycleAction({ ...sub, autoRenew: false }, '2026-11-12'), 'expire');
  assert.equal(dairyLifecycleAction({ ...sub, status: 'cancelled' }, '2026-11-12'), null);
});

test('delay alerts respect the configured time in IST and ignore ambiguous timings', () => {
  assert.equal(dairyDelayDeadline('2026-11-07', '6:00 PM'), Date.parse('2026-11-07T18:30:00+05:30'));
  assert.equal(dairyDelayDeadline('2026-11-07', '06:00'), Date.parse('2026-11-07T06:30:00+05:30'));
  assert.equal(dairyDelayDeadline('2026-11-07', '06:00 AM - 07:00 AM'), Date.parse('2026-11-07T07:30:00+05:30'));
  assert.equal(dairyDelayDeadline('2026-11-07', 'evening'), null);
});

test('configured dairy order mode only rejects the disabled checkout type', () => {
  assert.throws(() => enforceDairyOrderMode({ businessType: 'Dairy Farm', orderMode: 'one_time' }, 'subscription'), /one-time orders only/);
  assert.throws(() => enforceDairyOrderMode({ businessType: 'Dairy Farm', orderMode: 'subscription' }, 'one_time'), /subscriptions only/);
  assert.doesNotThrow(() => enforceDairyOrderMode({ businessType: 'Dairy Farm', orderMode: 'both' }, 'subscription'));
  assert.doesNotThrow(() => enforceDairyOrderMode(undefined, 'one_time'));
});

test('the renewal worker changes only the cycle end, expires opt-out plans and deduplicates reminders by cycle', async context => {
  const plan = { startDate: '2026-11-01', status: 'active', scheduleVersion: 2, billingCycle: 'weekly', portalType: 'dairy', userId: 'customer', productName: 'Cow milk' };
  const rows = [
    { ...plan, _id: 'renew', currentPeriodEnd: '2026-11-07', autoRenew: true },
    { ...plan, _id: 'expire', currentPeriodEnd: '2026-11-07', autoRenew: false },
    { ...plan, _id: 'remind', currentPeriodEnd: '2026-11-10', autoRenew: false },
  ];
  const writes: Record<string, unknown> = {};
  const notices = new Set<string>();
  const products = { select: () => products, lean: async () => [] };
  context.mock.method(LocalShopSubscription, 'find', () => ({ lean: async () => rows }));
  context.mock.method(Product, 'find', () => products);
  context.mock.method(LocalShopSubscription, 'updateOne', async (filter: any, update: any) => { writes[filter._id] = update.$set; return { modifiedCount: 1 }; });
  context.mock.method(Notification, 'updateOne', async (filter: any, update: any, options: any) => {
    assert.equal(options.upsert, true);
    assert.equal(update.$setOnInsert.eventCode, 'dairy.renewal_reminder');
    notices.add(filter.dedupeKey);
  });
  await runDairyRenewals(new Date('2026-11-08T00:01:00+05:30'));
  assert.deepEqual(writes, { renew: { currentPeriodEnd: '2026-11-14' }, expire: { status: 'expired' } });
  assert.deepEqual([...notices], ['dairy-renewal-remind-2026-11-10']);
});
