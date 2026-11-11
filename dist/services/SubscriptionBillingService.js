"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionBillingService = void 0;
const SubscriptionStatement_1 = require("../models/SubscriptionStatement");
const SubscriptionDeliveryTask_1 = require("../models/SubscriptionDeliveryTask");
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const SubscriptionPriceHistory_1 = require("../models/SubscriptionPriceHistory");
const CommissionService_1 = require("./CommissionService");
const subscriptionPlan_1 = require("./subscriptionPlan");
class SubscriptionBillingService {
    static generateStatementNumber() {
        return `STM_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    }
    static async generateStatement(subscriptionId, billingPeriod) {
        const sub = await LocalShopSubscription_1.default.findById(subscriptionId);
        if (!sub)
            throw new Error('Subscription not found');
        const { startDate, endDate, billingCycle } = (0, subscriptionPlan_1.subscriptionBillingWindow)(sub, billingPeriod);
        const tasks = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.find({
            subscriptionId,
            date: { $gte: startDate, $lte: endDate }
        });
        const delivered = tasks.filter(t => t.status === 'delivered').length;
        const failed = tasks.filter(t => t.status === 'failed').length;
        const skipped = tasks.filter(t => t.status === 'cancelled' || t.status === 'pending').length;
        const deliveriesEstimate = (0, subscriptionPlan_1.plannedDeliveryCount)(sub, startDate, endDate);
        // Resolve versioned price history or fallback
        const priceHist = await SubscriptionPriceHistory_1.SubscriptionPriceHistory.findOne({
            subscriptionId,
            effectiveFrom: { $lte: endDate }
        }).sort({ effectiveFrom: -1 });
        const activePrice = priceHist ? priceHist.price : sub.unitPrice;
        const deliveryItems = [];
        for (const task of tasks.filter(t => t.status === 'delivered')) {
            const historical = await SubscriptionPriceHistory_1.SubscriptionPriceHistory.findOne({ subscriptionId, effectiveFrom: { $lte: task.date } }).sort({ effectiveFrom: -1 });
            const price = historical ? historical.price : sub.unitPrice;
            const amount = task.chargeAmount ?? Number((price * sub.quantity).toFixed(2));
            if (!Number.isFinite(amount) || amount < 0)
                throw new Error('A delivery charge is invalid. Reconcile it before billing.');
            deliveryItems.push({ taskId: task._id, date: task.date, quantity: sub.quantity, unitPrice: sub.quantity ? amount / sub.quantity : price, amount });
        }
        const grossAmount = Number(deliveryItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
        // Calculate dynamic commission splits via CommissionService
        const splits = await CommissionService_1.CommissionService.calculateSubscriptionSplits(grossAmount);
        const statementNum = this.generateStatementNumber();
        const statement = new SubscriptionStatement_1.SubscriptionStatement({
            statementNumber: statementNum,
            subscriptionId,
            vendorId: sub.vendorId,
            customerId: sub.userId,
            billingPeriod,
            billingCycle, periodStart: startDate, periodEnd: endDate,
            expectedDeliveries: deliveriesEstimate,
            delivered,
            failed,
            skipped,
            unitPrice: activePrice,
            quantity: sub.quantity,
            deliveryItems,
            grossAmount,
            platformCommission: splits.platformAmount,
            franchiseCommission: splits.franchiseAmount,
            taxes: 0,
            netVendorAmount: splits.vendorAmount,
            settlementStatus: 'draft',
            generatedDate: new Date()
        });
        await statement.save();
        return statement;
    }
}
exports.SubscriptionBillingService = SubscriptionBillingService;
