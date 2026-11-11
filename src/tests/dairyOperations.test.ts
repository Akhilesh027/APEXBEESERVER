import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDairyMovement, dairyReportDates, expiryStatus, isDairySummaryTime } from '../services/dairyOperationsService';
import { settlementAmounts, SubscriptionSettlementService } from '../services/SubscriptionSettlementService';
import { mergeVendorBusinessAccess } from '../services/additionalVendorAccess';
import mongoose from 'mongoose';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { Vendor } from '../models/Vendor';
import { WalletLedgerService } from '../services/WalletLedgerService';
import { DairyFundsService } from '../services/DairyFundsService';
import Notification from '../models/Notification';

test('stock ledger preserves pack arithmetic, prevents expired restocks and validates audit inputs', () => {
  const body = { type: 'collection', quantity: '12', date: '2026-11-05', expiry: '2026-11-08', batch: 'B01', notes: 'Morning farm collection', requestId: 'stock-reference-12345' };
  assert.equal(parseDairyMovement(body, '2026-11-05').delta, 12);
  assert.equal(parseDairyMovement({ ...body, type: 'return', disposition: 'discard' }, '2026-11-05').delta, 0);
  assert.equal(parseDairyMovement({ ...body, type: 'return', disposition: 'restock' }, '2026-11-05').delta, 12);
  assert.equal(parseDairyMovement({ ...body, type: 'wastage' }, '2026-11-05').delta, -12);
  for (const quantity of [0, -1, 1.5, Infinity, '']) assert.throws(() => parseDairyMovement({ ...body, quantity }, '2026-11-05'));
  assert.throws(() => parseDairyMovement({ ...body, type: 'return', disposition: 'restock', expiry: '2026-11-04' }, '2026-11-05'));
  assert.throws(() => parseDairyMovement({ ...body, batch: '' }, '2026-11-05'));
  assert.throws(() => parseDairyMovement({ ...body, date: '2026-11-06' }, '2026-11-05'));
});

test('expiry alerts and 6 PM summary use India dates, with bounded report ranges', () => {
  assert.equal(expiryStatus('2026-11-04', '2026-11-05'), 'expired');
  assert.equal(expiryStatus('2026-11-05', '2026-11-05'), 'expiring_soon');
  assert.equal(expiryStatus('2026-11-08', '2026-11-05'), 'expiring_soon');
  assert.equal(expiryStatus('2026-11-09', '2026-11-05'), 'fresh');
  assert.equal(expiryStatus(null, '2026-11-05'), 'not_recorded');
  assert.equal(isDairySummaryTime(new Date('2026-11-05T12:29:59Z')), false);
  assert.equal(isDairySummaryTime(new Date('2026-11-05T12:30:00Z')), true);
  assert.throws(() => dairyReportDates('2026-01-01', '2026-11-05', '2026-11-05'));
  assert.throws(() => dairyReportDates('2026-11-06', '2026-11-07', '2026-11-05'));
});

const statement = { billingPeriod: '2026-10', unitPrice: 45, quantity: 1, delivered: 2, grossAmount: 90, netVendorAmount: 81, platformCommission: 9, franchiseCommission: 0, taxes: 0 };
test('settlement charges only uncharged deliveries and blocks open cycles, duplicate payouts and mismatched totals', () => {
  assert.equal(settlementAmounts(statement, [{ isDebitedFromUser: true }, { isDebitedFromUser: false }], '2026-11-05').customerDebit, 45);
  assert.equal(settlementAmounts(statement, [{ isDebitedFromUser: true }, { isDebitedFromUser: true }], '2026-11-05').customerDebit, 0);
  assert.throws(() => settlementAmounts(statement, [{}, {}], '2026-10-31'), /final delivery day/);
  assert.throws(() => settlementAmounts(statement, [{ isPaidToVendor: true }, {}], '2026-11-05'), /already paid/);
  assert.throws(() => settlementAmounts({ ...statement, grossAmount: 91 }, [{}, {}], '2026-11-05'), /reconcile/);
  assert.throws(() => settlementAmounts(statement, [{}], '2026-11-05'), /records changed/);
});

test('additional business approval merges access and retains original business selection', () => {
  const result = mergeVendorBusinessAccess({ categories: ['Daily Needs'], allowedCategories: ['daily'], primaryCategory: 'Daily Needs', subCategory: 'Milk and Dairy', approvedSubcategories: ['Milk and Dairy'] }, { categories: ['Daily Needs', 'Devotional'], allowedCategories: ['daily', 'devotional'], approvedSubcategories: ['Grocery and Staples', 'Flowers and Garlands'], subCategories: ['Grocery and Staples', 'Flowers and Garlands'], primaryCategory: 'Devotional' });
  assert.deepEqual(result.categories, ['Daily Needs', 'Devotional']);
  assert.deepEqual(result.allowedCategories, ['daily', 'devotional']);
  assert.deepEqual(result.approvedSubcategories, ['Milk and Dairy', 'Grocery and Staples', 'Flowers and Garlands']);
  assert.equal(result.primaryCategory, 'Daily Needs'); assert.equal(result.subCategory, 'Milk and Dairy');
});

test('settlement pays the vendor user wallet once, captures reserved funds, and runs all writes in one transaction', async () => {
  const saved: Array<[any, string, any]> = []; const mock = (target: any, key: string, value: any) => { saved.push([target, key, target[key]]); target[key] = value; };
  const query = (value: any) => ({ session: async (session: any) => { assert.equal(session, tx); return value; } });
  const tx = { withTransaction: async (run: any) => run(), endSession: async () => {} };
  let debit = 0, credits = 0, captures = 0, claims = 0;
  const doc: any = { ...statement, _id: 'statement', vendorId: 'vendor-record', customerId: 'customer', settlementStatus: 'draft', save: async ({ session }: any) => assert.equal(session, tx) };
  try {
    mock(mongoose, 'startSession', async () => tx);
    mock(Notification, 'create', async (_items: any, options: any) => { assert.equal(options.session, tx); return []; });
    mock(SubscriptionStatement, 'findById', () => query(doc));
    mock(SubscriptionStatement, 'updateOne', async (_filter: any, _update: any, options: any) => { assert.equal(options.session, tx); claims++; return { modifiedCount: 1 }; });
    mock(SubscriptionDeliveryTask, 'find', () => query([{ _id: 'task1', isDebitedFromUser: true, chargeAmount: 45 }, { _id: 'task2', isDebitedFromUser: false }]));
    mock(SubscriptionDeliveryTask, 'updateMany', async (_filter: any, update: any, options: any) => { assert.equal(options.session, tx); assert.equal(update.$set.isPaidToVendor, true); });
    mock(Vendor, 'findById', () => query({ userId: 'vendor-user', status: 'active', marketplaceStatus: 'Approved' }));
    mock(DairyFundsService, 'finish', async (_task: any, customer: string, refund: boolean, session: any) => { assert.equal(customer, 'customer'); assert.equal(refund, false); assert.equal(session, tx); captures++; });
    mock(WalletLedgerService, 'debit', async (customer: string, amount: number, ...rest: any[]) => { assert.equal(customer, 'customer'); assert.equal(amount, 45); assert.equal(rest.at(-1), tx); debit++; return { _id: 'payment' }; });
    mock(WalletLedgerService, 'credit', async (recipient: string, amount: number, ...rest: any[]) => { assert.equal(recipient, 'vendor-user'); assert.equal(amount, 81); assert.equal(rest.at(-1), tx); credits++; });
    await SubscriptionSettlementService.settleStatement('statement');
    assert.equal(doc.settlementStatus, 'settled'); assert.equal(captures, 1); assert.equal(debit, 1); assert.equal(credits, 1); assert.equal(claims, 1);
    await SubscriptionSettlementService.settleStatement('statement');
    assert.equal(debit, 1); assert.equal(credits, 1); assert.equal(claims, 1);
  } finally { for (const [target, key, value] of saved.reverse()) target[key] = value; }
});
