import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dairyLitres, parseSubscriptionPlan, plannedDeliveryCount, statementDeliveryWindow, subscriptionBillingWindow } from '../services/subscriptionPlan';
import { isDeliveryDue } from '../services/vendorWorkspaceService';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { SubscriptionPriceHistory } from '../models/SubscriptionPriceHistory';
import { CommissionService } from '../services/CommissionService';
import { SubscriptionBillingService } from '../services/SubscriptionBillingService';

const today = '2026-11-05';
test('settlement uses the saved weekly dates and real month ends for older statements', () => {
  assert.deepEqual(statementDeliveryWindow({ billingPeriod: '2026-11-05', periodStart: '2026-11-05', periodEnd: '2026-11-11' }), { startDate: '2026-11-05', endDate: '2026-11-11' });
  assert.deepEqual(statementDeliveryWindow({ billingPeriod: '2026-02' }), { startDate: '2026-02-01', endDate: '2026-02-28' });
  assert.throws(() => statementDeliveryWindow({ billingPeriod: '2026-11-05' }));
  assert.throws(() => statementDeliveryWindow({ billingPeriod: '2026-11', periodStart: '2026-11-12', periodEnd: '2026-11-05' }));
});
test('weekly and monthly billing both preserve daily delivery while custom weekday names normalize', () => {
  for (const billingCycle of ['weekly', 'monthly']) {
    const plan = parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'daily', billingCycle, startDate: '2026-11-06' }, today);
    assert.equal(plan.frequency, 'daily'); assert.equal(plan.billingCycle, billingCycle);
    assert.equal(isDeliveryDue({ ...plan, status: 'active' }, '2026-11-07'), true);
    assert.equal(isDeliveryDue({ ...plan, status: 'active' }, '2026-11-08'), true);
  }
  const custom = parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'custom', billingCycle: 'monthly', customDays: ['Mon', 'monday', 'WED'], startDate: today }, today);
  assert.deepEqual(custom.customDays, ['Monday', 'Wednesday']);
  assert.equal(isDeliveryDue({ ...custom, status: 'active' }, '2026-11-09'), true);
  assert.equal(isDeliveryDue({ status: 'active', startDate: today, frequency: 'custom', customDays: ['Fri'] }, '2026-11-06'), true);
  assert.equal(parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'weekly', billingCycle: 'monthly', startDate: today }, today).frequency, 'weekly');
  assert.throws(() => parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'daily', startDate: today }, today));
  assert.throws(() => parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'custom', billingCycle: 'weekly', customDays: [], startDate: today }, today));
  assert.throws(() => parseSubscriptionPlan({ scheduleVersion: 2, frequency: 'daily', billingCycle: 'weekly', startDate: '2026-11-04' }, today));
});

test('existing once-weekly plans retain their cadence and new weekly windows cover seven daily deliveries', () => {
  const legacy = parseSubscriptionPlan({ frequency: 'weekly' }, today);
  assert.equal(legacy.scheduleVersion, 1); assert.equal(legacy.billingCycle, undefined);
  assert.equal(isDeliveryDue({ ...legacy, status: 'active' }, '2026-11-06'), false);
  const weekly = { status: 'active', scheduleVersion: 2, billingCycle: 'weekly', startDate: '2026-11-06', frequency: 'daily' };
  const window = subscriptionBillingWindow(weekly, '2026-11-06');
  assert.equal(window.endDate, '2026-11-12');
  assert.equal(plannedDeliveryCount(weekly, window.startDate, window.endDate), 7);
  assert.equal(plannedDeliveryCount({ ...weekly, frequency: 'alternate' }, window.startDate, window.endDate), 4);
  assert.equal(plannedDeliveryCount({ ...weekly, skippedDates: ['2026-11-08'] }, window.startDate, window.endDate), 6);
  assert.throws(() => subscriptionBillingWindow(weekly, '2026-11-07'));
  assert.equal(subscriptionBillingWindow({ billingCycle: 'monthly', scheduleVersion: 2 }, '2028-02').endDate, '2028-02-29');
  assert.throws(() => subscriptionBillingWindow({}, '2026-13'));
});

test('required litres use pack sizes and never treat solid or unknown products as liquid', () => {
  assert.equal(dairyLitres({ dairyDetails: { packSize: 500, packUnit: 'ml' } }, 3), 1.5);
  assert.equal(dairyLitres({ dairyDetails: { packSize: 2000, packUnit: 'ml' } }, 2), 4);
  assert.equal(dairyLitres({ attributes: { volume: ['1 litre'] } }, 2), 2);
  assert.equal(dairyLitres({ dairyDetails: { packSize: 500, packUnit: 'g' }, attributes: { volume: '500 ml' } }, 2), null);
  assert.equal(dairyLitres({ attributes: { volume: '500 g' } }, 2), null);
  assert.equal(dairyLitres({}, 2), null);
});

test('weekly statements query the chosen seven day window and charge only confirmed deliveries', async () => {
  const original = { sub: LocalShopSubscription.findById, tasks: SubscriptionDeliveryTask.find, price: SubscriptionPriceHistory.findOne, splits: CommissionService.calculateSubscriptionSplits, save: SubscriptionStatement.prototype.save };
  const id = '507f1f77bcf86cd799439011';
  try {
    (LocalShopSubscription as any).findById = async () => ({ _id: id, vendorId: id, userId: id, startDate: '2026-11-06', status: 'active', frequency: 'daily', scheduleVersion: 2, billingCycle: 'weekly', quantity: 2, unitPrice: 30 });
    (SubscriptionDeliveryTask as any).find = async (filter: any) => { assert.deepEqual(filter.date, { $gte: '2026-11-06', $lte: '2026-11-12' }); return [{ status: 'delivered' }, { status: 'delivered' }, { status: 'cancelled' }]; };
    (SubscriptionPriceHistory as any).findOne = () => ({ sort: async () => null });
    (CommissionService as any).calculateSubscriptionSplits = async (amount: number) => ({ platformAmount: 0, franchiseAmount: 0, vendorAmount: amount });
    (SubscriptionStatement.prototype as any).save = async function () { return this; };
    const statement = await SubscriptionBillingService.generateStatement(id, '2026-11-06');
    assert.equal(statement.billingCycle, 'weekly'); assert.equal(statement.expectedDeliveries, 7);
    assert.equal(statement.periodEnd, '2026-11-12'); assert.equal(statement.delivered, 2); assert.equal(statement.grossAmount, 120);
  } finally { LocalShopSubscription.findById = original.sub; SubscriptionDeliveryTask.find = original.tasks; SubscriptionPriceHistory.findOne = original.price; CommissionService.calculateSubscriptionSplits = original.splits; SubscriptionStatement.prototype.save = original.save; }
});
