import type { ClientSession } from 'mongoose';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import Product from '../models/Product';
import { Vendor } from '../models/Vendor';
import Notification from '../models/Notification';
import { currentSubscriptionCycleEnd } from './subscriptionPlan';
import { indiaDate, isDeliveryDue, validDate } from './vendorWorkspaceService';
import { getDairySettings, isDairyCatalogProduct, isDairyWeeklyHoliday } from './dairyOrderRules';
import { deliveryPeriod } from './dairyDeliveryService';

const dayMs = 86400000;

export function dairyLifecycleAction(sub: { currentPeriodEnd?: string; autoRenew?: boolean; status: string }, today: string) {
  if (!['active', 'paused'].includes(sub.status) || !validDate(sub.currentPeriodEnd)) return null;
  if (today > sub.currentPeriodEnd) return sub.autoRenew === false ? 'expire' : 'renew';
  return Date.parse(sub.currentPeriodEnd) - Date.parse(today) <= 3 * dayMs ? 'remind' : null;
}

export function dairyDelayDeadline(date: string, timing?: string) {
  if (!validDate(date)) return null;
  const endTime = timing?.trim().split(/\s*(?:[-–—]|\bto\b)\s*/i).at(-1);
  const parts = endTime?.match(/^(\d{1,2}):([0-5]\d)\s*(am|pm)?$/i);
  if (!parts) return null;
  let hour = Number(parts[1]);
  const period = parts[3]?.toLowerCase();
  if (hour > 23 || (period && (hour < 1 || hour > 12))) return null;
  if (period) hour = (hour % 12) + (period === 'pm' ? 12 : 0);
  return Date.parse(`${date}T${String(hour).padStart(2, '0')}:${parts[2]}:00+05:30`) + 30 * 60000;
}

export async function dairyNoticeOnce(dedupeKey: string, notice: { recipientId: unknown; eventCode: string; entityId: unknown; title: string; message: string }, session?: ClientSession) {
  try {
    await Notification.updateOne({ dedupeKey }, { $setOnInsert: { ...notice, dedupeKey, recipientType: 'User', entityType: 'subscription', status: 'unread', deepLink: '/my-orders' } }, { upsert: true, session });
  } catch (error: any) { if (error.code !== 11000) throw error; }
}

export async function runDairyRenewals(now = new Date()) {
  const today = indiaDate(now);
  const subscriptions = await LocalShopSubscription.find({ status: { $in: ['active', 'paused'] }, $or: [{ portalType: 'dairy' }, { portalType: null }] }).lean();
  const legacyProducts = await Product.find({ _id: { $in: subscriptions.filter(sub => !sub.portalType).map(sub => sub.productId) } }).select('sellerId categoryId subCategoryId subcategoryId dairyDetails').lean();
  const products = new Map(legacyProducts.map(product => [String(product._id), product]));
  const legacyDairy = new Map<string, boolean>();
  for (const sub of subscriptions) {
    const productId = String(sub.productId);
    if (!sub.portalType) {
      if (!legacyDairy.has(productId)) {
        const product = products.get(productId);
        legacyDairy.set(productId, !!product && await isDairyCatalogProduct(product));
      }
      if (!legacyDairy.get(productId)) continue;
    }
    if (!validDate(sub.startDate)) continue;
    const guard = { _id: sub._id, status: sub.status, autoRenew: sub.autoRenew === false ? false : { $ne: false }, currentPeriodEnd: sub.currentPeriodEnd ?? null };
    if (!sub.currentPeriodEnd) {
      const end = currentSubscriptionCycleEnd(sub, today);
      const initialized = await LocalShopSubscription.updateOne(guard, { $set: { portalType: 'dairy', currentPeriodEnd: end } });
      if (!initialized.modifiedCount) continue;
      sub.currentPeriodEnd = end;
    }
    if (today < sub.startDate) continue;
    const action = dairyLifecycleAction(sub, today);
    const end = sub.currentPeriodEnd;
    if (action === 'renew' || action === 'expire') {
      await LocalShopSubscription.updateOne({ ...guard, currentPeriodEnd: end }, { $set: action === 'renew' ? { currentPeriodEnd: currentSubscriptionCycleEnd(sub, today) } : { status: 'expired' } });
    } else if (action === 'remind') {
      await dairyNoticeOnce(`dairy-renewal-${sub._id}-${end}`, { recipientId: sub.userId, entityId: sub._id, eventCode: 'dairy.renewal_reminder',
        title: 'Dairy subscription cycle ending', message: `${sub.productName}: the current cycle ends ${end}. ${sub.autoRenew === false ? 'Auto-renew is off. Deliveries stop at the end of this cycle.' : 'Auto-renew is on. The same schedule and per-delivery pricing continue into the next cycle.'}` });
    }
  }
}

export async function sendDairyDelayNotices(now = new Date()) {
  const today = indiaDate(now);
  const tasks = await SubscriptionDeliveryTask.find({ date: today, status: { $in: ['pending', 'assigned', 'started'] } }).select('_id subscriptionId').lean();
  if (!tasks.length) return;
  const subscriptions = await LocalShopSubscription.find({ _id: { $in: tasks.map(task => task.subscriptionId) }, status: 'active', portalType: 'dairy' }).lean();
  const bySubscription = new Map(subscriptions.map(sub => [String(sub._id), sub]));
  const vendors = await Vendor.find({ _id: { $in: subscriptions.map(sub => sub.vendorId) }, status: 'active', marketplaceStatus: 'Approved' }).select('userId').lean();
  const settings = new Map(await Promise.all(vendors.map(async vendor => [String(vendor._id), await getDairySettings(vendor.userId)] as const)));
  for (const task of tasks) {
    const sub = bySubscription.get(String(task.subscriptionId));
    if (!sub || !isDeliveryDue(sub, today)) continue;
    const hours = settings.get(String(sub.vendorId));
    if (isDairyWeeklyHoliday(today, hours)) continue;
    const slot = deliveryPeriod(sub.deliverySlot);
    const timing = slot === 'morning' ? hours?.morningDelivery : slot === 'evening' ? hours?.eveningDelivery : undefined;
    const deadline = dairyDelayDeadline(today, timing) ?? dairyDelayDeadline(today, sub.deliverySlot);
    if (deadline === null || now.getTime() < deadline || !await SubscriptionDeliveryTask.exists({ _id: task._id, status: { $in: ['pending', 'assigned', 'started'] } })) continue;
    await dairyNoticeOnce(`dairy-delay-${task._id}`, { recipientId: sub.userId, entityId: sub._id, eventCode: 'dairy.delivery_delayed', title: 'Milk delivery is running late',
      message: `Your ${slot} delivery of ${sub.productName} has passed its expected time. Check My Orders for the latest status.` });
  }
}
