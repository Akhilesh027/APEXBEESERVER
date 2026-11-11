import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { SubscriptionSchedulerService } from '../services/SubscriptionSchedulerService';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { SubscriptionLedger } from '../models/SubscriptionLedger';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { WalletEngine } from '../services/WalletEngine';

const makeSub = (overrides: any = {}) => ({ _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(), vendorId: 'vendor', status: 'active', startDate: '2026-11-04', frequency: 'daily', skippedDates: [], ...overrides });

test('daily scheduler uses India dates and matches the portal across all five frequencies', async () => {
  const original = { subs: LocalShopSubscription.find, calendar: BusinessCalendar.findOne, task: SubscriptionDeliveryTask.findOne,
    saveTask: SubscriptionDeliveryTask.prototype.save, saveLedger: SubscriptionLedger.prototype.save, holds: SubscriptionSchedulerService.processWalletHoldsForTomorrow };
  const included = [makeSub(), makeSub({ frequency: 'alternate' }), makeSub({ frequency: 'weekly', startDate: '2026-10-30' }),
    makeSub({ frequency: 'monthly', startDate: '2026-10-06' }), makeSub({ frequency: 'custom', customDays: ['friday'] })];
  const excluded = [makeSub({ startDate: '2027-01-01' }), makeSub({ frequency: 'alternate', startDate: '2026-11-05' }),
    makeSub({ status: 'paused' }), makeSub({ skippedDates: ['2026-11-06'] }), makeSub({ vendorId: 'holiday-vendor' })];
  const saved: any[] = []; const now = new Date('2026-11-05T18:45:00Z');
  try {
    (LocalShopSubscription as any).find = async () => [...included, ...excluded];
    (BusinessCalendar as any).findOne = async (filter: any) => { assert.equal(filter.date, '2026-11-06'); return filter.$or[1].vendorId === 'holiday-vendor' ? {} : null; };
    (SubscriptionDeliveryTask as any).findOne = async () => null;
    (SubscriptionDeliveryTask.prototype as any).save = async function () { saved.push(this); return this; };
    (SubscriptionLedger.prototype as any).save = async function () { return this; };
    SubscriptionSchedulerService.processWalletHoldsForTomorrow = async (date?: Date) => { assert.equal(date, now); return {}; };
    const result = await SubscriptionSchedulerService.runDailyScheduler(now);
    assert.equal(result.date, '2026-11-06'); assert.equal(result.tasksGenerated, 5);
    assert.deepEqual(saved.map(task => String(task.subscriptionId)), included.map(sub => String(sub._id)));
    assert.ok(saved.every(task => task.date === '2026-11-06'));
  } finally {
    LocalShopSubscription.find = original.subs; BusinessCalendar.findOne = original.calendar; SubscriptionDeliveryTask.findOne = original.task;
    SubscriptionDeliveryTask.prototype.save = original.saveTask; SubscriptionLedger.prototype.save = original.saveLedger; SubscriptionSchedulerService.processWalletHoldsForTomorrow = original.holds;
  }
});

test('tomorrow scheduling skips paused future skipped and already funded or cancelled deliveries before accessing wallets', async () => {
  const original = { subs: LocalShopSubscription.find, calendar: BusinessCalendar.findOne, task: SubscriptionDeliveryTask.findOne, wallet: WalletEngine.getOrCreateWallet };
  const funded = makeSub(); const cancelled = makeSub();
  try {
    (LocalShopSubscription as any).find = async () => [funded, cancelled, makeSub({ status: 'paused' }), makeSub({ startDate: '2027-01-01' }), makeSub({ skippedDates: ['2026-11-06'] })];
    (BusinessCalendar as any).findOne = async () => null;
    (SubscriptionDeliveryTask as any).findOne = async (filter: any) => { assert.equal(filter.date, '2026-11-06'); return String(filter.subscriptionId) === String(funded._id) ? { status: 'assigned', isDebitedFromUser: true } : { status: 'cancelled', isDebitedFromUser: false }; };
    let walletReads = 0;
    (WalletEngine as any).getOrCreateWallet = async () => { walletReads++; throw new Error('Wallet must not be accessed'); };
    const result = await SubscriptionSchedulerService.processWalletHoldsForTomorrow(new Date('2026-11-04T18:45:00Z'));
    assert.equal(result.date, '2026-11-06'); assert.equal(result.holdsProcessedCount, 0); assert.equal(walletReads, 0);
  } finally { LocalShopSubscription.find = original.subs; BusinessCalendar.findOne = original.calendar; SubscriptionDeliveryTask.findOne = original.task; WalletEngine.getOrCreateWallet = original.wallet; }
});
