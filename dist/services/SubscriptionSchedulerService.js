"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionSchedulerService = void 0;
const SubscriptionDeliveryTask_1 = require("../models/SubscriptionDeliveryTask");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const BusinessCalendar_1 = require("../models/BusinessCalendar");
const SubscriptionLedger_1 = require("../models/SubscriptionLedger");
const WalletEngine_1 = require("./WalletEngine");
const DairyFundsService_1 = require("./DairyFundsService");
const dairySubscriptionLifecycle_1 = require("./dairySubscriptionLifecycle");
const dairyOrderRules_1 = require("./dairyOrderRules");
const vendorWorkspaceService_1 = require("./vendorWorkspaceService");
function dairyHolidayCheck() {
    const settings = new Map();
    return async (sub, date) => {
        if (sub.portalType !== 'dairy')
            return false;
        const key = String(sub.vendorId);
        if (!settings.has(key))
            settings.set(key, (0, dairyOrderRules_1.getDairySettingsForVendor)(sub.vendorId));
        return (0, dairyOrderRules_1.isDairyWeeklyHoliday)(date, await settings.get(key));
    };
}
class SubscriptionSchedulerService {
    /**
     * Evaluates all active subscriptions and generates delivery tasks for today
     */
    static async runDailyScheduler(now = new Date()) {
        const todayStr = (0, vendorWorkspaceService_1.indiaDate)(now);
        const activeSubs = await LocalShopSubscription_1.default.find({ status: 'active' });
        const tasksCreated = [];
        const isWeeklyHoliday = dairyHolidayCheck();
        for (const sub of activeSubs) {
            try {
                // 1. Check if today is a holiday in the business calendar
                const holiday = await BusinessCalendar_1.BusinessCalendar.findOne({
                    date: todayStr,
                    $or: [
                        { type: 'national_holiday' },
                        { type: 'vendor_holiday', vendorId: sub.vendorId }
                    ]
                });
                if (holiday) {
                    continue; // Skip delivery task creation due to holiday
                }
                const shouldDeliver = (0, vendorWorkspaceService_1.isDeliveryDue)(sub, todayStr) && !await isWeeklyHoliday(sub, todayStr);
                if (shouldDeliver) {
                    // Create delivery task for today if it doesn't already exist
                    const existing = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.findOne({
                        subscriptionId: sub._id,
                        date: todayStr
                    });
                    if (!existing) {
                        const task = new SubscriptionDeliveryTask_1.SubscriptionDeliveryTask({
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
                        const log = new SubscriptionLedger_1.SubscriptionLedger({
                            subscriptionId: sub._id,
                            action: 'created',
                            notes: `Rider delivery task created for date ${todayStr}`,
                            newValue: task._id.toString()
                        });
                        await log.save();
                    }
                }
            }
            catch (err) {
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
    static async processWalletHoldsForTomorrow(now = new Date()) {
        const tomorrowStr = (0, vendorWorkspaceService_1.nextDate)((0, vendorWorkspaceService_1.indiaDate)(now));
        const activeSubs = await LocalShopSubscription_1.default.find({ status: 'active' });
        const holdsProcessed = [];
        const remindersSent = [];
        const isWeeklyHoliday = dairyHolidayCheck();
        for (const sub of activeSubs) {
            try {
                // 1. Check if tomorrow is a holiday in the business calendar
                const holiday = await BusinessCalendar_1.BusinessCalendar.findOne({
                    date: tomorrowStr,
                    $or: [
                        { type: 'national_holiday' },
                        { type: 'vendor_holiday', vendorId: sub.vendorId }
                    ]
                });
                if (holiday) {
                    continue; // Skip tomorrow due to holiday
                }
                const shouldDeliver = (0, vendorWorkspaceService_1.isDeliveryDue)(sub, tomorrowStr) && !await isWeeklyHoliday(sub, tomorrowStr);
                if (shouldDeliver) {
                    // Find or create tomorrow's task
                    let task = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.findOne({
                        subscriptionId: sub._id,
                        date: tomorrowStr
                    });
                    if (task && (task.isDebitedFromUser || ['cancelled', 'delivered', 'failed', 'started'].includes(task.status)))
                        continue;
                    const cost = sub.quantity * sub.unitPrice;
                    const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(sub.userId);
                    if (wallet.availableBalance >= cost) {
                        if (await DairyFundsService_1.DairyFundsService.reserve(sub._id, tomorrowStr))
                            holdsProcessed.push(sub._id);
                    }
                    else {
                        // Insufficient funds -> create task (isDebitedFromUser = false) and notify
                        if (!task) {
                            task = new SubscriptionDeliveryTask_1.SubscriptionDeliveryTask({
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
                        if (task.fundingReminderDate === tomorrowStr)
                            continue;
                        await (0, dairySubscriptionLifecycle_1.dairyNoticeOnce)(`subscription-funds-${task._id}`, {
                            recipientId: sub.userId,
                            eventCode: 'subscription.insufficient_funds',
                            entityId: sub._id,
                            title: 'Action Required: Add Funds to Wallet',
                            message: `Your wallet balance (₹${wallet.availableBalance}) is insufficient for tomorrow's delivery of ${sub.productName} (₹${cost}). Add funds before delivery.`,
                        });
                        const reminder = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.updateOne({ _id: task._id, fundingReminderDate: { $ne: tomorrowStr } }, { $set: { fundingReminderDate: tomorrowStr } });
                        if (!reminder.modifiedCount)
                            continue;
                        const log = new SubscriptionLedger_1.SubscriptionLedger({
                            subscriptionId: sub._id,
                            action: 'failed',
                            notes: `Insufficient funds for date ${tomorrowStr}. Balance: ₹${wallet.availableBalance}, Required: ₹${cost}`,
                            newValue: task._id.toString()
                        });
                        await log.save();
                        remindersSent.push(sub._id);
                    }
                }
            }
            catch (err) {
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
    static async processUnpaidHoldsForUser(userId) {
        const todayStr = (0, vendorWorkspaceService_1.indiaDate)();
        const subscriptions = await LocalShopSubscription_1.default.find({ userId });
        const subIds = subscriptions.map(s => s._id);
        const unpaidTasks = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.find({
            subscriptionId: { $in: subIds },
            isDebitedFromUser: false,
            date: { $gte: todayStr },
            status: { $in: ['pending', 'assigned'] }
        });
        let paidCount = 0;
        for (const task of unpaidTasks) {
            try {
                const sub = subscriptions.find(s => String(s._id) === String(task.subscriptionId));
                if (!sub || !(0, vendorWorkspaceService_1.isDeliveryDue)(sub, task.date))
                    continue;
                const cost = sub.quantity * sub.unitPrice;
                const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
                if (wallet.availableBalance >= cost) {
                    if (await DairyFundsService_1.DairyFundsService.reserve(sub._id, task.date))
                        paidCount++;
                }
            }
            catch (err) {
                console.error(`Processing unpaid hold failed for task ${task._id}:`, err);
            }
        }
        return paidCount;
    }
}
exports.SubscriptionSchedulerService = SubscriptionSchedulerService;
