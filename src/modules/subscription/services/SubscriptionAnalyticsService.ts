import { VendorSubscription } from '../models/VendorSubscription';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice';
import { SubscriptionPrice } from '../models/SubscriptionPrice';

export interface ISaasAnalyticsResult {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalActiveSubscriptions: number;
  totalTrialSubscriptions: number;
  totalExpiredSubscriptions: number;
  totalGracePeriodSubscriptions: number;
  churnRatePercentage: number;
  totalGstCollected: number;
  totalDiscountsProvided: number;
  revenueByPlan: Record<string, number>;
}

export class SubscriptionAnalyticsService {
  /**
   * Calculates live SaaS business metrics for Admin Dashboard
   */
  public static async getAnalytics(): Promise<ISaasAnalyticsResult> {
    const activeSubs = await VendorSubscription.find({ status: 'ACTIVE' });
    const trialSubs = await VendorSubscription.countDocuments({ status: 'TRIAL' });
    const expiredSubs = await VendorSubscription.countDocuments({ status: 'EXPIRED' });
    const graceSubs = await VendorSubscription.countDocuments({ status: 'GRACE_PERIOD' });

    let mrr = 0;
    const revenueByPlan: Record<string, number> = {};

    for (const sub of activeSubs) {
      if (sub.primaryPriceId) {
        const price = await SubscriptionPrice.findById(sub.primaryPriceId);
        if (price) {
          let monthlyVal = price.originalAmount;
          if (price.billingCycle === 'YEARLY') {
            monthlyVal = price.originalAmount / 12;
          } else if (price.billingCycle === 'QUARTERLY') {
            monthlyVal = price.originalAmount / 3;
          }
          mrr += monthlyVal;
          const planKey = sub.primaryProductId ? sub.primaryProductId.toString() : 'Default';
          revenueByPlan[planKey] = (revenueByPlan[planKey] || 0) + monthlyVal;
        }
      }
    }

    const arr = mrr * 12;
    const totalAll = activeSubs.length + expiredSubs;
    const churnRatePercentage = totalAll > 0 ? Math.round((expiredSubs / totalAll) * 1000) / 10 : 0;

    // Calculate Invoices Totals
    const invoices = await SubscriptionInvoice.find({ status: 'ISSUED' });
    let totalGstCollected = 0;
    let totalDiscountsProvided = 0;

    invoices.forEach(inv => {
      totalGstCollected += inv.cgst + inv.sgst + inv.igst;
      totalDiscountsProvided += inv.discountAmount;
    });

    return {
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      totalActiveSubscriptions: activeSubs.length,
      totalTrialSubscriptions: trialSubs,
      totalExpiredSubscriptions: expiredSubs,
      totalGracePeriodSubscriptions: graceSubs,
      churnRatePercentage,
      totalGstCollected: Math.round(totalGstCollected),
      totalDiscountsProvided: Math.round(totalDiscountsProvided),
      revenueByPlan
    };
  }
}
