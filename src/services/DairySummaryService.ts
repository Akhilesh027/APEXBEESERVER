import mongoose from 'mongoose';
import { Vendor } from '../models/Vendor';
import Product from '../models/Product';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { BusinessApplication } from '../models/BusinessApplication';
import { BusinessCalendar } from '../models/BusinessCalendar';
import Notification from '../models/Notification';
import { DairyRequirementSummary } from '../models/DairyOperations';
import { approvedWorkspaces, indiaDate, nextDate, isDeliveryDue, isWaterWorkspace } from './vendorWorkspaceService';
import { isDairySummaryTime, expiryStatus } from './dairyOperationsService';
import { StockBatch } from '../models/StockBatch';
import { dairyRequirements, loadDairyReportingProducts } from './dairyComponents';

export class DairySummaryService {
  static async run(now = new Date()) {
    if (!isDairySummaryTime(now)) return { generated: 0 };
    const today = indiaDate(now), date = nextDate(today);
    const vendors = await Vendor.find({ status: 'active', marketplaceStatus: 'Approved' });
    let generated = 0;
    for (const vendor of vendors) {
      try {
        const workspaces = (await approvedWorkspaces(vendor)).filter(item => item.kind === 'dairy' || isWaterWorkspace(item));
        for (const workspace of workspaces) {
          if (await DairyRequirementSummary.exists({ vendorId: vendor._id, workspaceId: workspace.id, date })) continue;
          const products = await Product.find({ sellerId: { $in: [vendor._id, vendor.userId] }, $or: [{ categoryId: workspace.id }, { subCategoryId: workspace.id }, { subcategoryId: workspace.id }] }).select('_id sellerId name dairyDetails waterDetails expiryDate attributes stock bundleComponents').lean();
          const subs = await LocalShopSubscription.find({ vendorId: vendor._id, productId: { $in: products.map(p => p._id) }, status: 'active' }).lean();
          const app = await BusinessApplication.findOne({ userId: vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').lean();
          const holiday = await BusinessCalendar.exists({ date, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: vendor._id }] });
          const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
          const water = isWaterWorkspace(workspace);
          const due = subs.filter(sub => isDeliveryDue(sub, date, !!holiday || (!water && app?.businessDetails?.dairy?.weeklyHoliday === weekday)));
          const reportingProducts = await loadDairyReportingProducts(products,vendor);
          const items = dairyRequirements(due,reportingProducts).map(item => ({productId:item.productId,name:item.productName,packs:item.packs,packSize:item.packSize,litres:item.litres,warning:item.warning}));
          const packs = items.reduce((sum,item) => sum + item.packs,0), litres = Math.round(items.reduce((sum,item) => sum + (item.litres || 0),0) * 1000) / 1000;
          const batches = await StockBatch.find({ vendorId: vendor._id, productId: { $in: products.map(p => p._id) }, remaining: { $gt: 0 } }).select('productId expiry').lean();
          const alerts = batches.filter(batch => ['expired', 'expiring_soon'].includes(expiryStatus(batch.expiry, today))).length + products.filter(p => p.stock > 0 && !batches.some(batch => String(batch.productId) === String(p._id)) && ['expired', 'expiring_soon'].includes(expiryStatus(String(p.dairyDetails?.expiryDate || p.expiryDate?.toISOString().slice(0, 10) || ''), today))).length;
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(async () => {
              if (await DairyRequirementSummary.exists({ vendorId: vendor._id, workspaceId: workspace.id, date }).session(session)) return;
              const [notification] = await Notification.create([{ recipientId: vendor.userId, recipientType: 'User', eventCode: water ? 'water.tomorrow_requirements' : 'dairy.tomorrow_requirements', title: `${water ? 'Water' : 'Milk'} requirements for ${date}`,
                message: `${due.length} deliveries · ${packs} packs · ${Math.round(litres * 1000) / 1000} recorded litres. ${items.some(item => item.warning) ? 'Some combo components need correction; totals may be incomplete. ' : ''}${alerts ? `${alerts} products or batches need an expiry check. ` : ''}Open Next Day ${water ? 'Water' : 'Milk'} Requirements for product quantities.`, status: 'unread', entityType: 'vendor', entityId: vendor._id, icon: 'milk', deepLink: `/#${water ? 'water' : 'dairy'}-demand?workspaceId=${workspace.id}` }], { session });
              await DairyRequirementSummary.create([{ vendorId: vendor._id, workspaceId: workspace.id, date, deliveries: due.length, packs, litres, items, notificationId: notification._id }], { session });
              generated++;
            });
          } catch (error: any) { if (error.code !== 11000) throw error; }
          finally { await session.endSession(); }
        }
      } catch (error: any) { console.error('[DairySummary] Could not generate vendor summary:', String(vendor._id), error.message); }
    }
    return { generated };
  }
}
