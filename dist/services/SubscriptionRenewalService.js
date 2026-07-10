"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRenewalService = void 0;
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const SubscriptionLedger_1 = require("../models/SubscriptionLedger");
class SubscriptionRenewalService {
    /**
     * Processes manual or auto-renewals extension checks
     */
    static async renewSubscription(subscriptionId) {
        const sub = await LocalShopSubscription_1.default.findById(subscriptionId);
        if (!sub)
            throw new Error('Subscription not found');
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 30); // Extend by 30 days
        const nextDateStr = nextDate.toISOString().split('T')[0];
        sub.startDate = nextDateStr;
        sub.status = 'active';
        await sub.save();
        const log = new SubscriptionLedger_1.SubscriptionLedger({
            subscriptionId: sub._id,
            action: 'renewed',
            notes: `Subscription auto-renewed. Next cycle effective from: ${nextDateStr}`
        });
        await log.save();
        return sub;
    }
}
exports.SubscriptionRenewalService = SubscriptionRenewalService;
