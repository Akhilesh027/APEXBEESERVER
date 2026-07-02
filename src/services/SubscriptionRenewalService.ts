import mongoose from 'mongoose';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionLedger } from '../models/SubscriptionLedger';

export class SubscriptionRenewalService {
  /**
   * Processes manual or auto-renewals extension checks
   */
  static async renewSubscription(subscriptionId: string | mongoose.Types.ObjectId): Promise<any> {
    const sub = await LocalShopSubscription.findById(subscriptionId);
    if (!sub) throw new Error('Subscription not found');

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30); // Extend by 30 days
    const nextDateStr = nextDate.toISOString().split('T')[0];

    sub.startDate = nextDateStr;
    sub.status = 'active';
    await sub.save();

    const log = new SubscriptionLedger({
      subscriptionId: sub._id,
      action: 'renewed',
      notes: `Subscription auto-renewed. Next cycle effective from: ${nextDateStr}`
    });
    await log.save();

    return sub;
  }
}
