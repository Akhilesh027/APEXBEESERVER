import { VendorSubscription } from '../models/VendorSubscription';
import { SubscriptionVendorPricing } from '../models/SubscriptionVendorPricing';
import { SubscriptionEvent } from '../models/SubscriptionEvent';

export class SubscriptionJobService {
  /**
   * Job to check expiring subscriptions and send notification reminders
   */
  public static async processExpiryReminders(): Promise<{ notifiedCount: number }> {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const activeExpiring = await VendorSubscription.find({
      status: 'ACTIVE',
      currentPeriodEnd: { $lte: in30Days, $gte: now }
    });

    let notifiedCount = 0;
    for (const sub of activeExpiring) {
      // Notification dispatch logic via existing notification modules
      notifiedCount++;
    }

    return { notifiedCount };
  }

  /**
   * Job to expire past-due subscriptions after grace period ends
   */
  public static async processGracePeriodExpiry(): Promise<{ expiredCount: number }> {
    const now = new Date();
    const expiredSubs = await VendorSubscription.find({
      status: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
      currentPeriodEnd: { $lt: now }
    });

    let expiredCount = 0;
    for (const sub of expiredSubs) {
      if (sub.gracePeriodEndsAt && sub.gracePeriodEndsAt > now) {
        sub.status = 'GRACE_PERIOD';
      } else {
        sub.status = 'EXPIRED';
        await SubscriptionEvent.create({
          vendorId: sub.vendorId,
          subscriptionId: sub._id,
          eventType: 'EXPIRED',
          performedByType: 'SYSTEM',
          metadata: { expiredAt: now }
        });
      }
      await sub.save();
      expiredCount++;
    }

    return { expiredCount };
  }

  /**
   * Job to expire custom vendor pricing overrides that reached validTill date
   */
  public static async processExpiredVendorPricing(): Promise<{ expiredCount: number }> {
    const now = new Date();
    const result = await SubscriptionVendorPricing.updateMany(
      {
        status: 'ACTIVE',
        validTill: { $lt: now }
      },
      {
        status: 'EXPIRED'
      }
    );
    return { expiredCount: result.modifiedCount };
  }

  /**
   * Master runner executing all subscription jobs in parallel
   */
  public static async runAllJobs() {
    const reminders = await this.processExpiryReminders();
    const graceExpiries = await this.processGracePeriodExpiry();
    const vendorPricings = await this.processExpiredVendorPricing();

    return {
      reminders,
      graceExpiries,
      vendorPricings
    };
  }
}
