import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { SubscriptionBillingService } from './SubscriptionBillingService';
import { statementDeliveryWindow, subscriptionBillingWindow } from './subscriptionPlan';
import { indiaDate, validDate } from './vendorWorkspaceService';

export function lastClosedBillingPeriod(sub: any, today: string): string | null {
  if (!validDate(today) || !validDate(sub.startDate) || sub.startDate >= today) return null;
  if (sub.scheduleVersion === 2 && sub.billingCycle === 'weekly') {
    const elapsed = Math.floor((Date.parse(today) - Date.parse(sub.startDate)) / 86400000);
    if (elapsed < 7) return null;
    return new Date(Date.parse(sub.startDate) + (Math.floor(elapsed / 7) - 1) * 7 * 86400000).toISOString().slice(0, 10);
  }
  const previous = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); previous.setUTCDate(0);
  return sub.startDate <= previous.toISOString().slice(0, 10) ? previous.toISOString().slice(0, 7) : null;
}

export function billingPeriodsWithDeliveries(sub: any, dates: string[], today: string) {
  if (!validDate(sub.startDate) || !validDate(today)) return [];
  const periods = new Set<string>();
  for (const date of dates) {
    if (!validDate(date) || date < sub.startDate || date >= today) continue;
    const weekly = sub.scheduleVersion === 2 && sub.billingCycle === 'weekly';
    const period = weekly ? new Date(Date.parse(sub.startDate) + Math.floor((Date.parse(date) - Date.parse(sub.startDate)) / (7 * 86400000)) * 7 * 86400000).toISOString().slice(0,10) : date.slice(0,7);
    if (subscriptionBillingWindow(sub,period).endDate < today) periods.add(period);
  }
  return [...periods].sort();
}

// Recover all closed periods with confirmed deliveries, oldest first. Creates
// drafts only, preserving existing statements and all wallet/approval controls.
export class DairyBillingJob {
  static async run(now = new Date()) {
    const today = indiaDate(now), subs = await LocalShopSubscription.find({ startDate: { $lt: today } });
    let generated = 0, failed = 0, overlaps = 0;
    const errors: Array<{ subscriptionId: string; period?: string; message: string }> = [];
    for (const sub of subs) {
      try {
        const delivered = await SubscriptionDeliveryTask.find({subscriptionId:sub._id,status:'delivered',date:{$gte:sub.startDate,$lt:today}}).select('date').lean();
        const periods = billingPeriodsWithDeliveries(sub,delivered.map(task => task.date),today);
        if (!periods.length) continue;
        const statements = await SubscriptionStatement.find({subscriptionId:sub._id}).select('billingPeriod periodStart periodEnd').lean();
        const recorded = statements.map(statement => ({period:statement.billingPeriod,...statementDeliveryWindow(statement)}));
        for (const period of periods) {
          if (recorded.some(statement => statement.period === period)) continue;
          const window = subscriptionBillingWindow(sub,period);
          if (recorded.some(statement => statement.startDate <= window.endDate && statement.endDate >= window.startDate)) {
            overlaps++;
            if (errors.length < 100) errors.push({subscriptionId:String(sub._id),period,message:'Overlapping billing statement exists; reconcile the changed billing cycle before generating another bill.'});
            continue;
          }
          try {
            await SubscriptionBillingService.generateStatement(sub._id,period); generated++;
            recorded.push({period,...window});
          } catch (error: any) {
            if (error.code === 11000) continue;
            failed++;
            if (errors.length < 100) errors.push({subscriptionId:String(sub._id),period,message:error.message || 'Draft billing failed.'});
          }
        }
      } catch (error: any) {
        failed++;
        if (errors.length < 100) errors.push({subscriptionId:String(sub._id),message:error.message || 'Billing history could not be read.'});
      }
    }
    return { date: today, generated, failed, overlaps, errors };
  }
}
