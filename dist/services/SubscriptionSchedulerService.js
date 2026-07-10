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
const WalletLedgerService_1 = require("./WalletLedgerService");
const Notification_1 = __importDefault(require("../models/Notification"));
class SubscriptionSchedulerService {
    /**
     * Evaluates all active subscriptions and generates delivery tasks for today
     */
    static async runDailyScheduler() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayDayName = dayNames[today.getDay()];
        const activeSubs = await LocalShopSubscription_1.default.find({ status: 'active' });
        const tasksCreated = [];
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
                // 2. Check if today was skipped by the user
                if (sub.skippedDates && sub.skippedDates.includes(todayStr)) {
                    continue;
                }
                // 3. Determine if today matches the subscription frequency scheduler
                let shouldDeliver = false;
                if (sub.frequency === 'daily') {
                    shouldDeliver = true;
                }
                else if (sub.frequency === 'weekly') {
                    // Deliver on same day of week as startDate
                    const start = new Date(sub.startDate);
                    shouldDeliver = start.getDay() === today.getDay();
                }
                else if (sub.frequency === 'monthly') {
                    // Deliver on same date of month as startDate
                    const start = new Date(sub.startDate);
                    shouldDeliver = start.getDate() === today.getDate();
                }
                else if (sub.frequency === 'alternate') {
                    // Deliver on alternate days
                    const start = new Date(sub.startDate);
                    const diffTime = Math.abs(today.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    shouldDeliver = diffDays % 2 === 0;
                }
                else if (sub.frequency === 'custom' && sub.customDays) {
                    // Deliver on custom days of the week (e.g. ['Monday', 'Wednesday'])
                    shouldDeliver = sub.customDays.includes(todayDayName);
                }
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
        // Auto-run holds checks for tomorrow
        try {
            await this.processWalletHoldsForTomorrow();
        }
        catch (holdErr) {
            console.error('Failed to auto-process holds for tomorrow:', holdErr);
        }
        return {
            date: todayStr,
            tasksGenerated: tasksCreated.length
        };
    }
    /**
     * Processes wallet holds for tomorrow's deliveries
     */
    static async processWalletHoldsForTomorrow() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const tomorrowDayName = dayNames[tomorrow.getDay()];
        const activeSubs = await LocalShopSubscription_1.default.find({ status: 'active' });
        const holdsProcessed = [];
        const remindersSent = [];
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
                // 2. Check if tomorrow was skipped by the user
                if (sub.skippedDates && sub.skippedDates.includes(tomorrowStr)) {
                    continue;
                }
                // 3. Determine if tomorrow matches the subscription frequency scheduler
                let shouldDeliver = false;
                if (sub.frequency === 'daily') {
                    shouldDeliver = true;
                }
                else if (sub.frequency === 'weekly') {
                    const start = new Date(sub.startDate);
                    shouldDeliver = start.getDay() === tomorrow.getDay();
                }
                else if (sub.frequency === 'monthly') {
                    const start = new Date(sub.startDate);
                    shouldDeliver = start.getDate() === tomorrow.getDate();
                }
                else if (sub.frequency === 'alternate') {
                    const start = new Date(sub.startDate);
                    const diffTime = Math.abs(tomorrow.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    shouldDeliver = diffDays % 2 === 0;
                }
                else if (sub.frequency === 'custom' && sub.customDays) {
                    shouldDeliver = sub.customDays.includes(tomorrowDayName);
                }
                if (shouldDeliver) {
                    const cost = sub.quantity * sub.unitPrice;
                    const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(sub.userId);
                    // Find or create tomorrow's task
                    let task = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.findOne({
                        subscriptionId: sub._id,
                        date: tomorrowStr
                    });
                    if (wallet.availableBalance >= cost) {
                        // Hold funds
                        await WalletLedgerService_1.WalletLedgerService.holdSubscriptionFunds(sub.userId, cost, sub._id, `Hold for tomorrow's delivery of ${sub.productName}`);
                        if (!task) {
                            task = new SubscriptionDeliveryTask_1.SubscriptionDeliveryTask({
                                subscriptionId: sub._id,
                                date: tomorrowStr,
                                status: sub.deliveryAgentId ? 'assigned' : 'pending',
                                riderId: sub.deliveryAgentId || null,
                                otp: String(Math.floor(100000 + Math.random() * 900000)),
                                otpVerified: false,
                                isDebitedFromUser: true
                            });
                        }
                        else {
                            task.isDebitedFromUser = true;
                        }
                        await task.save();
                        // Log activity ledger
                        const log = new SubscriptionLedger_1.SubscriptionLedger({
                            subscriptionId: sub._id,
                            action: 'created',
                            notes: `Funds held (₹${cost}) and task created for date ${tomorrowStr}`,
                            newValue: task._id.toString()
                        });
                        await log.save();
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
                        // Create notification directly
                        await Notification_1.default.create({
                            recipientId: sub.userId,
                            recipientType: 'User',
                            eventCode: 'subscription.insufficient_funds',
                            status: 'unread',
                            entityType: 'subscription',
                            entityId: sub._id,
                            title: 'Action Required: Add Funds to Wallet',
                            message: `Your wallet balance (₹${wallet.availableBalance}) is insufficient for tomorrow's delivery of ${sub.productName} (₹${cost}). Please add money to avoid delivery cancellation.`,
                            icon: 'wallet',
                            color: 'red'
                        });
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
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
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
                if (!sub)
                    continue;
                const cost = sub.quantity * sub.unitPrice;
                const wallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(userId);
                if (wallet.availableBalance >= cost) {
                    // Debit/Hold funds
                    await WalletLedgerService_1.WalletLedgerService.holdSubscriptionFunds(userId, cost, sub._id, `Hold for tomorrow/today's delivery of ${sub.productName} (processed after top-up)`);
                    task.isDebitedFromUser = true;
                    await task.save();
                    // Log activity ledger
                    const log = new SubscriptionLedger_1.SubscriptionLedger({
                        subscriptionId: sub._id,
                        action: 'created',
                        notes: `Funds held (₹${cost}) after wallet deposit for date ${task.date}`,
                        newValue: task._id.toString()
                    });
                    await log.save();
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
