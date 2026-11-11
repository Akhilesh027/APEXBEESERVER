import mongoose from 'mongoose';
import { randomInt, timingSafeEqual } from 'node:crypto';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { BusinessApplication } from '../models/BusinessApplication';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { Vendor } from '../models/Vendor';
import { indiaDate, isDeliveryDue, validDate } from './vendorWorkspaceService';
import { DairyFundsService } from './DairyFundsService';
import { BatchStockService } from './batchStockService';
import { DairyDeliveryNotifications } from './dairyDeliveryNotifications';
import { WaterOperationsService } from './waterOperationsService';

export class DairyDeliveryError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
export type DairyDeliveryAction = 'assign' | 'start' | 'deliver' | 'fail';
export function deliveryPeriod(slot: string = ''): 'morning' | 'evening' | 'other' {
  if (/evening|\bpm\b/i.test(slot)) return 'evening';
  if (/morning|\bam\b/i.test(slot)) return 'morning';
  const hour = slot.match(/^\s*(\d{1,2}):\d{2}/);
  return hour && Number(hour[1]) < 24 ? Number(hour[1]) < 12 ? 'morning' : 'evening' : 'other';
}

export function dairyRiderFilter(vendor: any): Record<string, any> | null {
  const filter: Record<string, any> = { status: 'active' };
  const exact = (value: string) => new RegExp(`^${value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (vendor.mandal && vendor.district && vendor.state) {
    for (const key of ['state', 'district', 'mandal']) filter[`territory.${key}`] = exact(String(vendor[key]));
  } else if (/^\d{6}$/.test(String(vendor.pincode || ''))) filter['territory.pincode'] = String(vendor.pincode);
  else return null;
  return filter;
}

export function validDeliveryPhoto(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^\/uploads\/[\w./-]+$/.test(value) && !value.includes('..')) return true;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

export function deliveryTaskView(task: any) {
  return { id: String(task._id), date: task.date, status: task.status, riderId: task.riderId ? String(task.riderId) : null,
    proofPhoto: task.proofPhoto || '', otpVerified: !!task.otpVerified, notes: task.notes || '' };
}

export async function updateDairyDelivery(input: {
  subscriptionId: string; date: string; action: DairyDeliveryAction; actorId: string;
  vendor?: any; productIds?: any[]; riderUserId?: string; riderPartnerId?: string;
  riderId?: string; otp?: string; proofPhoto?: string; notes?: string; waterWorkspaceId?: string;
}, today = indiaDate()) {
  if (!mongoose.isValidObjectId(input.subscriptionId) || !validDate(input.date)) throw new DairyDeliveryError(400, 'Choose a valid subscription and delivery date.');
  if (!['assign', 'start', 'deliver', 'fail'].includes(input.action)) throw new DairyDeliveryError(400, 'Choose a valid delivery action.');
  const futureDays = (Date.parse(input.date) - Date.parse(today)) / 86400000;
  if (futureDays < 0 || futureDays > 30 || (input.action !== 'assign' && input.date !== today)) throw new DairyDeliveryError(400, 'Assign runs up to 30 days ahead. Start and confirm deliveries only on their delivery date.');
  if (!input.vendor && !input.riderUserId) throw new DairyDeliveryError(403, 'Delivery access is required.');
  const session = await mongoose.startSession();
  let result: any; let committedError: DairyDeliveryError | undefined;
  try {
    await session.withTransaction(async () => {
      committedError = undefined;
      const filter: any = { _id: input.subscriptionId };
      if (input.vendor) { filter.vendorId = input.vendor._id; filter.productId = { $in: input.productIds || [] }; }
      const sub = await LocalShopSubscription.findOne(filter).session(session);
      if (!sub) throw new DairyDeliveryError(404, 'Delivery not found in this dairy business.');
      let task = await SubscriptionDeliveryTask.findOne({ subscriptionId: sub._id, date: input.date }).session(session);
      if (input.riderUserId && (!task || ![input.riderUserId, input.riderPartnerId].filter(Boolean).includes(String(task.riderId)))) throw new DairyDeliveryError(403, 'This delivery is not assigned to you.');
      const vendor = input.vendor || await Vendor.findById(sub.vendorId).session(session);
      if (!vendor || vendor.status !== 'active' || vendor.marketplaceStatus !== 'Approved') throw new DairyDeliveryError(403, 'An active approved vendor is required.');
      if (task?.status === 'delivered' && input.action === 'deliver') { result = deliveryTaskView(task); return; }
      if (task && ['delivered', 'failed', 'cancelled'].includes(task.status)) throw new DairyDeliveryError(409, 'This delivery is already closed.');
      const holiday = await BusinessCalendar.findOne({ date: input.date, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: sub.vendorId }] }).session(session);
      const app = await BusinessApplication.findOne({ userId: vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').session(session);
      const weeklyHoliday = input.waterWorkspaceId || sub.portalType === 'water' ? undefined : app?.businessDetails?.dairy?.weeklyHoliday;
      const isWeeklyHoliday = !!weeklyHoliday && new Date(`${input.date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) === weeklyHoliday;
      if (!isDeliveryDue(sub, input.date, !!holiday || isWeeklyHoliday)) throw new DairyDeliveryError(409, 'This subscription is paused, skipped, on holiday, or not scheduled for this date.');
      const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 500) : '';
      if (input.action === 'assign') {
        if (!input.vendor || !mongoose.isValidObjectId(input.riderId)) throw new DairyDeliveryError(400, 'Choose an active delivery rider.');
        if (task && !['pending', 'assigned'].includes(task.status)) throw new DairyDeliveryError(409, 'A delivery already in progress cannot be reassigned.');
        const riderFilter = dairyRiderFilter(input.vendor);
        if (!riderFilter) throw new DairyDeliveryError(400, 'Complete the store territory before assigning riders.');
        const rider = await DeliveryPartner.findOne({ ...riderFilter, userId: input.riderId }).session(session);
        if (!rider) throw new DairyDeliveryError(400, 'Choose an active rider serving this store territory.');
        task = await SubscriptionDeliveryTask.findOneAndUpdate({ subscriptionId: sub._id, date: input.date, status: { $in: ['pending', 'assigned'] } }, {
          $set: { riderId: rider.userId, status: 'assigned', updatedBy: input.actorId },
          $setOnInsert: { subscriptionId: sub._id, date: input.date, otp: String(randomInt(100000, 1000000)), otpVerified: false },
        }, { new: true, upsert: !task, session, runValidators: true });
        if (!task) throw new DairyDeliveryError(409, 'The delivery changed. Refresh the delivery plan.');
        // Existing pending tasks may predate OTP generation.
        if (!/^\d{6}$/.test(task.otp || '')) { task.otp = String(randomInt(100000, 1000000)); await task.save({ session }); }
      } else {
        if (!task?.riderId) throw new DairyDeliveryError(409, 'Assign a rider before starting this delivery.');
        const update: any = { updatedBy: input.actorId };
        if (input.action === 'start') {
          if (task.status !== 'assigned') throw new DairyDeliveryError(409, 'Only assigned deliveries can be started.');
          update.status = 'started';
        } else if (input.action === 'fail') {
          if (!['assigned', 'started'].includes(task.status)) throw new DairyDeliveryError(409, 'Only assigned or started deliveries can be marked failed.');
          if (notes.length < 5) throw new DairyDeliveryError(400, 'Give a failure reason of at least five characters.');
          update.status = 'failed'; update.notes = notes;
        } else {
          if (task.status !== 'started') throw new DairyDeliveryError(409, 'Start the delivery before confirming it.');
          const otp = typeof input.otp === 'string' ? input.otp.trim() : '';
          if (otp) {
            if ((task.otpAttempts || 0) >= 5) throw new DairyDeliveryError(409, 'OTP attempts exceeded. Use delivery photo proof or contact support.');
            const matches = /^\d{6}$/.test(otp) && /^\d{6}$/.test(task.otp || '') && timingSafeEqual(Buffer.from(otp), Buffer.from(task.otp!));
            if (!matches) {
              await SubscriptionDeliveryTask.updateOne({ _id: task._id, status: 'started' }, { $inc: { otpAttempts: 1 } }, { session });
              committedError = new DairyDeliveryError(400, 'The delivery OTP does not match.'); return;
            }
            update.otpVerified = true;
          } else if (validDeliveryPhoto(input.proofPhoto)) update.proofPhoto = input.proofPhoto;
          else throw new DairyDeliveryError(400, 'Enter the customer delivery OTP or upload a delivery photo.');
          let deliveredProduct:any;
          update.batchAllocations = await BatchStockService.deliver(sub.productId, sub.quantity, session, (items,product) => { update.reportingVersion = 1; update.reportedComponents = items; deliveredProduct=product; });
          if(input.waterWorkspaceId && (!deliveredProduct?.waterDetails || String(deliveredProduct.waterDetails.workspaceId)!==input.waterWorkspaceId)) throw new DairyDeliveryError(400,'Configure this water product’s volume and container settings before delivery.');
          if(deliveredProduct?.waterDetails?.returnable) await WaterOperationsService.record({vendor,workspace:{id:String(deliveredProduct.waterDetails.workspaceId)},products:[deliveredProduct]},
            {productId:String(sub.productId),kind:'dispatch',quantity:sub.quantity,date:input.date,notes:'Containers issued with confirmed subscription delivery.',requestId:`water-auto-sub-${task._id}`},input.actorId,session,{id:sub.userId,name:sub.customerName || `Customer ${String(sub.userId).slice(-8)}`});
          update.status = 'delivered'; update.notes = notes; update.confirmedAt = new Date();
        }
        const previousStatus = task.status;
        task = await SubscriptionDeliveryTask.findOneAndUpdate({ _id: task._id, status: previousStatus }, { $set: update }, { new: true, session, runValidators: true });
        if (!task) throw new DairyDeliveryError(409, 'The delivery changed. Refresh before trying again.');
        if (['delivered', 'failed'].includes(task.status)) {
          if (task.status === 'failed' && task.isDebitedFromUser) await DairyFundsService.finish(task, sub.userId, true, session);
          await LocalShopSubscription.updateOne({ _id: sub._id }, { $addToSet: { [task.status === 'delivered' ? 'completedDates' : 'failedDates']: input.date },
            $push: { deliveryHistory: { date: input.date, status: task.status, notes, photo: task.proofPhoto || '', updatedAt: new Date() } } }, { session });
          await DairyDeliveryNotifications.completed(sub, task, vendor, session);
        }
      }
      result = deliveryTaskView(task);
    });
    if (committedError) throw committedError;
    return result;
  } catch (error: any) {
    if (error?.code === 11000) throw new DairyDeliveryError(409, 'The delivery already exists. Refresh before trying again.');
    throw error;
  } finally { await session.endSession(); }
}
