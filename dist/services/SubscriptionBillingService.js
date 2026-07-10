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
class SubscriptionBillingService {
    static generateStatementNumber() {
        return `STM_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    }
    static async generateStatement(subscriptionId, billingPeriod) {
        const sub = await LocalShopSubscription_1.default.findById(subscriptionId);
        if (!sub)
            throw new Error('Subscription not found');
        const startDate = `${billingPeriod}-01`;
        const endDate = `${billingPeriod}-31`;
        const tasks = await SubscriptionDeliveryTask_1.SubscriptionDeliveryTask.find({
            subscriptionId,
            date: { $gte: startDate, $lte: endDate }
        });
        const delivered = tasks.filter(t => t.status === 'delivered').length;
        const failed = tasks.filter(t => t.status === 'failed').length;
        const skipped = tasks.filter(t => t.status === 'cancelled' || t.status === 'pending').length;
        let deliveriesEstimate = 30;
        if (sub.frequency === 'weekly')
            deliveriesEstimate = 4;
        else if (sub.frequency === 'alternate')
            deliveriesEstimate = 15;
        else if (sub.frequency === 'custom')
            deliveriesEstimate = 12;
        else if (sub.frequency === 'monthly')
            deliveriesEstimate = 1;
        // Resolve versioned price history or fallback
        const priceHist = await SubscriptionPriceHistory_1.SubscriptionPriceHistory.findOne({
            subscriptionId,
            effectiveFrom: { $lte: endDate }
        }).sort({ effectiveFrom: -1 });
        const activePrice = priceHist ? priceHist.price : sub.unitPrice;
        const grossAmount = Number((delivered * activePrice * sub.quantity).toFixed(2));
        // Calculate dynamic commission splits via CommissionService
        const splits = await CommissionService_1.CommissionService.calculateSubscriptionSplits(grossAmount);
        const statementNum = this.generateStatementNumber();
        const statement = new SubscriptionStatement_1.SubscriptionStatement({
            statementNumber: statementNum,
            subscriptionId,
            vendorId: sub.vendorId,
            customerId: sub.userId,
            billingPeriod,
            expectedDeliveries: deliveriesEstimate,
            delivered,
            failed,
            skipped,
            unitPrice: activePrice,
            quantity: sub.quantity,
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
