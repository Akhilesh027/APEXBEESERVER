import mongoose from 'mongoose';
import { randomInt } from 'node:crypto';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { WalletEngine } from './WalletEngine';
import Wallet from '../models/Wallet';
import { User } from '../models/User';
import { WalletTransaction } from '../models/WalletTransaction';
import { isDeliveryDue } from './vendorWorkspaceService';
import { Vendor } from '../models/Vendor';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { BusinessApplication } from '../models/BusinessApplication';

export class DairyFundsService {
  static async reserve(subscriptionId: any, date: string) {
    const session = await mongoose.startSession(); let reserved = false;
    try {
      await session.withTransaction(async () => {
        const sub = await LocalShopSubscription.findById(subscriptionId).session(session);
        if (!sub || !isDeliveryDue(sub, date)) return;
        const vendor = await Vendor.findById(sub.vendorId).session(session);
        if (!vendor || vendor.status !== 'active' || vendor.marketplaceStatus !== 'Approved') return;
        const holiday = await BusinessCalendar.exists({ date, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: vendor._id }] }).session(session);
        const app = await BusinessApplication.findOne({ userId: vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').session(session);
        const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        if (holiday || (sub.portalType !== 'water' && app?.businessDetails?.dairy?.weeklyHoliday === weekday)) return;
        let task = await SubscriptionDeliveryTask.findOne({ subscriptionId, date }).session(session);
        if (task && (task.isDebitedFromUser || !['pending', 'assigned'].includes(task.status))) return;
        if (!task) { task = new SubscriptionDeliveryTask({ subscriptionId, date, status: sub.deliveryAgentId ? 'assigned' : 'pending', riderId: sub.deliveryAgentId || null, otp: String(randomInt(100000, 1000000)) }); await task.save({ session }); }
        const cost = Math.round(sub.quantity * sub.unitPrice * 100) / 100;
        if (!Number.isFinite(cost) || cost <= 0) throw new Error('Subscription charge must be positive.');
        const wallet = await WalletEngine.getOrCreateWallet(sub.userId, session);
        if (wallet.availableBalance < cost) return;
        const revision = (task.fundingRevision ?? 0) + 1;
        await WalletEngine.debit(sub.userId, cost, { category: 'payment', source: 'SubscriptionDeliveryTask', remarks: `Reserved for ${date}: ${sub.productName}`, referenceId: task._id, status: 'pending', operationKey: `dairy-reserve-${task._id}-${revision}` }, session);
        task.isDebitedFromUser = true; task.chargeAmount = cost; task.fundingStatus = 'reserved';
        task.fundingRevision = revision;
        task.fundingReminderDate = undefined;
        await task.save({ session }); reserved = true;
      });
      return reserved;
    } catch (error: any) { if (error.code === 11000) return false; throw error; }
    finally { await session.endSession(); }
  }

  // The exact task reference and pending debit must match. Older ambiguous
  // subscription-level holds are deliberately left for reconciliation.
  static async finish(task: any, userId: any, refund: boolean, session: mongoose.ClientSession) {
    if (!task.isDebitedFromUser || task.fundingStatus === 'captured' || task.fundingStatus === 'refunded') return;
    if (task.fundingStatus !== 'reserved' || !task.chargeAmount || task.chargeAmount <= 0) throw new Error('This older subscription charge needs reconciliation before settlement.');
    const amount = task.chargeAmount;
    const changed = await Wallet.updateOne({ userId, pendingBalance: { $gte: amount }, ledgerEntries: { $elemMatch: { referenceId: task._id, type: 'debit', status: 'pending', amount } } }, {
      $inc: { pendingBalance: -amount, ...(refund ? { availableBalance: amount } : { totalDebits: amount }), version: 1 },
      $set: { 'ledgerEntries.$.status': refund ? 'reversed' : 'completed', 'ledgerEntries.$.remarks': refund ? 'Undelivered subscription charge returned' : 'Subscription charge captured' },
    }, { session });
    if (!changed.modifiedCount) throw new Error('The reserved subscription charge does not reconcile.');
    await User.updateOne({ _id: userId }, { $inc: { 'wallet.holdBalance': -amount, ...(refund ? { 'wallet.balance': amount } : {}) } }, { session });
    await WalletTransaction.updateMany({ userId, referenceId: task._id, status: 'pending', direction: 'debit' }, { $set: { status: refund ? 'reversed' : 'completed' } }, { session });
    task.fundingStatus = refund ? 'refunded' : 'captured';
    if (refund) task.isDebitedFromUser = false;
    await task.save({ session });
  }
}
