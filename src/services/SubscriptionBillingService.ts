import mongoose from 'mongoose';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionPriceHistory } from '../models/SubscriptionPriceHistory';
import { CommissionService } from './CommissionService';
import { WalletEngine } from './WalletEngine';
import { plannedDeliveryCount, subscriptionBillingWindow } from './subscriptionPlan';

export class SubscriptionBillingService {
  private static generateStatementNumber(): string {
    return `STM_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
  }

  static async generateStatement(subscriptionId: string | mongoose.Types.ObjectId, billingPeriod: string): Promise<any> {
    const sub = await LocalShopSubscription.findById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const { startDate, endDate, billingCycle } = subscriptionBillingWindow(sub, billingPeriod);

    const tasks = await SubscriptionDeliveryTask.find({
      subscriptionId,
      date: { $gte: startDate, $lte: endDate }
    });

    const delivered = tasks.filter(t => t.status === 'delivered').length;
    const failed = tasks.filter(t => t.status === 'failed').length;
    const skipped = tasks.filter(t => t.status === 'cancelled' || t.status === 'pending').length;

    const deliveriesEstimate = plannedDeliveryCount(sub, startDate, endDate);

    // Resolve versioned price history or fallback
    const priceHist = await SubscriptionPriceHistory.findOne({
      subscriptionId,
      effectiveFrom: { $lte: endDate }
    }).sort({ effectiveFrom: -1 });

    const activePrice = priceHist ? priceHist.price : sub.unitPrice;
    const deliveryItems = [];
    for (const task of tasks.filter(t => t.status === 'delivered')) {
      const historical = await SubscriptionPriceHistory.findOne({ subscriptionId, effectiveFrom: { $lte: task.date } }).sort({ effectiveFrom: -1 });
      const price = historical ? historical.price : sub.unitPrice;
      const amount = task.chargeAmount ?? Number((price * sub.quantity).toFixed(2));
      if (!Number.isFinite(amount) || amount < 0) throw new Error('A delivery charge is invalid. Reconcile it before billing.');
      deliveryItems.push({ taskId: task._id, date: task.date, quantity: sub.quantity, unitPrice: sub.quantity ? amount / sub.quantity : price, amount });
    }
    const grossAmount = Number(deliveryItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));

    // Calculate dynamic commission splits via CommissionService
    const splits = await CommissionService.calculateSubscriptionSplits(grossAmount);

    const statementNum = this.generateStatementNumber();
    const statement = new SubscriptionStatement({
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
