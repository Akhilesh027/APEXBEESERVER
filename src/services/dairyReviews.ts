import mongoose from 'mongoose';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { DairyReview } from '../models/DairyReview';

export const dairyRatingKeys = ['freshness', 'taste', 'deliveryTiming', 'packaging', 'overall'] as const;
export function parseDairyReview(input: any) {
  const result = Object.fromEntries(dairyRatingKeys.map(key => {
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Rate freshness, taste, delivery timing, packaging and overall experience from 1 to 5.');
    return [key, value];
  }));
  const comment = String(input.comment || '').trim();
  if (comment.length > 2000) throw new Error('Keep the review within 2,000 characters.');
  return { ...result, comment };
}
export async function ownedDairyReview(subscriptionId: string, customerId: string) {
  if (!mongoose.isValidObjectId(subscriptionId)) throw new Error('Choose a valid subscription.');
  const sub = await LocalShopSubscription.findOne({ _id: subscriptionId, userId: customerId });
  if (!sub) throw new Error('Subscription not found.');
  const [review, delivered] = await Promise.all([
    DairyReview.findOne({ subscriptionId: sub._id, customerId }),
    SubscriptionDeliveryTask.exists({ subscriptionId: sub._id, status: 'delivered' }),
  ]);
  return { sub, review, eligible: !!delivered };
}
export async function submitDairyReview(subscriptionId: string, customerId: string, input: any) {
  const { sub, review, eligible } = await ownedDairyReview(subscriptionId, customerId);
  if (!eligible) throw new Error('A confirmed delivery is required before reviewing this subscription.');
  if (review) throw new Error('This subscription already has a review.');
  return DairyReview.create({ subscriptionId: sub._id, customerId, vendorId: sub.vendorId, productId: sub.productId, customerName: sub.customerName || 'Customer', productName: sub.productName, ...parseDairyReview(input) });
}
