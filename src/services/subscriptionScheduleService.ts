import mongoose from 'mongoose';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { DairyFundsService } from './DairyFundsService';
import { indiaDate, nextDate, validDate } from './vendorWorkspaceService';
import { currentSubscriptionCycleEnd } from './subscriptionPlan';

export function subscriptionSkipDates(from: unknown, through: unknown, today = indiaDate()) {
  if (!validDate(from) || !validDate(through) || from <= today || through < from || Date.parse(through) - Date.parse(today) > 91 * 86400000) {
    throw new Error('Choose dates from tomorrow through the next 91 days.');
  }
  const dates: string[] = [];
  for (let day = from; day <= through; day = nextDate(day)) dates.push(day);
  return dates;
}

async function cancelFutureTasks(sub: any, dates: object, notes: string, session: mongoose.ClientSession) {
  const tasks = await SubscriptionDeliveryTask.find({ subscriptionId: sub._id, date: dates, status: { $in: ['pending', 'assigned', 'started'] } }).session(session);
  if (tasks.some(task => task.status === 'started')) throw new Error('A delivery is already in progress. Contact support before changing its schedule.');
  for (const task of tasks) if (task.isDebitedFromUser) await DairyFundsService.finish(task, sub.userId, true, session);
  await SubscriptionDeliveryTask.updateMany({ subscriptionId: sub._id, date: dates, status: { $in: ['pending', 'assigned'] } }, { $set: { status: 'cancelled', notes } }, { session });
}

export async function updateDairyAutoRenew(subscriptionId: string, autoRenew: boolean) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const sub = await LocalShopSubscription.findById(subscriptionId).session(session);
      if (!sub || !['active', 'paused'].includes(sub.status)) throw new Error('Create a new subscription to restart this plan.');
      const today = indiaDate();
      if (!sub.currentPeriodEnd || (sub.currentPeriodEnd < today && sub.autoRenew !== false)) sub.currentPeriodEnd = currentSubscriptionCycleEnd(sub, today);
      if (sub.currentPeriodEnd < today) throw new Error('Create a new subscription to restart this plan.');
      if (!autoRenew) await cancelFutureTasks(sub, { $gt: sub.currentPeriodEnd }, 'customer_renewal_disabled', session);
      else if (sub.status === 'active') await SubscriptionDeliveryTask.updateMany({ subscriptionId: sub._id, date: { $gte: today, $nin: sub.skippedDates }, status: 'cancelled', notes: 'customer_renewal_disabled', isDebitedFromUser: { $ne: true } }, [{ $set: { status: { $cond: [{ $ifNull: ['$riderId', false] }, 'assigned', 'pending'] }, notes: '' } }], { session });
      sub.portalType = 'dairy';
      sub.autoRenew = autoRenew;
      await sub.save({ session });
    });
  } finally { await session.endSession(); }
}

export async function updateCustomerSchedule(subscriptionId: string, action: 'active' | 'paused' | 'cancelled' | 'skip', date?: string, through = date) {
  const today = indiaDate();
  const skipDates = action === 'skip' ? subscriptionSkipDates(date, through, today) : [];
  const session = await mongoose.startSession(); let result: any;
  try {
    await session.withTransaction(async () => {
      const sub = await LocalShopSubscription.findById(subscriptionId).session(session);
      if (!sub) throw new Error('Subscription not found.');
      if (sub.status === 'cancelled' || sub.status === 'expired') throw new Error('Create a new subscription to restart this plan.');
      const dates = action === 'skip' ? { $in: skipDates } : { $gte: today };
      if (action !== 'active') {
        await cancelFutureTasks(sub, dates, action === 'skip' ? 'customer_subscription_skip' : action === 'paused' ? 'customer_subscription_pause' : 'customer_subscription_cancel', session);
      } else {
        const resumedDates = { $gte: today, $nin: sub.skippedDates, ...(sub.autoRenew === false && sub.currentPeriodEnd ? { $lte: sub.currentPeriodEnd } : {}) };
        const resumableReasons = sub.autoRenew === false ? ['customer_subscription_pause'] : ['customer_subscription_pause', 'customer_renewal_disabled'];
        await SubscriptionDeliveryTask.updateMany({ subscriptionId, date: resumedDates, status: 'cancelled', notes: { $in: resumableReasons }, isDebitedFromUser: { $ne: true } }, [{ $set: { status: { $cond: [{ $ifNull: ['$riderId', false] }, 'assigned', 'pending'] }, notes: '' } }], { session });
      }
      if (action === 'skip') sub.skippedDates = [...new Set([...sub.skippedDates, ...skipDates])].sort(); else sub.status = action;
      await sub.save({ session }); result = sub;
    });
    return result;
  } finally { await session.endSession(); }
}
