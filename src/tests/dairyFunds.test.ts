import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { DairyFundsService } from '../services/DairyFundsService';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { Vendor } from '../models/Vendor';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { BusinessApplication } from '../models/BusinessApplication';
import { WalletEngine } from '../services/WalletEngine';
import Wallet from '../models/Wallet';
import { User } from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';

test('reservation is scoped to one delivery task, rejects holidays and duplicate debits, and captures or refunds only an exact pending charge', async () => {
  const originals: Array<[any, string, any]> = [], mock = (model: any, name: string, value: any) => { originals.push([model, name, model[name]]); model[name] = value; };
  const tx = { withTransaction: async (run: any) => run(), endSession: async () => {} };
  const query = (value: any) => { const q: any = { select: () => q, sort: () => q, session: async () => value }; return q; };
  const sub: any = { _id: 'sub', userId: 'customer', vendorId: 'vendor', quantity: 2, unitPrice: 30, startDate: '2026-11-05', frequency: 'daily', status: 'active' };
  const task: any = { _id: 'dated-task', status: 'assigned', isDebitedFromUser: false, save: async ({ session }: any) => assert.equal(session, tx) };
  let holiday = false, balance = 100, debits = 0, updates = 0, canFinish = true;
  const reservationKeys: string[] = [];
  try {
    mock(mongoose, 'startSession', async () => tx);
    mock(LocalShopSubscription, 'findById', () => query(sub));
    mock(Vendor, 'findById', () => query({ _id: 'vendor', userId: 'vendor-user', status: 'active', marketplaceStatus: 'Approved' }));
    mock(BusinessCalendar, 'exists', () => query(holiday ? {} : null));
    mock(BusinessApplication, 'findOne', () => query({ businessDetails: { dairy: { weeklyHoliday: 'None' } } }));
    mock(SubscriptionDeliveryTask, 'findOne', () => query(task));
    mock(WalletEngine, 'getOrCreateWallet', async () => ({ availableBalance: balance }));
    mock(WalletEngine, 'debit', async (user: string, amount: number, input: any, session: any) => { assert.equal(user, 'customer'); assert.equal(amount, 60); assert.equal(input.referenceId, 'dated-task'); assert.equal(input.status, 'pending'); assert.equal(session, tx); reservationKeys.push(input.operationKey); debits++; });
    holiday = true; assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), false); assert.equal(debits, 0);
    holiday = false; balance = 59; assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), false);
    balance = 100; assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), true); assert.equal(task.chargeAmount, 60); assert.equal(task.fundingStatus, 'reserved');
    assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), false); assert.equal(debits, 1);
    mock(Wallet, 'updateOne', async (filter: any, update: any, options: any) => { assert.equal(filter.pendingBalance.$gte, 60); assert.equal(filter.ledgerEntries.$elemMatch.referenceId, 'dated-task'); assert.equal(filter.ledgerEntries.$elemMatch.amount, 60); assert.equal(options.session, tx); if (canFinish) updates++; return { modifiedCount: canFinish ? 1 : 0 }; });
    mock(User, 'updateOne', async () => {}); mock(WalletTransaction, 'updateMany', async () => {});
    canFinish = false; await assert.rejects(DairyFundsService.finish(task, 'customer', false, tx as any), /does not reconcile/);
    canFinish = true; await DairyFundsService.finish(task, 'customer', false, tx as any); assert.equal(task.fundingStatus, 'captured'); assert.equal(updates, 1);
    await DairyFundsService.finish(task, 'customer', false, tx as any); assert.equal(updates, 1);
    task.fundingStatus = 'reserved'; await DairyFundsService.finish(task, 'customer', true, tx as any); assert.equal(task.fundingStatus, 'refunded'); assert.equal(task.isDebitedFromUser, false);
    assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), true);
    assert.equal(await DairyFundsService.reserve('sub', '2026-11-05'), false);
    assert.deepEqual(reservationKeys, ['dairy-reserve-dated-task-1', 'dairy-reserve-dated-task-2']);
  } finally { for (const [model, name, value] of originals.reverse()) model[name] = value; }
});
