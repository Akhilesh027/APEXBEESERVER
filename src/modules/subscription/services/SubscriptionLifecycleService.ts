import mongoose from 'mongoose';
import { VendorSubscription, IVendorSubscription, VendorSubscriptionStatusType } from '../models/VendorSubscription';
import { VendorSubscriptionItem, IVendorSubscriptionItem } from '../models/VendorSubscriptionItem';
import { SubscriptionProduct } from '../models/SubscriptionProduct';
import { SubscriptionPrice } from '../models/SubscriptionPrice';
import { SubscriptionPlanProfile } from '../models/SubscriptionPlanProfile';
import { SubscriptionProfilePrice } from '../models/SubscriptionProfilePrice';
import { SubscriptionEvent } from '../models/SubscriptionEvent';
import { Vendor } from '../../../models/Vendor';

export class SubscriptionLifecycleService {
  /**
   * Activates or renews a primary plan subscription for a vendor
   */
  public static async activateSubscription(
    vendorId: string,
    productId?: string,
    priceId?: string,
    orderId?: string,
    performedByUserId?: string
  ): Promise<IVendorSubscription> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const vendor = await Vendor.findById(vId);
    if (!vendor) throw new Error('Vendor not found');

    let pId: mongoose.Types.ObjectId;
    let prId: mongoose.Types.ObjectId;

    // Resolve Product or Plan Profile ID safely
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      pId = new mongoose.Types.ObjectId(productId);
    } else {
      const storeCategory = (vendor.storeType || 'FOOD_AND_DINING').toUpperCase();
      const matchedProfile = await SubscriptionPlanProfile.findOne({
        $or: [{ categoryCode: storeCategory }, { category: storeCategory }],
        tierCode: 'APEXBEE_BUSINESS',
        status: 'ACTIVE'
      })
        || await SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS', status: 'ACTIVE' })
        || await SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
      
      if (!matchedProfile) throw new Error('No active subscription plan profile available');
      pId = matchedProfile._id as mongoose.Types.ObjectId;
    }

    // Resolve Price ID safely
    if (priceId && mongoose.Types.ObjectId.isValid(priceId)) {
      prId = new mongoose.Types.ObjectId(priceId);
    } else {
      const foundPrice = await SubscriptionPrice.findOne({ productId: pId, isActive: true })
        || await SubscriptionProfilePrice.findOne({ profileId: pId, isActive: true });
      if (foundPrice) {
        prId = foundPrice._id as mongoose.Types.ObjectId;
      } else {
        prId = new mongoose.Types.ObjectId();
      }
    }

    let sub = await VendorSubscription.findOne({ vendorId: vId });
    const now = new Date();
    let durationMs = 365 * 24 * 60 * 60 * 1000; // default 1 year

    const product = await SubscriptionProduct.findById(pId);
    if (product && product.status === 'ACTIVE') {
      const price = await SubscriptionPrice.findById(prId);
      if (price) {
        if (price.durationUnit === 'DAY') durationMs = price.durationValue * 24 * 60 * 60 * 1000;
        else if (price.durationUnit === 'MONTH') durationMs = price.durationValue * 30 * 24 * 60 * 60 * 1000;
        else if (price.durationUnit === 'YEAR') durationMs = price.durationValue * 365 * 24 * 60 * 60 * 1000;
      }
    } else {
      const profile = await SubscriptionPlanProfile.findById(pId) || await SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
      if (profile) {
        const profilePrice = await SubscriptionProfilePrice.findById(prId) || await SubscriptionProfilePrice.findOne({ profileId: profile._id });
        if (profilePrice && profilePrice.billingCycle === 'MONTHLY') {
          durationMs = 30 * 24 * 60 * 60 * 1000;
        } else {
          durationMs = 365 * 24 * 60 * 60 * 1000;
        }
      }
    }

    const periodStart = now;
    const periodEnd = new Date(now.getTime() + durationMs);

    const previousState = sub ? sub.toObject() : {};

    if (!sub) {
      sub = new VendorSubscription({
        vendorId: vId,
        vendorType: vendor.storeType || 'restaurant',
        primaryProductId: pId,
        primaryPriceId: prId,
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        autoRenew: true
      });
    } else {
      sub.primaryProductId = pId;
      sub.primaryPriceId = prId;
      sub.status = 'ACTIVE';
      sub.currentPeriodStart = periodStart;
      sub.currentPeriodEnd = periodEnd;
      sub.gracePeriodEndsAt = undefined;
      sub.cancelledAt = undefined;
      sub.pausedAt = undefined;
    }

    await sub.save();

    // Upsert primary subscription line item
    await VendorSubscriptionItem.findOneAndUpdate(
      {
        subscriptionId: sub._id,
        productType: 'PLAN'
      },
      {
        vendorId: vId,
        productId: pId,
        priceId: prId,
        productType: 'PLAN',
        quantity: 1,
        status: 'ACTIVE',
        startDate: periodStart,
        expiryDate: periodEnd,
        autoRenew: sub.autoRenew
      },
      { upsert: true, new: true }
    );

    // Record Event Audit
    await SubscriptionEvent.create({
      vendorId: vId,
      subscriptionId: sub._id,
      eventType: (previousState as any).status ? 'RENEWED' : 'ACTIVATED',
      previousState,
      newState: sub.toObject(),
      performedByType: performedByUserId ? 'ADMIN' : 'SYSTEM',
      performedBy: performedByUserId ? new mongoose.Types.ObjectId(performedByUserId) : undefined,
      metadata: { orderId }
    });

    return sub;
  }

  /**
   * Activates or adds an Add-on item for a vendor
   */
  public static async activateAddon(
    vendorId: string,
    addonProductId: string,
    priceId: string,
    quantity: number = 1
  ): Promise<IVendorSubscriptionItem> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const pId = new mongoose.Types.ObjectId(addonProductId);
    const prId = new mongoose.Types.ObjectId(priceId);

    const sub = await VendorSubscription.findOne({ vendorId: vId });
    if (!sub) throw new Error('Active subscription required before purchasing add-on');

    const price = await SubscriptionPrice.findById(prId);
    if (!price) throw new Error('Invalid add-on price');

    const now = new Date();
    let durationMs = 30 * 24 * 60 * 60 * 1000;
    if (price.durationUnit === 'DAY') durationMs = price.durationValue * 24 * 60 * 60 * 1000;
    if (price.durationUnit === 'MONTH') durationMs = price.durationValue * 30 * 24 * 60 * 60 * 1000;
    if (price.durationUnit === 'YEAR') durationMs = price.durationValue * 365 * 24 * 60 * 60 * 1000;

    const expiryDate = new Date(now.getTime() + durationMs);

    const item = await VendorSubscriptionItem.create({
      subscriptionId: sub._id,
      vendorId: vId,
      productId: pId,
      priceId: prId,
      productType: 'ADDON',
      quantity,
      status: 'ACTIVE',
      startDate: now,
      expiryDate,
      autoRenew: true
    });

    return item;
  }

  /**
   * Calculates upgrade proration credit for moving from current plan to upgraded plan
   */
  public static async calculateUpgradeProration(vendorId: string): Promise<number> {
    const sub = await VendorSubscription.findOne({
      vendorId: new mongoose.Types.ObjectId(vendorId),
      status: 'ACTIVE'
    });

    if (!sub || !sub.currentPeriodEnd || !sub.currentPeriodStart || !sub.primaryPriceId) {
      return 0;
    }

    const now = new Date();
    if (sub.currentPeriodEnd <= now) return 0;

    const currentPrice = await SubscriptionPrice.findById(sub.primaryPriceId);
    if (!currentPrice) return 0;

    const totalDays = Math.max(
      1,
      Math.ceil((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    const remainingDays = Math.max(
      0,
      Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const remainingValue = Math.round((currentPrice.originalAmount * remainingDays) / totalDays);
    return remainingValue;
  }

  /**
   * Pauses a subscription (freezing remaining validity days)
   */
  public static async pauseSubscription(vendorId: string, reason: string, adminUserId?: string): Promise<IVendorSubscription> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const sub = await VendorSubscription.findOne({ vendorId: vId, status: 'ACTIVE' });
    if (!sub) throw new Error('Active subscription not found to pause');

    const now = new Date();
    const remainingDays = sub.currentPeriodEnd
      ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const prev = sub.toObject();
    sub.status = 'PAUSED' as VendorSubscriptionStatusType;
    sub.pausedAt = now;
    sub.pauseReason = reason;
    sub.remainingDaysAtPause = remainingDays;
    await sub.save();

    await SubscriptionEvent.create({
      vendorId: vId,
      subscriptionId: sub._id,
      eventType: 'PAUSED',
      previousState: prev,
      newState: sub.toObject(),
      performedByType: adminUserId ? 'ADMIN' : 'VENDOR',
      performedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
      metadata: { reason }
    });

    return sub;
  }

  /**
   * Resumes a paused subscription and recalculates expiry date
   */
  public static async resumeSubscription(vendorId: string, adminUserId?: string): Promise<IVendorSubscription> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const sub = await VendorSubscription.findOne({ vendorId: vId, status: 'PAUSED' as any });
    if (!sub) throw new Error('Paused subscription not found to resume');

    const now = new Date();
    const addMs = (sub.remainingDaysAtPause || 0) * 24 * 60 * 60 * 1000;

    const prev = sub.toObject();
    sub.status = 'ACTIVE';
    sub.currentPeriodStart = now;
    sub.currentPeriodEnd = new Date(now.getTime() + addMs);
    sub.pausedAt = undefined;
    sub.pauseReason = undefined;
    sub.remainingDaysAtPause = 0;
    await sub.save();

    await SubscriptionEvent.create({
      vendorId: vId,
      subscriptionId: sub._id,
      eventType: 'RESUMED',
      previousState: prev,
      newState: sub.toObject(),
      performedByType: adminUserId ? 'ADMIN' : 'VENDOR',
      performedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined
    });

    return sub;
  }
}
