import { Router } from 'express';
import mongoose from 'mongoose';
import { protect, AuthRequest } from '../middleware/auth';
import { Vendor } from '../models/Vendor';
import Category from '../models/Category';
import Product from '../models/Product';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { SubscriptionDeliveryTask } from '../models/SubscriptionDeliveryTask';
import { BusinessCalendar } from '../models/BusinessCalendar';
import { BusinessApplication } from '../models/BusinessApplication';
import { User } from '../models/User';
import { approvedWorkspaces, indiaDate, isDeliveryDue, nextDate, validDate, isWaterWorkspace } from '../services/vendorWorkspaceService';
import { dairyProductPackLabel } from '../services/dairyProductDetails';
import { subscriptionBillingWindow } from '../services/subscriptionPlan';
import { DairyDeliveryError, dairyRiderFilter, deliveryPeriod, updateDairyDelivery } from '../services/dairyDeliveryService';
import { DeliveryPartner } from '../models/DeliveryPartner';
import { DairyRoute, DairyRouteStop, DairyStockMovement, DairyRequirementSummary } from '../models/DairyOperations';
import { parseDairyMovement, dairyReportDates, expiryStatus } from '../services/dairyOperationsService';
import { Inventory } from '../models/Inventory';
import InventoryMovement from '../models/InventoryMovement';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { SubscriptionBillingService } from '../services/SubscriptionBillingService';
import { specialistTools, parseSpecialistRecord } from '../services/businessSpecialists';
import { BusinessOperation, ContainerAccount, BusinessInquiry, WaterMovement } from '../models/BusinessOperations';
import { parseWaterProduct, WaterOperationsService } from '../services/waterOperationsService';
import { DairyFundsService } from '../services/DairyFundsService';
import { arrangeDeliveryStops, mapPoint } from '../services/routePlanningService';
import { BatchStockService, flowerBatchDeadline } from '../services/batchStockService';
import { StockBatch } from '../models/StockBatch';
import { PurchaseOrder, GoodsReceipt, ProcurementSupplyStock } from '../models/PurchaseOrder';
import { Order } from '../models/Order';
import { WholesaleProcurementService } from '../services/wholesaleProcurementService';
import { ProcurementService } from '../services/procurementService';
import { randomUUID } from 'node:crypto';
import { renderBusinessPdf, statementPdfData, invoiceMoney } from '../services/businessPdfService';
import { dairyConsumption } from '../services/dairyConsumption';
import { DairyReview } from '../models/DairyReview';
import { dairyProductComponents, dairyRequirements, loadDairyReportingProducts } from '../services/dairyComponents';
import { dailyNeedsProfile, stockUnit } from '../services/dailyNeedsProfile';
import { newOrderStatuses, preparingOrderStatuses, orderDeadlineWarningMs, vendorOrderAlert } from '../services/vendorOrderAlerts';

const router = Router();
router.use(protect, async (req: AuthRequest, res, next) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.user?.id });
    if (!vendor) { res.status(403).json({ message: 'An activated vendor account is required.' }); return; }
    res.locals.vendor = vendor;
    res.locals.workspaces = await approvedWorkspaces(vendor);
    next();
  } catch { res.status(500).json({ message: 'Unable to load approved business access.' }); }
});

router.get('/', (_req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.json({ success: true, workspaces: res.locals.workspaces });
});

router.get('/alerts', async (_req, res) => {
  try {
    const { vendor, workspaces } = res.locals;
    const workspaceNames = new Map<string, string>(workspaces.map((workspace: { id: string; name: string }) => [workspace.id, workspace.name]));
    const now = Date.now();
    const today = indiaDate(new Date(now));
    const orderScope = { sellerId: { $in: [vendor._id, vendor.userId] } };
    const [newOrders, timedOrders, batches] = await Promise.all([
      Order.find({ ...orderScope, orderStatus: { $in: newOrderStatuses }, paymentStatus: { $nin: ['Failed', 'Rejected', 'Refunded'] } })
        .select('_id orderNumber orderStatus createdAt items.productId').sort({ createdAt: -1 }).lean(),
      Order.find({ ...orderScope, orderStatus: { $in: preparingOrderStatuses }, estimatedDeliveryTime: { $ne: null, $lte: new Date(now + orderDeadlineWarningMs) } })
        .select('_id orderNumber orderStatus createdAt estimatedDeliveryTime items.productId').sort({ estimatedDeliveryTime: 1 }).lean(),
      StockBatch.find({ vendorId: vendor._id, workspaceId: { $in: [...workspaceNames.keys()] }, remaining: { $gt: 0 }, expiry: { $lte: nextDate(nextDate(nextDate(today))) } })
        .select('_id workspaceId productId batchCode expiry expiryAt remaining').sort({ expiry: 1, expiryAt: 1 }).lean(),
    ]);
    const products = batches.length ? await Product.find({ _id: { $in: batches.map(batch => batch.productId) }, sellerId: orderScope.sellerId }).select('name').lean() : [];
    const productNames = new Map(products.map(product => [String(product._id), product.name]));
    const orders = [...timedOrders, ...newOrders].flatMap(order => {
      const kind = vendorOrderAlert(order, now);
      return kind ? [{
        kind, id: String(order._id), number: order.orderNumber || String(order._id),
        deadline: order.estimatedDeliveryTime, productIds: (order.items || []).map(item => String(item.productId))
      }] : [];
    });
    const expiry = batches.flatMap(batch => {
      const status = expiryStatus(batch.expiry, today, batch.expiryAt, now);
      const productName = productNames.get(String(batch.productId));
      if (!productName || (status !== 'expiring_soon' && status !== 'expired')) return [];
      const workspaceId = String(batch.workspaceId);
      return [{
        id: String(batch._id), workspaceId, workspaceName: workspaceNames.get(workspaceId), productName,
        batchCode: batch.batchCode, expiry: batch.expiry, expiryAt: batch.expiryAt, remaining: batch.remaining, status
      }];
    });
    res.set('Cache-Control', 'private, no-store');
    res.json({ orders, expiry });
  } catch {
    res.status(500).json({ message: 'Unable to load operational alerts.' });
  }
});

router.get('/alerts/orders/:id', async (req, res) => {
  try {
    const { vendor } = res.locals;
    const order = mongoose.isValidObjectId(req.params.id) && await Order.findOne({
      _id: req.params.id,
      sellerId: { $in: [vendor._id, vendor.userId] }
    })
      .populate('customerId', 'name phone')
      .populate('items.productId', 'name thumbnail images price baseSellingPrice attributes variants specifications sku SKU')
      .lean();
    if (!order) { res.status(404).json({ message: 'This order is unavailable.' }); return; }
    res.set('Cache-Control', 'private, no-store');
    res.json({ order });
  } catch {
    res.status(500).json({ message: 'Unable to open the order.' });
  }
});

// Reuse the scoped recurring-delivery engine while exposing a water-specific API.
router.use((req, res, next) => {
  if (/^\/water\/recurring(?:\/|\?|$)/.test(req.url)) {
    res.locals.waterOnly = true;
    req.url = req.url.replace(/^\/water\/recurring/, '/dairy');
  }
  next();
});

async function dairyScope(req: AuthRequest, res: any, dairyOnly = true) {
  const workspace = res.locals.workspaces.find((item: any) => item.id === String(req.query.workspaceId || req.body?.workspaceId) && (!dairyOnly || item.kind === 'dairy' || isWaterWorkspace(item)) && (!res.locals.waterOnly || isWaterWorkspace(item)));
  if (!workspace) { res.status(403).json({ message: 'Approved access to this business is required.' }); return null; }
  const vendor = res.locals.vendor;
  const children = await Category.find({ parentId: workspace.id, isActive: true }).select('_id').lean();
  const categoryIds = [new mongoose.Types.ObjectId(workspace.id), ...children.map(item => item._id)];
  const products = await Product.find({
    sellerId: { $in: [vendor._id, vendor.userId] }, $or: [
      { categoryId: { $in: categoryIds } }, { subCategoryId: { $in: categoryIds } }, { subcategoryId: { $in: categoryIds } }, { childCategoryId: { $in: categoryIds } },
    ]
  }).select('_id sellerId name stock attributes dairyDetails waterDetails expiryDate status isSubscriptionAvailable bundleComponents baseSellingPrice adminPricing batchTrackingEnabled').lean();
  return { vendor, workspace, products };
}

router.get('/catalog', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false);
    if (!scope) return;
    res.json({ success: true, products: scope.products.map(product => ({ id: String(product._id), name: product.name, stock: product.stock, status: product.status })) });
  } catch { res.status(500).json({ message: 'Unable to load this business catalog.' }); }
});

router.get('/dairy', async (req: AuthRequest, res) => {
  try {
    const date = req.query.date || indiaDate();
    if (!validDate(date)) { res.status(400).json({ message: 'Choose a valid delivery date.' }); return; }
    const scope = await dairyScope(req, res);
    if (!scope) return;
    const { vendor, workspace, products } = scope;
    const tomorrow = nextDate(date);
    const [subscriptions, application, holidays] = await Promise.all([
      LocalShopSubscription.find({ vendorId: vendor._id, productId: { $in: products.map(product => product._id) } }).lean(),
      BusinessApplication.findOne({ userId: vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').lean(),
      BusinessCalendar.find({ date: { $in: [date, tomorrow] }, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: vendor._id }] }).select('date').lean(),
    ]);
    const tasks = await SubscriptionDeliveryTask.find({ subscriptionId: { $in: subscriptions.map(sub => sub._id) }, date }).select('subscriptionId date status riderId notes proofPhoto otpVerified').lean();
    const today = indiaDate();
    const pendingFunding = isWaterWorkspace(workspace) ? [] : await SubscriptionDeliveryTask.find({
      subscriptionId: { $in: subscriptions.filter(sub => sub.status === 'active').map(sub => sub._id) },
      date: { $gte: today, $lte: nextDate(today) }, fundingReminderDate: { $ne: null },
      isDebitedFromUser: { $ne: true }, status: { $in: ['pending', 'assigned'] },
    }).select('subscriptionId date').sort({ date: 1 }).lean();
    const users = await User.find({ _id: { $in: [...subscriptions.map(sub => sub.userId), ...tasks.map(task => task.riderId)].filter(id => mongoose.isValidObjectId(id)) } }).select('name phone').lean();
    const settings = isWaterWorkspace(workspace) ? undefined : application?.businessDetails?.dairy;
    const reportingProducts = await loadDairyReportingProducts(products, vendor);
    const isHoliday = (day: string) => holidays.some(item => item.date === day) || (!!settings?.weeklyHoliday && settings.weeklyHoliday !== 'None' && new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }) === settings.weeklyHoliday);
    const rows = subscriptions.map(sub => {
      const user = users.find(item => String(item._id) === String(sub.userId));
      const product = products.find(item => String(item._id) === String(sub.productId));
      const task = tasks.find(item => String(item.subscriptionId) === String(sub._id));
      const rider = users.find(item => String(item._id) === String(task?.riderId));
      const components = dairyProductComponents(String(sub.productId), sub.quantity, reportingProducts);
      const volumes = components.filter(item => item.litres != null);
      return {
        id: String(sub._id), productId: String(sub.productId), productName: sub.productName, quantity: sub.quantity,
        packSize: dairyProductPackLabel(product), unitPrice: sub.unitPrice, frequency: sub.frequency, customDays: sub.customDays,
        billingCycle: sub.billingCycle || null, scheduleVersion: sub.scheduleVersion || 1, litres: volumes.length ? volumes.reduce((sum, item) => sum + item.litres!, 0) : null,
        componentPacks: components.reduce((sum, item) => sum + item.packs, 0), components,
        status: sub.status, startDate: sub.startDate, deliverySlot: sub.deliverySlot, skippedDates: sub.skippedDates,
        currentPeriodEnd: sub.currentPeriodEnd, autoRenew: sub.autoRenew,
        pendingPaymentDate: pendingFunding.find(task => String(task.subscriptionId) === String(sub._id))?.date,
        customerName: sub.customerName || user?.name || 'Customer', customerPhone: sub.customerPhone || user?.phone || '',
        address: sub.deliveryAddress || sub.address || '', deliveryAgentName: rider?.name || sub.deliveryAgentName || '',
        deliveryTaskId: task ? String(task._id) : null, deliveryRiderId: task?.riderId ? String(task.riderId) : null,
        deliveryPeriod: deliveryPeriod(sub.deliverySlot), deliveryProof: task?.proofPhoto || '', otpVerified: !!task?.otpVerified,
        due: isDeliveryDue(sub, date, isHoliday(date)), dueTomorrow: isDeliveryDue(sub, tomorrow, isHoliday(tomorrow)),
        deliveryStatus: task?.status || (sub.completedDates?.includes(date) ? 'delivered' : sub.failedDates?.includes(date) ? 'failed' : null),
      };
    });
    const tomorrowIds = new Set(rows.filter(row => row.dueTomorrow).map(row => row.id));
    const demand = dairyRequirements(subscriptions.filter(sub => tomorrowIds.has(String(sub._id))), reportingProducts);
    res.json({
      success: true, workspace, date, tomorrow, holiday: isHoliday(date), settings: settings || null, subscriptions: rows,
      demand, products: products.map(product => ({
        id: String(product._id), name: product.name, stock: product.stock, status: product.status,
        packSize: dairyProductPackLabel(product), expiry: product.dairyDetails?.expiryDate || product.expiryDate || product.attributes?.expiry_date || null
      })),
      summary: {
        active: rows.filter(row => row.status === 'active').length, paused: rows.filter(row => row.status === 'paused').length,
        expired: rows.filter(row => row.status === 'expired').length, pendingPayment: rows.filter(row => row.pendingPaymentDate).length,
        scheduled: rows.filter(row => row.due).length, delivered: rows.filter(row => row.deliveryStatus === 'delivered').length,
        failed: rows.filter(row => row.deliveryStatus === 'failed').length, tomorrowDeliveries: rows.filter(row => row.dueTomorrow).length
      },
    });
  } catch { res.status(500).json({ message: 'Unable to load dairy operations. Please try again.' }); }
});

router.get('/dairy/riders', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res);
    if (!scope) return;
    const filter = dairyRiderFilter(scope.vendor);
    const riders = filter ? await DeliveryPartner.find(filter).select('userId name mobile').limit(100).lean() : [];
    res.json({ success: true, riders: riders.map(rider => ({ id: String(rider.userId), name: rider.name, phone: rider.mobile })), territoryConfigured: !!filter });
  } catch { res.status(500).json({ message: 'Unable to load available dairy delivery riders.' }); }
});

router.patch('/dairy/deliveries/:id', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res);
    if (!scope) return;
    const task = await updateDairyDelivery({
      subscriptionId: req.params.id, date: req.body.date, action: req.body.action,
      actorId: req.user!.id, vendor: scope.vendor, productIds: scope.products.map(product => product._id),
      waterWorkspaceId: isWaterWorkspace(scope.workspace) ? scope.workspace.id : undefined,
      riderId: req.body.riderId, otp: req.body.otp, proofPhoto: req.body.proofPhoto, notes: req.body.notes
    });
    res.json({ success: true, message: 'Delivery updated.', task });
  } catch (error) {
    res.status(error instanceof DairyDeliveryError ? error.statusCode : 503).json({ message: error instanceof DairyDeliveryError ? error.message : 'The delivery could not be updated safely. Please refresh and try again.' });
  }
});

router.patch('/dairy/subscriptions/:id', async (req: AuthRequest, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid subscription.' }); return; }
    const scope = await dairyScope(req, res);
    if (!scope) return;
    if (!scope.workspace.canOfferSubscriptions) { res.status(403).json({ message: 'Subscription management is not enabled for this business.' }); return; }
    const { action, fromDate, toDate } = req.body;
    if (!['pause', 'resume', 'skip'].includes(action)) { res.status(400).json({ message: 'Choose pause, resume, or skip.' }); return; }
    const today = indiaDate();
    const firstDate = nextDate(today);
    const skipDates: string[] = [];
    if (action === 'skip') {
      if (!validDate(fromDate) || !validDate(toDate) || fromDate < firstDate || toDate < fromDate || (Date.parse(toDate) - Date.parse(fromDate)) / 86400000 > 90) {
        res.status(400).json({ message: 'Choose a future date range of no more than 91 days, starting tomorrow or later.' }); return;
      }
      for (let day = fromDate; day <= toDate; day = nextDate(day)) skipDates.push(day);
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const sub = await LocalShopSubscription.findOne({ _id: req.params.id, vendorId: scope.vendor._id, productId: { $in: scope.products.map(product => product._id) } }).session(session);
        if (!sub) throw new Error('NOT_FOUND');
        if (['expired', 'cancelled'].includes(sub.status)) throw new Error('PLAN_ENDED');
        const dates = action === 'skip' ? { $in: skipDates } : { $gte: today };
        if (action !== 'resume' && await SubscriptionDeliveryTask.exists({
          subscriptionId: sub._id, date: dates,
          $or: [{ isDebitedFromUser: true, fundingStatus: { $ne: 'reserved' }, status: { $ne: 'delivered' } }, { status: 'started' }]
        }).session(session)) {
          throw new Error('FUNDED_DELIVERY');
        }
        if (action !== 'resume' && await SubscriptionDeliveryTask.exists({ subscriptionId: sub._id, date: dates, status: { $in: ['pending', 'assigned'] }, isDebitedFromUser: true, fundingStatus: 'reserved' }).session(session)) {
          const fundedTasks = await SubscriptionDeliveryTask.find({ subscriptionId: sub._id, date: dates, status: { $in: ['pending', 'assigned'] }, isDebitedFromUser: true, fundingStatus: 'reserved' }).session(session);
          for (const task of fundedTasks) await DairyFundsService.finish(task, sub.userId, true, session);
        }
        if (action === 'skip') sub.skippedDates = [...new Set([...sub.skippedDates, ...skipDates])];
        else sub.status = action === 'pause' ? 'paused' : 'active';
        await sub.save({ session });
        if (action === 'resume') {
          await SubscriptionDeliveryTask.updateMany({ subscriptionId: sub._id, date: { $gte: today, $nin: sub.skippedDates }, status: 'cancelled', notes: 'vendor_subscription_pause', isDebitedFromUser: { $ne: true } },
            { $set: { status: sub.deliveryAgentId ? 'assigned' : 'pending', notes: '' } }, { session });
        } else {
          await SubscriptionDeliveryTask.updateMany({ subscriptionId: sub._id, date: dates, status: { $in: ['pending', 'assigned'] }, isDebitedFromUser: { $ne: true } },
            { $set: { status: 'cancelled', notes: action === 'pause' ? 'vendor_subscription_pause' : 'vendor_subscription_skip' } }, { session });
        }
      });
      res.json({ success: true, message: action === 'skip' ? 'Selected dates skipped.' : action === 'pause' ? 'Subscription paused.' : 'Subscription resumed.' });
    } finally { await session.endSession(); }
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'NOT_FOUND') { res.status(404).json({ message: 'Subscription not found in this dairy business.' }); return; }
    if (code === 'PLAN_ENDED') { res.status(409).json({ message: 'This subscription has ended. Ask the customer to start a new plan.' }); return; }
    if (code === 'FUNDED_DELIVERY') { res.status(409).json({ message: 'A delivery in this period has funds reserved or is already in progress. Contact support to resolve it before changing the schedule.' }); return; }
    res.status(503).json({ message: 'The schedule could not be updated safely. Please try again or contact support.' });
  }
});

router.get('/dairy/operations', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const date = req.query.date || indiaDate(); if (!validDate(date)) { res.status(400).json({ message: 'Choose a valid date.' }); return; }
    const filter = { vendorId: scope.vendor._id, workspaceId: scope.workspace.id };
    const [movements, routes, summaries, subscriptions] = await Promise.all([
      DairyStockMovement.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      DairyRoute.find({ ...filter, date }).sort({ name: 1 }).lean(),
      DairyRequirementSummary.find(filter).sort({ date: -1 }).limit(7).lean(),
      LocalShopSubscription.find({ vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }).select('_id').lean(),
    ]);
    const statements = await SubscriptionStatement.find({ vendorId: scope.vendor._id, subscriptionId: { $in: subscriptions.map(s => s._id) } }).sort({ generatedDate: -1 }).limit(100).lean();
    const batches = await StockBatch.find({ vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }).sort({ expiry: 1 }).lean();
    res.json({ movements, routes, summaries, statements, batches, expiryAlerts: [...batches.filter(batch => batch.remaining > 0).map(batch => ({ id: String(batch._id), name: `${scope.products.find(p => String(p._id) === String(batch.productId))?.name || 'Product'} · ${batch.batchCode}`, stock: batch.remaining, expiry: batch.expiry })), ...scope.products.filter(p => p.stock > 0 && !batches.some(batch => String(batch.productId) === String(p._id))).map(p => ({ id: String(p._id), name: p.name, stock: p.stock, expiry: p.dairyDetails?.expiryDate || p.expiryDate?.toISOString().slice(0, 10) || null }))].map(p => ({ ...p, status: expiryStatus(p.expiry, indiaDate()) })).filter(p => ['expired', 'expiring_soon'].includes(p.status)) });
  } catch { res.status(500).json({ message: 'Unable to load dairy operations.' }); }
});

router.post('/dairy/batches/opening', async (req: AuthRequest, res) => {
  let session: mongoose.ClientSession | undefined;
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const productId = req.body.productId;
    if (!scope.products.some(product => String(product._id) === productId)) { res.status(404).json({ message: 'Product not found in this dairy business.' }); return; }
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const product = await Product.findById(productId).session(session!);
      if (!product) throw new Error('Product not found.');
      await BatchStockService.enable(product, scope.vendor._id, scope.workspace.id, session!);
    });
    res.json({ message: 'Existing stock is now tracked as an opening batch. No quantity was added.' });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
  finally { if (session) await session.endSession(); }
});

router.post('/dairy/stock-movements', async (req: AuthRequest, res) => {
  let session: mongoose.ClientSession | undefined;
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    let parsed;
    try { parsed = parseDairyMovement(req.body, indiaDate()); } catch (error: any) { res.status(400).json({ message: error.message }); return; }
    const product = scope.products.find(p => String(p._id) === req.body.productId);
    if (!product) { res.status(404).json({ message: 'Product not found in this dairy business.' }); return; }
    session = await mongoose.startSession();
    let duplicate = false;
    await session.withTransaction(async () => {
      const existing = await DairyStockMovement.findOne({ vendorId: scope.vendor._id, requestId: parsed.requestId }).session(session!);
      if (existing) {
        if (String(existing.productId) !== String(product._id) || existing.type !== parsed.type || existing.quantity !== parsed.quantity || existing.delta !== parsed.delta) throw new Error('The stock request reference was already used for a different change.');
        duplicate = true; return;
      }
      const currentProduct = await Product.findById(product._id).session(session!);
      if (!currentProduct) throw new Error('Product not found.');
      let allocations: any[] = [];
      if (parsed.delta > 0) allocations = await BatchStockService.receive(currentProduct, scope.vendor._id, scope.workspace.id, parsed, session!);
      else if (parsed.delta < 0) allocations = await BatchStockService.allocate(product._id, -parsed.delta, session!, { mode: parsed.type === 'expired' ? 'expired' : 'wastage', batchId: req.body.batchId || undefined });
      const inventory = await Inventory.find({ storeId: { $in: [scope.vendor._id, scope.vendor.userId] }, productId: product._id }).session(session!);
      if (inventory.length > 1) throw new Error('This product has separate variant inventories. Adjust its stock in Inventory & Stock.');
      const record = inventory[0];
      if (record && currentProduct.stock + parsed.delta < record.reservedStock) throw new Error('Stock reserved for orders cannot be removed.');
      const changed = await Product.updateOne({ _id: product._id, stock: { $gte: Math.max(0, -parsed.delta) } }, { $inc: { stock: parsed.delta } }, { session });
      if (!changed.matchedCount) throw new Error('There are not enough available packs for this change.');
      if (record) await Inventory.updateOne({ _id: record._id }, { $set: { onHand: currentProduct.stock + parsed.delta, availableStock: currentProduct.stock + parsed.delta }, $inc: { damagedStock: ['wastage', 'expired'].includes(parsed.type) ? parsed.quantity : 0, version: 1 } }, { session });
      await DairyStockMovement.create([{ ...parsed, allocations, vendorId: scope.vendor._id, workspaceId: scope.workspace.id, productId: product._id, createdBy: req.user!.id }], { session });
      await InventoryMovement.create([{ productId: product._id, quantity: Math.abs(parsed.delta), type: parsed.delta > 0 ? 'inbound' : parsed.delta < 0 ? 'outbound' : 'adjustment', reason: parsed.type === 'collection' ? 'Purchase' : parsed.type === 'expired' ? 'Expired' : parsed.type === 'wastage' ? 'Damage' : 'Correction', remarks: `${parsed.type}: ${parsed.notes}`, timestamp: new Date() }], { session });
    });
    res.json({ message: duplicate ? 'This stock change was already recorded.' : 'Stock movement recorded.' });
  } catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This stock request already exists. Refresh the ledger.' : error.message || 'Unable to record stock.' }); }
  finally { if (session) await session.endSession(); }
});

router.post('/dairy/routes/optimize', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const { date, period, subscriptionIds } = req.body;
    if (!validDate(date) || date < indiaDate() || (Date.parse(date) - Date.parse(indiaDate())) / 86400000 > 30 || !['morning', 'evening', 'other'].includes(period) || !Array.isArray(subscriptionIds) || subscriptionIds.length < 1 || subscriptionIds.length > 100 || subscriptionIds.some(id => !mongoose.isValidObjectId(id)) || new Set(subscriptionIds).size !== subscriptionIds.length) { res.status(400).json({ message: 'Choose a valid delivery date, period and up to 100 different stops.' }); return; }
    const subs = await LocalShopSubscription.find({ _id: { $in: subscriptionIds }, vendorId: scope.vendor._id, productId: { $in: scope.products.map(product => product._id) } }).lean();
    const holiday = await BusinessCalendar.exists({ date, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: scope.vendor._id }] });
    const app = await BusinessApplication.findOne({ userId: scope.vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').lean();
    const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (subs.length !== subscriptionIds.length || subs.some(sub => !isDeliveryDue(sub, date, !!holiday || app?.businessDetails?.dairy?.weeklyHoliday === weekday) || deliveryPeriod(sub.deliverySlot) !== period)) { res.status(409).json({ message: 'Some stops are no longer due in this business and delivery period. Refresh the plan.' }); return; }
    const stops = subscriptionIds.map((id: string) => { const sub = subs.find(item => String(item._id) === id)!; return { id, address: sub.deliveryAddress || sub.address || '', point: mapPoint(sub.deliveryLocation) }; });
    res.json(arrangeDeliveryStops(mapPoint(scope.vendor.location), stops));
  } catch { res.status(500).json({ message: 'Unable to arrange this delivery route.' }); }
});

router.post('/dairy/routes', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const { date, period } = req.body, name = String(req.body.name || '').trim();
    if (!validDate(date) || date < indiaDate() || (Date.parse(date) - Date.parse(indiaDate())) / 86400000 > 30 || !['morning', 'evening', 'other'].includes(period) || name.length < 2 || name.length > 80 || !Array.isArray(req.body.subscriptionIds) || !req.body.subscriptionIds.length || req.body.subscriptionIds.length > 100) { res.status(400).json({ message: 'Choose a date within 30 days, route name, delivery period, and up to 100 stops.' }); return; }
    const ids = [...new Set<string>(req.body.subscriptionIds)];
    if (ids.some(id => !mongoose.isValidObjectId(id))) { res.status(400).json({ message: 'Choose valid route stops.' }); return; }
    const subs = await LocalShopSubscription.find({ _id: { $in: ids }, vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }).lean();
    const holiday = await BusinessCalendar.exists({ date, $or: [{ type: 'national_holiday' }, { type: 'vendor_holiday', vendorId: scope.vendor._id }] });
    const application = await BusinessApplication.findOne({ userId: scope.vendor.userId, status: { $in: ['verified', 'approved'] }, 'businessDetails.dairy.businessType': { $exists: true } }).sort({ updatedAt: -1 }).select('businessDetails').lean();
    const weeklyHoliday = application?.businessDetails?.dairy?.weeklyHoliday === new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (subs.length !== ids.length || subs.some(sub => !isDeliveryDue(sub, date, !!holiday || weeklyHoliday) || deliveryPeriod(sub.deliverySlot) !== period)) { res.status(409).json({ message: 'All route stops must be due in this business and delivery period. Refresh the delivery list.' }); return; }
    const conflicting = await DairyRoute.exists({ vendorId: scope.vendor._id, date, name: { $ne: name }, subscriptionIds: { $in: ids } });
    if (conflicting) { res.status(409).json({ message: 'A stop already belongs to another route for this date.' }); return; }
    const session = await mongoose.startSession(); let route;
    try {
      await session.withTransaction(async () => {
        route = await DairyRoute.findOneAndUpdate({ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, date, name }, { $set: { period, subscriptionIds: ids, updatedBy: req.user!.id } }, { upsert: true, new: true, runValidators: true, session });
        await DairyRouteStop.deleteMany({ vendorId: scope.vendor._id, routeId: route!._id }, { session });
        await DairyRouteStop.create(ids.map((subscriptionId, index) => ({ vendorId: scope.vendor._id, routeId: route!._id, name, date, subscriptionId, position: index + 1 })), { session });
      });
    } finally { await session.endSession(); }
    res.json({ message: 'Route stop sequence saved. Assign riders from the delivery plan.', route });
  } catch (error: any) { res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'A stop was assigned to another route. Refresh before saving again.' : 'Unable to save delivery route.' }); }
});

router.get('/dairy/reviews', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const reviews = await DairyReview.find({ vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ reviews });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post('/dairy/reviews/:id/reply', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const reply = String(req.body.reply || '').trim();
    if (!mongoose.isValidObjectId(req.params.id) || !reply || reply.length > 1000) throw new Error('Choose a review and enter a reply within 1,000 characters.');
    const review = await DairyReview.findOneAndUpdate({ _id: req.params.id, vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }, { $set: { reply, repliedAt: new Date() } }, { new: true, runValidators: true });
    if (!review) { res.status(404).json({ message: 'Review not found in this dairy business.' }); return; }
    res.json({ message: 'Reply saved.', review });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get('/dairy/reports', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const { from, through } = dairyReportDates(req.query.from, req.query.through, indiaDate());
    const subs = await LocalShopSubscription.find({ vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } }).select('_id quantity unitPrice productId productName customerName').lean();
    const [tasks, movements] = await Promise.all([
      SubscriptionDeliveryTask.find({ subscriptionId: { $in: subs.map(s => s._id) }, date: { $gte: from, $lte: through } }).select('subscriptionId date status isDebitedFromUser isPaidToVendor reportingVersion reportedComponents').lean(),
      DairyStockMovement.find({ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, date: { $gte: from, $lte: through } }).lean(),
    ]);
    const delivered = tasks.filter(t => t.status === 'delivered');
    const gross = delivered.reduce((sum, task) => { const sub = subs.find(s => String(s._id) === String(task.subscriptionId)); return sum + (sub ? sub.unitPrice * sub.quantity : 0); }, 0);
    res.json({
      from, through, tasks: tasks.length, delivered: delivered.length, failed: tasks.filter(t => t.status === 'failed').length, cancelled: tasks.filter(t => t.status === 'cancelled').length,
      reserved: tasks.filter(t => t.isDebitedFromUser).length, paid: tasks.filter(t => t.isPaidToVendor).length, estimatedDeliveredValue: Math.round(gross * 100) / 100,
      consumption: dairyConsumption(subs, tasks, await loadDairyReportingProducts(scope.products, scope.vendor), from, through),
      stock: ['collection', 'return', 'wastage', 'expired'].map(type => ({ type, packs: movements.filter(m => m.type === type).reduce((sum, m) => sum + m.quantity, 0) }))
    });
  } catch (error: any) { res.status(400).json({ message: error.message || 'Unable to generate report.' }); }
});

router.get('/dairy/statements/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Choose a valid statement.');
    const statement = await SubscriptionStatement.findOne({ _id: req.params.id, vendorId: scope.vendor._id });
    const subscription = statement && await LocalShopSubscription.findOne({ _id: statement.subscriptionId, vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } });
    if (!statement || !subscription) { res.status(404).json({ message: 'Statement not found in this business.' }); return; }
    const user = await User.findById(statement.customerId).select('name');
    const pdf = await renderBusinessPdf(statementPdfData(statement, scope.vendor, subscription, subscription.customerName || user?.name || 'Customer', true));
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="statement-${statement._id}.pdf"`); res.send(pdf);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post('/dairy/statements', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res); if (!scope) return;
    const sub = mongoose.isValidObjectId(req.body.subscriptionId) && await LocalShopSubscription.findOne({ _id: req.body.subscriptionId, vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) } });
    if (!sub) { res.status(404).json({ message: 'Subscription not found in this business.' }); return; }
    const window = subscriptionBillingWindow(sub, req.body.period);
    if (window.endDate >= indiaDate()) { res.status(400).json({ message: 'Generate a statement after the billing cycle has ended, so all deliveries are included.' }); return; }
    const statement = await SubscriptionBillingService.generateStatement(sub._id, req.body.period);
    res.json({ message: 'Billing statement generated for review. No wallet charges or payouts were made.', statement });
  } catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'A statement already exists for this period.' : error.message }); }
});

router.get('/water', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!isWaterWorkspace(scope.workspace)) { res.status(403).json({ message: 'Choose an approved Water Cans business.' }); return; }
    const filter = { vendorId: scope.vendor._id, workspaceId: new mongoose.Types.ObjectId(scope.workspace.id) };
    const search = String(req.query.accountSearch || '').trim().slice(0, 120);
    const accountFilter = { ...filter, ...(search ? { account: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}) };
    const { from, through } = dairyReportDates(req.query.from || `${indiaDate().slice(0, 7)}-01`, req.query.through || indiaDate(), indiaDate());
    const [accounts, movements, totals, activity] = await Promise.all([
      ContainerAccount.find(accountFilter).sort({ account: 1 }).limit(200).lean(),
      WaterMovement.find({ ...filter, date: { $gte: from, $lte: through } }).sort({ createdAt: -1 }).limit(100).lean(),
      ContainerAccount.aggregate([{ $match: filter }, { $group: { _id: null, customers: { $sum: 1 }, outstanding: { $sum: '$outstanding' }, depositPaise: { $sum: '$depositPaise' } } }]),
      WaterMovement.aggregate([{ $match: { ...filter, date: { $gte: from, $lte: through } } }, { $group: { _id: '$kind', quantity: { $sum: '$quantity' }, amountPaise: { $sum: '$amountPaise' }, entries: { $sum: 1 } } }]),
    ]);
    res.json({ workspace: scope.workspace, products: scope.products.map(p => ({ id: String(p._id), name: p.name, stock: p.stock, price: p.adminPricing?.customerSellingAmount ?? p.adminPricing?.sellingPrice ?? p.baseSellingPrice, waterDetails: p.waterDetails || null })), accounts, movements, totals: totals[0] || { customers: 0, outstanding: 0, depositPaise: 0 }, activity, from, through });
  } catch (error: any) { res.status(400).json({ message: error.message || 'Unable to load Water Cans.' }); }
});

router.patch('/water/products/:id', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!isWaterWorkspace(scope.workspace)) { res.status(403).json({ message: 'Choose an approved Water Cans business.' }); return; }
    const product = scope.products.find(p => String(p._id) === req.params.id);
    if (!product) { res.status(404).json({ message: 'Water product not found in this business.' }); return; }
    const details = parseWaterProduct(req.body, scope.workspace.id);
    if (details.returnable && product.bundleComponents?.length) throw new Error('Configure returnable cans as individual products, rather than a kit or combo.');
    await Product.updateOne({ _id: req.params.id, sellerId: { $in: [scope.vendor._id, scope.vendor.userId] } }, { $set: { waterDetails: details } }, { runValidators: true });
    await LocalShopSubscription.updateMany({ vendorId: scope.vendor._id, productId: req.params.id }, { $set: { portalType: 'water' } });
    res.json({ message: 'Water volume, returnable container and deposit settings saved.' });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.post('/water/movements', async (req: AuthRequest, res) => {
  let session: mongoose.ClientSession | undefined;
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!isWaterWorkspace(scope.workspace)) { res.status(403).json({ message: 'Choose an approved Water Cans business.' }); return; }
    if (String(req.body.requestId || '').startsWith('water-auto-')) throw new Error('Automatic delivery references cannot be entered manually.');
    session = await mongoose.startSession(); let result: any;
    await session.withTransaction(async () => { result = await WaterOperationsService.record(scope, req.body, req.user!.id, session!); });
    res.json({ message: result.duplicate ? 'This movement was already recorded.' : 'Movement recorded. Empty cans do not add filled stock. Deposit entries do not transfer money.' });
  } catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This movement already exists. Refresh the ledger.' : error.message }); }
  finally { if (session) await session.endSession(); }
});

router.get('/daily-needs/overview', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false);
    if (!scope) return;
    const profile = dailyNeedsProfile(scope.workspace);
    const flowers = scope.workspace.kind === 'flowers';
    if (!profile && !flowers) { res.status(403).json({ message: 'Choose an approved business with batch stock tools.' }); return; }
    const today = indiaDate();
    const { from, through } = dairyReportDates(req.query.from ?? `${today.slice(0, 7)}-01`, req.query.through ?? today, today);
    const productIds = scope.products.map(product => product._id);
    const filter = { vendorId: scope.vendor._id, workspaceId: new mongoose.Types.ObjectId(scope.workspace.id) };
    const orderScope = { sellerId: { $in: [scope.vendor._id, scope.vendor.userId] }, 'items.productId': { $in: productIds } };
    const fulfilled = ['Delivered', 'delivered', 'Completed', 'completed'];
    const end = new Date(`${nextDate(through)}T00:00:00+05:30`);
    const [batches, activity, orders, sold, certificates, flowerQueue] = await Promise.all([
      StockBatch.find({ vendorId: scope.vendor._id, productId: { $in: productIds }, remaining: { $gt: 0 } }).sort({ expiry: 1 }).lean(),
      BusinessOperation.aggregate([{ $match: { ...filter, date: { $gte: from, $lte: through } } },
      { $group: { _id: { productId: '$productId', kind: '$kind' }, count: { $sum: 1 }, quantity: { $sum: '$quantity' } } }]),
      Order.aggregate([{ $match: { ...orderScope, createdAt: { $gte: new Date(`${from}T00:00:00+05:30`), $lt: end } } },
      { $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
      Order.aggregate([{ $match: { ...orderScope, orderStatus: { $in: fulfilled }, createdAt: { $gte: new Date(`${from}T00:00:00+05:30`), $lt: end } } },
      { $unwind: '$items' }, { $match: { 'items.productId': { $in: productIds } } },
      { $group: { _id: '$items.productId', quantity: { $sum: '$items.quantity' }, itemValue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } }]),
      profile === 'organic' ? BusinessOperation.aggregate([
        { $match: { ...filter, kind: 'certification', productId: { $in: productIds } } },
        { $sort: { date: -1, createdAt: -1 } }, { $group: { _id: '$productId', record: { $first: '$$ROOT' } } },
      ]) : [],
      flowers ? Order.find({ ...orderScope, orderStatus: { $in: [...newOrderStatuses, ...preparingOrderStatuses, 'Packed', 'packed', 'ready_for_pickup', 'Ready', 'ready'] },
        paymentStatus: { $nin: ['Failed', 'Rejected', 'Refunded'] } })
        .select('_id orderNumber orderStatus items estimatedDeliveryTime isSelfPickup fulfillment.type').sort({ estimatedDeliveryTime: 1, createdAt: 1 }).lean() : [],
    ]);
    const products = scope.products.map(product => {
      const expiry = product.expiryDate?.toISOString().slice(0, 10) ?? (validDate(product.attributes?.expiry_date) ? product.attributes.expiry_date : null);
      return {
        id: String(product._id), name: product.name, stock: product.stock, unit: stockUnit(product.attributes), expiry,
        expiryStatus: expiryStatus(expiry, today), batchTrackingEnabled: !!product.batchTrackingEnabled,
        price: product.adminPricing?.customerSellingAmount ?? product.adminPricing?.sellingPrice ?? product.baseSellingPrice ?? null
      };
    });
    const workspaceProducts = new Set(productIds.map(String));
    const preparation = flowerQueue.map(order => ({ id: String(order._id), number: order.orderNumber, status: order.orderStatus,
      due: order.estimatedDeliveryTime, pickup: order.isSelfPickup || order.fulfillment?.type === 'pickup',
      items: order.items.filter(item => workspaceProducts.has(String(item.productId))).map(item => ({ name: item.productName, quantity: item.quantity })) }));
    res.json({
      products, activity, orders, sold, certificates, preparation, from, through, today,
      batches: batches.map(batch => ({ ...batch, status: expiryStatus(batch.expiry, today, batch.expiryAt) }))
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Unable to load this business overview.' });
  }
});

router.get('/specialist', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!['catalog', 'flowers'].includes(scope.workspace.kind)) { res.status(400).json({ message: 'Use the specialist portal for this business.' }); return; }
    const filter = { vendorId: scope.vendor._id, workspaceId: scope.workspace.id };
    const tools = specialistTools(scope.workspace);
    const [records, containers, inquiries, batches] = await Promise.all([
      BusinessOperation.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      ContainerAccount.find(filter).sort({ account: 1 }).limit(200).lean(),
      BusinessInquiry.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
      tools.batchDisposal ? StockBatch.find({ vendorId: scope.vendor._id, productId: { $in: scope.products.map(p => p._id) }, remaining: { $gt: 0 } }).sort({ expiry: 1 }).lean() : [],
    ]);
    res.json({
      tools,
      workspace: scope.workspace,
      products: scope.products.map(p => ({
        id: String(p._id),
        name: p.name,
        stock: p.stock,
        price: p.adminPricing?.customerSellingAmount ?? p.adminPricing?.sellingPrice ?? p.baseSellingPrice ?? 0,
        status: p.status || 'Active',
        expiry: p.expiryDate || p.attributes?.expiry_date || null,
        unit: stockUnit(p.attributes),
        attributes: p.attributes || {},
        batchTrackingEnabled: p.batchTrackingEnabled
      })),
      records,
      containers,
      inquiries,
      batches: batches.map(batch => ({ ...batch, status: expiryStatus(batch.expiry, indiaDate(), batch.expiryAt) }))
    });
  } catch { res.status(500).json({ message: 'Unable to load business operations.' }); }
});

router.post('/specialist/products', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false);
    if (!scope) return;
    if (scope.workspace.categoryName.toLowerCase().trim() === 'devotional') {
      res.status(403).json({ message: 'Use Add Product to submit Devotional listings for review.' }); return;
    }
    const { name, price, stock, unit, status, attributes, description } = req.body;
    if (!name || !name.trim()) throw new Error('Product name is required.');
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) throw new Error('Valid selling price is required.');
    const stockNum = Number(stock ?? 10);
    const sku = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;

    const product = await Product.create({
      name: name.trim(),
      slug,
      description: description?.trim() || `${name.trim()} - Devotional pooja item`,
      categoryId: new mongoose.Types.ObjectId(scope.workspace.categoryId),
      subCategoryId: new mongoose.Types.ObjectId(scope.workspace.id),
      subcategoryId: new mongoose.Types.ObjectId(scope.workspace.id),
      sellerId: scope.vendor._id,
      createdBy: req.user!.id,
      stock: Math.max(0, stockNum),
      sku,
      baseMrp: Math.round(priceNum * 1.15),
      baseSellingPrice: priceNum,
      adminPricing: {
        sellingPrice: priceNum,
        customerSellingAmount: priceNum,
        commissionPercent: 5
      },
      status: status === 'Inactive' ? 'Inactive' : 'Active',
      isActive: status !== 'Inactive',
      moderationStatus: 'approved',
      attributes: {
        ...(attributes || {}),
        unit: unit || 'pcs'
      }
    });

    res.json({ success: true, message: 'Devotional product created and linked to this workspace successfully.', product });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Unable to create product.' });
  }
});

router.post('/specialist/quick-seed-catalog', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false);
    if (!scope) return;
    if (scope.workspace.categoryName.toLowerCase().trim() === 'devotional') {
      res.status(403).json({ message: 'Use Add Product to submit Devotional listings for review.' }); return;
    }

    const wsName = scope.workspace.name.toLowerCase();
    const templates: Array<{ name: string; price: number; stock: number; unit: string; attributes: any }> = [];

    if (/pooja.*essential/.test(wsName)) {
      templates.push(
        { name: "Premium Sandalwood Agarbatti (Pack of 20)", price: 60, stock: 50, unit: "pcs", attributes: { fragrance: "Sandalwood", purity_grade: "Grade A Premium" } },
        { name: "Pure Karpooram / Camphor Tablets (100g)", price: 90, stock: 40, unit: "pack", attributes: { purity_grade: "Grade A Premium" } },
        { name: "Handcrafted Cow Ghee Diya Wicks (50 pcs)", price: 120, stock: 35, unit: "pack", attributes: { purity_grade: "Organic" } },
        { name: "Natural Kumkum & Turmeric Duo Pack (100g)", price: 75, stock: 45, unit: "pack", attributes: { purity_grade: "Grade A Premium" } }
      );
    } else if (/kit|ritual/.test(wsName)) {
      templates.push(
        { name: "Satyanarayana Vratham Complete Kit", price: 999, stock: 15, unit: "kit", attributes: { kit_type: "Complete Kit", instructions_included: true } },
        { name: "Daily Archana Puja Kit", price: 249, stock: 25, unit: "kit", attributes: { kit_type: "Daily Kit" } },
        { name: "Grihapravesam & Homam Sacred Kit", price: 1499, stock: 10, unit: "kit", attributes: { kit_type: "Complete Kit", instructions_included: true } }
      );
    } else if (/combo|festival/.test(wsName)) {
      templates.push(
        { name: "Diwali Lakshmi Kubera Special Combo", price: 1299, stock: 20, unit: "combo", attributes: { festival_name: "Diwali", combo_tier: "Family" } },
        { name: "Vinayaka Chavithi Complete Puja Combo", price: 899, stock: 25, unit: "combo", attributes: { festival_name: "Vinayaka Chavithi", combo_tier: "Standard" } },
        { name: "Varalakshmi Vratham Grand Festive Combo", price: 1199, stock: 18, unit: "combo", attributes: { festival_name: "Varalakshmi Vratham", combo_tier: "Premium" } }
      );
    } else if (/flower|garland/.test(wsName)) {
      templates.push(
        { name: "Fresh Fragrant Jasmine String (1 Meter)", price: 150, stock: 30, unit: "strings", attributes: { flower_type: "Jasmine", freshness_hours: 18 } },
        { name: "Fresh Marigold & Betel Garland (2.5 Ft)", price: 180, stock: 20, unit: "pieces", attributes: { flower_type: "Marigold", freshness_hours: 24 } },
        { name: "Sacred Red Hibiscus & Lotus Pair", price: 120, stock: 15, unit: "pieces", attributes: { flower_type: "Lotus", freshness_hours: 12 } }
      );
    } else if (/fruit|coconut/.test(wsName)) {
      templates.push(
        { name: "Sacred Pooja Coconuts (Pack of 2)", price: 70, stock: 40, unit: "pcs", attributes: {} },
        { name: "Panchamrutham 5-Fruit Puja Basket", price: 299, stock: 15, unit: "basket", attributes: {} }
      );
    } else if (/sweet|prasadam/.test(wsName)) {
      templates.push(
        { name: "Pure Cow Ghee Besan Ladoo Prasadam (250g)", price: 160, stock: 25, unit: "box", attributes: { purity_grade: "Grade A Premium" } },
        { name: "Traditional Panchamrutham Pouch (200ml)", price: 110, stock: 30, unit: "pouch", attributes: {} }
      );
    } else if (/idol|statue|fram/.test(wsName)) {
      templates.push(
        { name: "Eco-Friendly Water-Soluble Clay Ganesha (8 Inch)", price: 450, stock: 15, unit: "pieces", attributes: {} },
        { name: "Tirupati Balaji Gold Foil Framed Picture (10x12 Inch)", price: 599, stock: 12, unit: "pieces", attributes: {} }
      );
    } else if (/brass|copper|utensil/.test(wsName)) {
      templates.push(
        { name: "Solid Brass Peacock Diya / Deepam (5.5 Inch)", price: 480, stock: 18, unit: "pieces", attributes: {} },
        { name: "Pure Copper Pancha Patra with Spoon", price: 350, stock: 20, unit: "pieces", attributes: {} }
      );
    } else if (/book|media|spiritual/.test(wsName)) {
      templates.push(
        { name: "Bhagavad Gita As It Is (Telugu / English Edition)", price: 220, stock: 25, unit: "copies", attributes: {} },
        { name: "Sri Lalitha Sahasranama Stotram with Meaning", price: 140, stock: 30, unit: "copies", attributes: {} }
      );
    } else {
      templates.push(
        { name: "Wholesale Pooja Camphor Tablets (1 Kg Box)", price: 750, stock: 20, unit: "kg", attributes: {} },
        { name: "Raw Incense / Agarbatti Bulk Bundle (5 Kg)", price: 1200, stock: 10, unit: "kg", attributes: {} }
      );
    }

    const created = [];
    for (const t of templates) {
      const sku = `DEV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const slug = `${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(2, 6)}`;
      const p = await Product.create({
        name: t.name,
        slug,
        description: `${t.name} - Verified Devotional Product`,
        categoryId: new mongoose.Types.ObjectId(scope.workspace.categoryId),
        subCategoryId: new mongoose.Types.ObjectId(scope.workspace.id),
        subcategoryId: new mongoose.Types.ObjectId(scope.workspace.id),
        sellerId: scope.vendor._id,
        createdBy: req.user!.id,
        stock: t.stock,
        sku,
        baseMrp: Math.round(t.price * 1.15),
        baseSellingPrice: t.price,
        adminPricing: { sellingPrice: t.price, customerSellingAmount: t.price, commissionPercent: 5 },
        status: 'Active',
        isActive: true,
        moderationStatus: 'approved',
        attributes: { ...t.attributes, unit: t.unit }
      });
      created.push(p);
    }

    res.json({ success: true, message: `Quick-seeded ${created.length} starter devotional products for this workspace.`, count: created.length });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Unable to quick-seed products.' });
  }
});

router.patch('/specialist/products/:id', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false);
    if (!scope) return;
    const { stock, price, status } = req.body;
    const product = scope.products.find(p => String(p._id) === req.params.id);
    if (!product) { res.status(404).json({ message: 'Product not found in this business.' }); return; }

    const update: any = {};
    if (stock != null && Number.isFinite(Number(stock))) {
      update.stock = Math.max(0, Number(stock));
    }
    if (price != null && Number.isFinite(Number(price)) && Number(price) > 0) {
      update.baseSellingPrice = Number(price);
      update['adminPricing.sellingPrice'] = Number(price);
      update['adminPricing.customerSellingAmount'] = Number(price);
    }
    if (status && ['Active', 'Inactive'].includes(status)) {
      update.status = status;
      update.isActive = status === 'Active';
    }

    await Product.updateOne({ _id: product._id }, { $set: update });
    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Unable to update product.' });
  }
});

router.post('/specialist/records', async (req: AuthRequest, res) => {
  let session: mongoose.ClientSession | undefined;
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!['catalog', 'flowers'].includes(scope.workspace.kind)) { res.status(400).json({ message: 'Use this business’s specialist portal.' }); return; }
    const product = scope.products.find(p => String(p._id) === req.body.productId);
    if (!product) { res.status(404).json({ message: 'Product not found in this approved business.' }); return; }
    const record = parseSpecialistRecord(req.body, specialistTools(scope.workspace), indiaDate());
    const timedReceipt = scope.workspace.kind === 'flowers' && record.kind === 'stock_in';
    const expiryTime = timedReceipt ? String(req.body.expiryTime || '') : undefined;
    const expiryAt = timedReceipt ? flowerBatchDeadline(record.expiry, expiryTime) : undefined;
    const parsed = { ...record, expiryTime };
    const unit = stockUnit(product.attributes).toLowerCase();
    const { batchId, openingExpiry } = req.body;
    if (batchId && !mongoose.isValidObjectId(batchId)) throw new Error('Choose a valid batch.');
    if (parsed.kind === 'expired_disposal' && !batchId) throw new Error('Choose the expired batch to discard.');
    if (!Number.isInteger(parsed.quantity) && !['kg', 'kilogram', 'g', 'gram', 'litre', 'liter', 'l', ...(scope.workspace.kind === 'flowers' ? ['m'] : [])].includes(unit)) throw new Error('Choose a stock unit that supports fractional quantities, or enter whole units.');
    session = await mongoose.startSession(); let duplicate = false;
    await session.withTransaction(async () => {
      const previous = await BusinessOperation.findOne({ vendorId: scope.vendor._id, requestId: parsed.requestId }).session(session!);
      if (previous) {
        const sameScope = String(previous.workspaceId) === scope.workspace.id && String(previous.productId) === String(product._id);
        const sameBatch = String(previous.batchId || '') === String(batchId || '');
        const sameDetails = Object.entries(parsed).every(([field, value]) => (previous.get(field) ?? '') === (value ?? ''));
        if (!sameScope || !sameBatch || !sameDetails) throw new Error('The request reference belongs to a different record.');
        duplicate = true; return;
      }
      if (scope.workspace.kind === 'flowers' && product.batchTrackingEnabled && ['freshness_check', 'expiry_check'].includes(parsed.kind)) {
        if (!batchId || !await StockBatch.exists({ _id: batchId, vendorId: scope.vendor._id, productId: product._id, remaining: { $gt: 0 } }).session(session!)) {
          throw new Error('Choose a stock batch for this flower product.');
        }
      }
      const delta = parsed.kind === 'stock_in' ? parsed.quantity : ['wastage', 'expired_disposal'].includes(parsed.kind) ? -parsed.quantity : 0;
      if (delta) {
        const current = await Product.findById(product._id).session(session!);
        if (!current) throw new Error('Product stock is no longer available.');
        const records = await Inventory.find({ productId: product._id }).session(session!);
        if (records.length > 1) throw new Error('Use Inventory & Stock to adjust this product’s separate variants.');
        if (records[0] && current.stock + delta < records[0].reservedStock) throw new Error('Reserved stock cannot be removed.');
        if (delta > 0 && (current.batchTrackingEnabled || specialistTools(scope.workspace).freshness || parsed.expiry)) {
          if (!current.batchTrackingEnabled && records[0]?.reservedStock > 0) throw new Error('Finish or release existing stock reservations before enabling batch tracking.');
          if (!current.batchTrackingEnabled && current.stock > 0 && !current.expiryDate && !current.dairyDetails?.expiryDate && validDate(openingExpiry)) {
            current.expiryDate = new Date(`${openingExpiry}T00:00:00Z`);
            await Product.updateOne({ _id: current._id }, { $set: { expiryDate: current.expiryDate } }, { session });
          }
          await BatchStockService.receive(current, scope.vendor._id, scope.workspace.id, { batch: parsed.reference, expiry: parsed.expiry, expiryAt, date: parsed.date, quantity: delta, supplier: parsed.supplier }, session!);
        }
        if (delta < 0) {
          if (batchId && !current.batchTrackingEnabled) throw new Error('This product is not tracked by batch.');
          await BatchStockService.allocate(product._id, -delta, session!, { mode: parsed.kind === 'expired_disposal' ? 'expired' : 'wastage', batchId });
        }
        const changed = await Product.updateOne({ _id: product._id, stock: { $gte: Math.max(0, -delta) } }, { $inc: { stock: delta, inventoryVersion: 1 } }, { session });
        if (!changed.matchedCount) throw new Error('Not enough stock is available for this change.');
        if (records[0]) await Inventory.updateOne({ _id: records[0]._id }, { $set: { onHand: current.stock + delta, availableStock: current.stock + delta }, $inc: { version: 1 } }, { session });
        await InventoryMovement.create([{ productId: product._id, quantity: Math.abs(delta), type: delta > 0 ? 'inbound' : 'outbound', reason: delta > 0 ? 'Purchase' : parsed.kind === 'expired_disposal' ? 'Expired' : 'Damage', remarks: parsed.notes }], { session });
      }
      await BusinessOperation.create([{ ...parsed, batchId: batchId || undefined, productId: product._id, vendorId: scope.vendor._id, workspaceId: scope.workspace.id, createdBy: req.user!.id }], { session });
    });
    res.json({ message: duplicate ? 'This record was already saved.' : 'Business record saved.' });
  } catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This request already exists. Refresh the records.' : error.message }); }
  finally { if (session) await session.endSession(); }
});

router.post('/specialist/containers', async (req: AuthRequest, res) => {
  let session: mongoose.ClientSession | undefined;
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!specialistTools(scope.workspace).containers) throw new Error('Container tracking is only enabled for water businesses.');
    const account = String(req.body.account || '').trim(), quantity = Number(req.body.quantity), kind = req.body.kind;
    const product = scope.products.find(p => String(p._id) === req.body.productId);
    if (!product || account.length < 2 || account.length > 120 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || !['container_dispatch', 'container_return'].includes(kind) || !/^[\w-]{16,80}$/.test(req.body.requestId || '') || String(req.body.notes || '').trim().length < 5 || String(req.body.notes).length > 500) throw new Error('Choose a water product, customer/account, whole container count, and movement notes.');
    const filter = { vendorId: scope.vendor._id, workspaceId: scope.workspace.id, accountKey: account.toLowerCase() };
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const previous = await BusinessOperation.findOne({ vendorId: scope.vendor._id, requestId: req.body.requestId }).session(session!);
      if (previous) { if (previous.kind !== kind || previous.quantity !== quantity || previous.reference !== account) throw new Error('This reference belongs to another container movement.'); return; }
      if (kind === 'container_dispatch') await ContainerAccount.findOneAndUpdate(filter, { $setOnInsert: { ...filter, account }, $inc: { outstanding: quantity } }, { upsert: true, session, runValidators: true });
      else {
        const changed = await ContainerAccount.updateOne({ ...filter, outstanding: { $gte: quantity } }, { $inc: { outstanding: -quantity } }, { session });
        if (!changed.modifiedCount) throw new Error('The return count exceeds this account’s outstanding containers.');
      }
      await BusinessOperation.create([{ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, productId: product._id, kind, quantity, reference: account, notes: String(req.body.notes).trim(), date: indiaDate(), requestId: req.body.requestId, createdBy: req.user!.id }], { session });
    });
    res.json({ message: 'Container movement saved. No deposit or payment was charged.' });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
  finally { if (session) await session.endSession(); }
});

router.post('/specialist/inquiries', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    const tools = specialistTools(scope.workspace), allowed = [...(tools.customOrders ? ['custom_order'] : []), ...(tools.bulkQuotes ? ['bulk_quote', 'procurement'] : []), ...(tools.bookings ? ['booking'] : [])];
    const { type } = req.body, quantity = Number(req.body.quantity), notes = String(req.body.notes || '').trim(), customerName = String(req.body.customerName || '').trim();
    if (scope.workspace.kind === 'flowers' && !req.body.requiredDate) throw new Error('Choose a required date for the garland request.');
    if (!allowed.includes(type) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || notes.length < 5 || notes.length > 2000 || customerName.length < 2 || customerName.length > 120 || (req.body.requiredDate && (!validDate(req.body.requiredDate) || req.body.requiredDate < indiaDate()))) throw new Error('Choose an enabled request type, customer/supplier name, quantity, valid required date, and requirements.');
    const inquiry = await BusinessInquiry.create({ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, type, quantity, notes, customerName, requiredDate: req.body.requiredDate, createdBy: req.user!.id });
    res.json({ message: 'Request recorded for follow-up.', inquiry });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.patch('/specialist/inquiries/:id', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    const inquiry = mongoose.isValidObjectId(req.params.id) && await BusinessInquiry.findOne({ _id: req.params.id, vendorId: scope.vendor._id, workspaceId: scope.workspace.id });
    if (!inquiry) { res.status(404).json({ message: 'Request not found in this business.' }); return; }
    if (inquiry.orderId) { res.status(409).json({ message: 'Manage this request’s fulfilment through its linked marketplace order.' }); return; }
    const status = String(req.body.status), next: Record<string, string[]> = { requested: ['quoted', 'declined'], quoted: inquiry.customerId ? ['declined'] : ['accepted', 'declined'], accepted: ['completed', 'declined'] };
    if (!next[inquiry.status]?.includes(status)) throw new Error('Choose a valid next request status. Customer requests must be accepted by the customer.');
    const response = String(req.body.response || '').trim(), quotedAmount = Number(req.body.quotedAmount);
    if (response.length < 5 || response.length > 2000 || (status === 'quoted' && (!Number.isFinite(quotedAmount) || quotedAmount < 0))) throw new Error('Add a response and a valid total quoted amount.');
    const update = { status, response, ...(status === 'quoted' ? { quotedAmount } : {}) };
    const changed = await BusinessInquiry.findOneAndUpdate({ _id: inquiry._id, status: inquiry.status }, { $set: update }, { new: true, runValidators: true });
    if (!changed) { res.status(409).json({ message: 'The request changed. Refresh first.' }); return; }
    res.json({ message: 'Request updated. Payments and order fulfilment are handled separately.', inquiry: changed });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get('/procurement/wholesale/catalog', async (req: AuthRequest, res) => {
  try { const scope = await dairyScope(req, res, false); if (!scope) return; if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining portal.'); res.json(await WholesaleProcurementService.catalog(String(scope.vendor.userId), req.query.supplierId ? String(req.query.supplierId) : undefined)); }
  catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post('/procurement/wholesale/preview', async (req: AuthRequest, res) => {
  try { const scope = await dairyScope(req, res, false); if (!scope) return; if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining portal.'); res.json(await WholesaleProcurementService.preview(scope, req.body)); }
  catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post('/procurement/wholesale/checkout', async (req: AuthRequest, res) => {
  try { const scope = await dairyScope(req, res, false); if (!scope) return; if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining portal.'); const purchase = await WholesaleProcurementService.checkout(scope, req.body); res.json({ message: 'Wholesale order placed and paid through your ApexBee wallet. Track delivery below and record goods after delivery.', purchase }); }
  catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This purchase request is already being processed. Refresh purchase orders before retrying.' : error.message }); }
});
router.post('/procurement/wholesale/:id/cancel', async (req: AuthRequest, res) => {
  try { const scope = await dairyScope(req, res, false); if (!scope) return; await WholesaleProcurementService.cancel(scope, req.params.id); res.json({ message: 'Wholesale order cancelled. Its paid amount was returned to the purchasing wallet.' }); }
  catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get('/procurement', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (scope.workspace.kind === 'food') { res.status(400).json({ message: 'Use the Food & Dining specialist portal.' }); return; }
    const filter = { vendorId: scope.vendor._id, workspaceId: scope.workspace.id };
    const [orders, receipts] = await Promise.all([PurchaseOrder.find(filter).sort({ createdAt: -1 }).limit(100).lean(), GoodsReceipt.find(filter).sort({ createdAt: -1 }).limit(200).lean()]);
    const linked = await Order.find({ _id: { $in: orders.map(order => order.marketplaceOrderId).filter(Boolean) }, customerId: scope.vendor.userId }).select('_id orderNumber orderStatus paymentStatus totalAmount timeline').lean();
    const supplies = await ProcurementSupplyStock.find({ vendorId: scope.vendor._id, workspaceId: scope.workspace.id }).sort({ name: 1 }).limit(200).lean();
    res.json({ orders: orders.map(order => ({ ...order, marketplaceOrder: linked.find(item => String(item._id) === String(order.marketplaceOrderId)) || null })), receipts, supplies, products: scope.products.map(p => ({ id: String(p._id), name: p.name, stock: p.stock })), deliveryDefaults: { fullName: scope.vendor.businessName || '', phone: scope.vendor.mobile || '', addressLine1: scope.vendor.address || '', city: scope.vendor.district || '', state: scope.vendor.state || '', pincode: scope.vendor.pincode || '' } });
  } catch { res.status(500).json({ message: 'Unable to load purchase orders and receipts.' }); }
});
router.post('/procurement/orders', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining specialist portal.');
    const { lines, expectedDate } = req.body, supplier = String(req.body.supplier || '').trim();
    if (supplier.length < 2 || supplier.length > 160 || !Array.isArray(lines) || !lines.length || lines.length > 50 || new Set(lines.map(line => line.productId)).size !== lines.length || (expectedDate && (!validDate(expectedDate) || expectedDate < indiaDate()))) throw new Error('Choose a supplier, valid delivery date and up to 50 different products.');
    const parsedLines = lines.map(line => {
      const product = scope.products.find(p => String(p._id) === line.productId), quantity = Number(line.quantity), unitCost = Number(line.unitCost);
      if (!product || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !Number.isFinite(unitCost) || unitCost < 0 || unitCost > 10000000) throw new Error('Each purchase line needs an approved product, positive quantity and non-negative unit cost.');
      return { productId: product._id, name: product.name, quantity, unitCost: Math.round(unitCost * 100) / 100, accepted: 0, rejected: 0 };
    });
    const order = await PurchaseOrder.create({ vendorId: scope.vendor._id, workspaceId: scope.workspace.id, number: `PO-${randomUUID().slice(0, 12).toUpperCase()}`, supplier, supplierReference: String(req.body.supplierReference || '').trim().slice(0, 160), orderDate: indiaDate(), expectedDate, notes: String(req.body.notes || '').trim().slice(0, 1000), lines: parsedLines, createdBy: req.user!.id });
    res.status(201).json({ message: 'Purchase order recorded. Share the document with your supplier; no payment or external message was sent.', order });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post('/procurement/receipts', async (req: AuthRequest, res) => {
  try { const scope = await dairyScope(req, res, false); if (!scope) return; if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining portal.'); const receipt = await ProcurementService.receive(scope, req.body, req.user!.id); res.json({ message: 'Goods receipt saved. Accepted units were added to stock; rejected units were excluded.', receipt }); }
  catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This receipt already exists. Refresh before trying again.' : error.message }); }
});
router.patch('/procurement/orders/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!mongoose.isValidObjectId(req.params.id)) throw new Error('Choose a valid purchase order.');
    const order = await PurchaseOrder.findOneAndUpdate({ _id: req.params.id, vendorId: scope.vendor._id, workspaceId: scope.workspace.id, marketplaceOrderId: { $exists: false }, status: { $in: ['ordered', 'partial'] } }, { $set: { status: 'cancelled' } }, { new: true });
    if (!order) { res.status(409).json({ message: 'This purchase order is closed or unavailable.' }); return; }
    res.json({ message: 'Outstanding purchase quantities cancelled. Existing goods receipts remain recorded.' });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get('/bundles', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (scope.workspace.kind === 'food') throw new Error('Use the Food & Dining portal.');
    const allowedIds = res.locals.workspaces.filter((item: any) => item.kind !== 'food').map((item: any) => item.id);
    const components = await Product.find({ sellerId: { $in: [scope.vendor._id, scope.vendor.userId] }, $or: [{ categoryId: { $in: allowedIds } }, { subCategoryId: { $in: allowedIds } }, { subcategoryId: { $in: allowedIds } }] }).select('_id name stock status isActive bundleComponents variants').lean();
    res.json({ products: scope.products.map(p => ({ id: String(p._id), name: p.name })), components: components.map(p => ({ id: String(p._id), name: p.name, stock: p.stock, status: p.status, isActive: p.isActive, bundleComponents: p.bundleComponents || [], hasVariants: (p.variants || []).length > 1 })) });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.put('/bundles/:id', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (scope.workspace.kind === 'food' || !scope.products.some(p => String(p._id) === req.params.id)) throw new Error('Choose a bundle product in this approved business.');
    const entries = req.body.components;
    if (!Array.isArray(entries) || entries.length > 20 || new Set(entries.map(item => item.productId)).size !== entries.length || entries.some(item => !mongoose.isValidObjectId(item.productId) || item.productId === req.params.id || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10000)) throw new Error('Choose up to 20 different component products with whole units per bundle.');
    if (await Product.exists({ 'bundleComponents.productId': req.params.id })) throw new Error('This product is already used inside another kit. Remove it from that kit before making it a bundle.');
    const allowedIds = res.locals.workspaces.filter((item: any) => item.kind !== 'food').map((item: any) => item.id);
    const components = await Product.find({ _id: { $in: entries.map(item => item.productId) }, sellerId: { $in: [scope.vendor._id, scope.vendor.userId] }, $or: [{ categoryId: { $in: allowedIds } }, { subCategoryId: { $in: allowedIds } }, { subcategoryId: { $in: allowedIds } }] }).select('_id sellerId name status isActive bundleComponents variants').lean();
    const parent = await Product.findById(req.params.id).select('sellerId');
    if (!parent || components.length !== entries.length || components.some(p => p.bundleComponents?.length || p.variants?.length > 1 || String(p.sellerId) !== String(parent.sellerId))) throw new Error('Components must be simple products owned by the same seller in your approved businesses.');
    await Product.updateOne({ _id: parent._id }, { $set: { bundleComponents: entries.map(entry => ({ productId: entry.productId, name: components.find(p => String(p._id) === entry.productId)!.name, quantity: Number(entry.quantity) })), status: 'Vendor Edited', isVendorEdit: true, vendorEditedAt: new Date(), adminPricingApproved: false, sellerPricingAccepted: false, isActive: false }, $unset: { approvedByAdminAt: 1, sellerAcceptedAt: 1, liveAt: 1 } });
    res.json({ message: 'Bundle composition saved for admin review. Once approved and live, checkout reserves and deducts its component stock.' });
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

router.get('/procurement/:kind/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const scope = await dairyScope(req, res, false); if (!scope) return;
    if (!mongoose.isValidObjectId(req.params.id) || !['orders', 'receipts'].includes(req.params.kind)) throw new Error('Choose a valid procurement document.');
    const filter = { _id: req.params.id, vendorId: scope.vendor._id, workspaceId: scope.workspace.id };
    const receipt = req.params.kind === 'receipts' ? await GoodsReceipt.findOne(filter) : null;
    const order = req.params.kind === 'orders' ? await PurchaseOrder.findOne(filter) : receipt && await PurchaseOrder.findOne({ _id: receipt.purchaseOrderId, vendorId: scope.vendor._id, workspaceId: scope.workspace.id });
    if (!order || (req.params.kind === 'receipts' && !receipt)) { res.status(404).json({ message: 'Document not found in this business.' }); return; }
    const pdf = await renderBusinessPdf({
      title: receipt ? 'Goods Received Note' : 'Purchase Order', number: receipt?.number || order.number, status: order.status, supplier: scope.vendor.businessName || 'Vendor', address: scope.vendor.address, recipient: order.supplier, period: receipt ? order.number : `Expected delivery: ${order.expectedDate || 'Not specified'}`, date: receipt?.date || order.orderDate,
      columns: receipt ? ['Product / batch', 'Accepted', 'Rejected'] : ['Product', 'Ordered', 'Unit cost', 'Amount'],
      rows: receipt ? receipt.lines.map(line => [`${order.lines.find(item => String(item._id) === String(line.lineId))?.name || 'Product'}\n${line.batch || ''}${line.expiry ? ` - Expiry ${line.expiry}` : ''}`, String(line.accepted), String(line.rejected)]) : order.lines.map(line => [line.name || 'Product', String(line.quantity), invoiceMoney(line.unitCost), invoiceMoney(line.quantity * line.unitCost)]),
      totals: receipt ? [] : [['Order estimate', invoiceMoney(order.lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0))]], notes: [receipt?.notes || order.notes || '', receipt ? 'Only accepted quantities entered available stock. Rejected quantities were recorded separately.' : 'This purchase order is a procurement record. Supplier payment is recorded separately.']
    });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${receipt ? 'receipt' : 'purchase-order'}-${req.params.id}.pdf"`); res.send(pdf);
  } catch (error: any) { res.status(400).json({ message: error.message }); }
});

export default router;
