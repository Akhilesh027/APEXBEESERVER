import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { SubscriptionLedger } from '../models/SubscriptionLedger';
import { WalletEngine } from './WalletEngine';
import { DairyFundsService } from './DairyFundsService';
import { dairyNoticeOnce } from './dairySubscriptionLifecycle';
import { getDairySettingsForVendor, isDairyWeeklyHoliday } from './dairyOrderRules';
import mongoose from 'mongoose';
import { indiaDate, isDeliveryDue, nextDate } from './vendorWorkspaceService';

function dairyHolidayCheck() {
  const settings = new Map<string, ReturnType<typeof getDairySettingsForVendor>>();
  return async (sub: { portalType?: string; vendorId: unknown }, date: string) => {
    if (sub.portalType !== 'dairy') return false;
    const key = String(sub.vendorId);
    if (!settings.has(key)) settings.set(key, getDairySettingsForVendor(sub.vendorId));
    return isDairyWeeklyHoliday(date, await settings.get(key));
  };
}

export class SubscriptionSchedulerService {
  /**
   * Evaluates all active subscriptions and generates delivery tasks for today
   */
  static async runDailyScheduler(now = new Date()): Promise<any> {
    const todayStr = indiaDate(now);

    const activeSubs = await LocalShopSubscription.find({ status: 'active' });
    const tasksCreated = [];
    const isWeeklyHoliday = dairyHolidayCheck();

    for (const sub of activeSubs) {
      try {
        // 1. Check if today is a holiday in the business calendar
        const holiday = await BusinessCalendar.findOne({
          date: todayStr,
          $or: [
            { type: 'national_holiday' },
            { type: 'vendor_holiday', vendorId: sub.vendorId }
          ]
        });

        if (holiday) {
          continue; // Skip delivery task creation due to holiday
        }

        const shouldDeliver = isDeliveryDue(sub, todayStr) && !await isWeeklyHoliday(sub, todayStr);

        if (shouldDeliver) {
          // Create delivery task for today if it doesn't already exist
          const existing = await SubscriptionDeliveryTask.findOne({
            subscriptionId: sub._id,
            date: todayStr
          });

          if (!existing) {
            const task = new SubscriptionDeliveryTask({
              subscriptionId: sub._id,
              date: todayStr,
              status: sub.deliveryAgentId ? 'assigned' : 'pending',
              riderId: sub.deliveryAgentId || null,
              otp: String(Math.floor(100000 + Math.random() * 900000)), // 6 digit verification OTP
              otpVerified: false
            });
            await task.save();
            tasksCreated.push(task);

            // Log activity ledger
            const log = new SubscriptionLedger({
              subscriptionId: sub._id,
              action: 'created',
              notes: `Rider delivery task created for date ${todayStr}`,
              newValue: task._id.toString()
            });
            await log.save();
          }
        }
      } catch (err) {
        console.error(`Scheduler failed for subscription ${sub._id}:`, err);
      }
    }

    return {
      date: todayStr,
      tasksGenerated: tasksCreated.length
    };
  }

  /**
   * Processes wallet holds for tomorrow's deliveries
   */
  static async processWalletHoldsForTomorrow(now = new Date()): Promise<any> {
    const tomorrowStr = nextDate(indiaDate(now));

    const activeSubs = await LocalShopSubscription.find({ status: 'active' });
    const holdsProcessed = [];
    const remindersSent = [];
    const isWeeklyHoliday = dairyHolidayCheck();

    for (const sub of activeSubs) {
      try {
        // 1. Check if tomorrow is a holiday in the business calendar
        const holiday = await BusinessCalendar.findOne({
          date: tomorrowStr,
          $or: [
            { type: 'national_holiday' },
            { type: 'vendor_holiday', vendorId: sub.vendorId }
          ]
        });

        if (holiday) {
          continue; // Skip tomorrow due to holiday
        }

        const shouldDeliver = isDeliveryDue(sub, tomorrowStr) && !await isWeeklyHoliday(sub, tomorrowStr);

        if (shouldDeliver) {
          // Find or create tomorrow's task
          let task = await SubscriptionDeliveryTask.findOne({
            subscriptionId: sub._id,
            date: tomorrowStr
          });
          if (task && (task.isDebitedFromUser || ['cancelled', 'delivered', 'failed', 'started'].includes(task.status))) continue;
          const cost = sub.quantity * sub.unitPrice;
          const wallet = await WalletEngine.getOrCreateWallet(sub.userId);

          if (wallet.availableBalance >= cost) {
            if (await DairyFundsService.reserve(sub._id, tomorrowStr)) holdsProcessed.push(sub._id);
          } else {
            // Insufficient funds -> create task (isDebitedFromUser = false) and notify
            if (!task) {
              task = new SubscriptionDeliveryTask({
                subscriptionId: sub._id,
                date: tomorrowStr,
                status: 'pending',
                riderId: sub.deliveryAgentId || null,
                otp: String(Math.floor(100000 + Math.random() * 900000)),
                otpVerified: false,
                isDebitedFromUser: false
              });
              await task.save();
            }

            if (task.fundingReminderDate === tomorrowStr) continue;
            await dairyNoticeOnce(`subscription-funds-${task._id}`, {
              recipientId: sub.userId,
              eventCode: 'subscription.insufficient_funds',
              entityId: sub._id,
              title: 'Action Required: Add Funds to Wallet',
              message: `Your wallet balance (₹${wallet.availableBalance}) is insufficient for tomorrow's delivery of ${sub.productName} (₹${cost}). Add funds before delivery.`,
            });
            const reminder = await SubscriptionDeliveryTask.updateOne({ _id: task._id, fundingReminderDate: { $ne: tomorrowStr } }, { $set: { fundingReminderDate: tomorrowStr } });
            if (!reminder.modifiedCount) continue;

            const log = new SubscriptionLedger({
              subscriptionId: sub._id,
              action: 'failed',
              notes: `Insufficient funds for date ${tomorrowStr}. Balance: ₹${wallet.availableBalance}, Required: ₹${cost}`,
              newValue: task._id.toString()
            });
            await log.save();
            remindersSent.push(sub._id);
          }
        }
      } catch (err) {
        console.error(`Hold processing failed for subscription ${sub._id}:`, err);
      }
    }

    return {
      date: tomorrowStr,
      holdsProcessedCount: holdsProcessed.length,
      remindersSentCount: remindersSent.length
    };
  }

  /**
   * Processes unpaid holds/tasks for a user after they fund their wallet
   */
  static async processUnpaidHoldsForUser(userId: string | mongoose.Types.ObjectId): Promise<number> {
    const todayStr = indiaDate();

    const subscriptions = await LocalShopSubscription.find({ userId });
    const subIds = subscriptions.map(s => s._id);

    const unpaidTasks = await SubscriptionDeliveryTask.find({
      subscriptionId: { $in: subIds },
      isDebitedFromUser: false,
      date: { $gte: todayStr },
      status: { $in: ['pending', 'assigned'] }
    });

    let paidCount = 0;

    for (const task of unpaidTasks) {
      try {
        const sub = subscriptions.find(s => String(s._id) === String(task.subscriptionId));
        if (!sub || !isDeliveryDue(sub, task.date)) continue;

        const cost = sub.quantity * sub.unitPrice;
        const wallet = await WalletEngine.getOrCreateWallet(userId);

        if (wallet.availableBalance >= cost) {
          if (await DairyFundsService.reserve(sub._id, task.date)) paidCount++;

        }
      } catch (err) {
        console.error(`Processing unpaid hold failed for task ${task._id}:`, err);
      }
    }

    return paidCount;
  }
}
