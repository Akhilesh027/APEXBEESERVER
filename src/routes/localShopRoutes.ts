import { Router, Request, Response } from 'express';
import { protect, restrictTo } from '../middleware/auth';
import LocalShopSubscription from '../models/LocalShopSubscription';
import { Vendor } from '../models/Vendor';
import { User } from '../models/User';
import { Address } from '../models/Address';
import mongoose from 'mongoose';
import { SubscriptionBillingService } from '../services/SubscriptionBillingService';
import { SubscriptionSettlementService } from '../services/SubscriptionSettlementService';
import { SubscriptionStatement } from '../models/SubscriptionStatement';
import { WalletEngine } from '../services/WalletEngine';
import { currentSubscriptionCycleEnd, parseSubscriptionPlan } from '../services/subscriptionPlan';
import Product from '../models/Product';
import { enforceDairyOrderMode, getDairySettings, isDairyCatalogProduct } from '../services/dairyOrderRules';
import { deliveryPeriod } from '../services/dairyDeliveryService';
import { updateCustomerSchedule, updateDairyAutoRenew } from '../services/subscriptionScheduleService';
import { mapPoint } from '../services/routePlanningService';
import { renderBusinessPdf, statementPdfData } from '../services/businessPdfService';
import { ownedDairyReview, submitDairyReview } from '../services/dairyReviews';
import Notification from '../models/Notification';

const router = Router();

router.get('/subscriptions/:subId/review', protect, async (req: Request, res: Response) => {
  try { const { review, eligible } = await ownedDairyReview(req.params.subId, (req as any).user.id); res.json({ review, eligible }); }
  catch (error: any) { res.status(400).json({ message: error.message }); }
});
router.post('/subscriptions/:subId/review', protect, async (req: Request, res: Response) => {
  try { const review = await submitDairyReview(req.params.subId, (req as any).user.id, req.body); res.status(201).json({ message: 'Dairy review submitted.', review }); }
  catch (error: any) { res.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'This subscription already has a review.' : error.message }); }
});

// 0. GET /subscriptions/admin/all - Admin subscription master registry
router.get('/subscriptions/admin/all', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    const isAdmin = authUser?.roles?.includes('admin');
    if (!isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied: Admin role required' });
      return;
    }

    const subscriptions = await LocalShopSubscription.find({})
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      subscriptions
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1. GET /subscriptions/:userId
router.get('/subscriptions/:userId', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const authUser = (req as any).user;
    const isAdmin = authUser?.roles?.includes('admin');
    const authUserIdStr = String(authUser?.id || authUser?._id || '');

    if (!isAdmin && String(userId) !== authUserIdStr) {
      res.status(403).json({ success: false, message: 'Not authorized to view these subscriptions' });
      return;
    }

    const subscriptions = await LocalShopSubscription.find({
      $or: [
        { userId: userId },
        ...(mongoose.Types.ObjectId.isValid(userId) ? [{ userId: new mongoose.Types.ObjectId(userId) }] : [])
      ]
    }).sort({ createdAt: -1 });

    const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
    const { indiaDate, isDeliveryDue } = require('../services/vendorWorkspaceService');
    const todayStr = indiaDate();

    const enrichedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
      const subObj = sub.toObject() as any;
      let task = await SubscriptionDeliveryTask.findOne({ subscriptionId: sub._id, date: todayStr });
      const isDue = isDeliveryDue(sub, todayStr);
      const isSkipped = sub.skippedDates?.includes(todayStr);

      const { auditSubscriptionTask, parseSlotEndTime } = require('../services/deliverySlotService');
      if (task) {
        task = await auditSubscriptionTask(sub, task, todayStr);
      } else if (isDue && !isSkipped) {
        const deadline = parseSlotEndTime(sub.deliverySlot || '07:00 AM - 08:00 AM', todayStr);
        if (deadline && Date.now() > deadline.getTime()) {
          task = new SubscriptionDeliveryTask({
            subscriptionId: sub._id,
            date: todayStr,
            status: 'failed',
            failedReason: `Delivery slot (${sub.deliverySlot || 'Scheduled window'}) expired without delivery.`,
            notes: `Delivery slot expired without delivery.`
          });
          await task.save();
        }
      }

      const isDelivered = sub.completedDates?.includes(todayStr) || task?.status === 'delivered';
      const isFailed = sub.failedDates?.includes(todayStr) || task?.status === 'failed';

      let todayStatus = 'not_scheduled';
      let todayStatusLabel = 'No delivery scheduled today';

      if (isDelivered) {
        todayStatus = 'delivered';
        todayStatusLabel = 'Delivered Today';
      } else if (isFailed) {
        todayStatus = 'failed';
        todayStatusLabel = 'Failed to Deliver (Slot Expired)';
      } else if (isSkipped) {
        todayStatus = 'skipped';
        todayStatusLabel = 'Skipped for Today';
      } else if (task?.slotExtended) {
        todayStatus = task?.status === 'started' ? 'out_for_delivery' : 'extended';
        const extTimeStr = task.slotExtendedUntil
          ? new Date(task.slotExtendedUntil).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
          : '';
        todayStatusLabel = extTimeStr ? `Delivery Extended to ${extTimeStr}` : 'Delivery Time Extended';
      } else if (task?.status === 'started') {
        todayStatus = 'out_for_delivery';
        todayStatusLabel = 'Out for Delivery';
      } else if (task?.status === 'assigned') {
        todayStatus = 'assigned';
        todayStatusLabel = 'Rider Assigned';
      } else if (isDue) {
        todayStatus = 'scheduled';
        todayStatusLabel = 'Scheduled for Today';
      }

      subObj.todayDelivery = {
        date: todayStr,
        status: todayStatus,
        statusLabel: todayStatusLabel,
        deliverySlot: task?.deliverySlot || sub.deliverySlot || '07:00 AM - 08:00 AM',
        isDelivered: Boolean(isDelivered),
        isFailed: Boolean(isFailed),
        isExtended: Boolean(task?.slotExtended),
        extendedUntil: task?.slotExtendedUntil || null,
        extensionReason: task?.slotExtensionReason || '',
        failedReason: task?.failedReason || (isFailed ? 'Delivery slot expired without fulfillment' : ''),
        confirmedAt: task?.confirmedAt || null,
        otp: task?.otp || '',
        otpVerified: Boolean(task?.otpVerified),
        riderName: task?.riderId ? 'Assigned Rider' : null
      };

      return subObj;
    }));

    res.status(200).json({
      success: true,
      subscriptions: enrichedSubscriptions
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.1 GET /subscriptions/vendor/:vendorId
router.get('/subscriptions/vendor/:vendorId', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId } = req.params;
    const authUser = (req as any).user;
    const isAdmin = authUser?.roles?.includes('admin');
    const authUserIdStr = String(authUser?.id || authUser?._id || '');

    let targetUserId = vendorId;
    const vendorDoc = await Vendor.findOne({ $or: [{ userId: vendorId }, { _id: mongoose.Types.ObjectId.isValid(vendorId) ? new mongoose.Types.ObjectId(vendorId) : vendorId }] })
      || await Vendor.findOne({ userId: authUserIdStr });

    if (vendorDoc) {
      targetUserId = vendorDoc.userId.toString();
    }

    if (!isAdmin && String(targetUserId) !== authUserIdStr && String(vendorId) !== authUserIdStr) {
      res.status(403).json({ success: false, message: 'Not authorized to view vendor subscriptions' });
      return;
    }

    let queryVendorId = vendorId;
    if (vendorDoc) {
      queryVendorId = vendorDoc._id.toString();
    }

    const subscriptions = await LocalShopSubscription.find({
      $or: [
        { vendorId: queryVendorId },
        { vendorId: vendorId },
        { vendorId: authUserIdStr },
        ...(vendorDoc ? [{ vendorId: vendorDoc.userId.toString() }] : [])
      ]
    }).sort({ createdAt: -1 });

    const enrichedSubscriptions = await Promise.all(subscriptions.map(async (sub) => {
      const subObj = sub.toObject() as any;
      try {
        const customerUser = await User.findById(sub.userId);
        if (customerUser) {
          subObj.customerName = customerUser.name;
          subObj.customerPhone = customerUser.phone || customerUser.mobile;
          subObj.customerEmail = customerUser.email;
        }

        const address = await Address.findOne({ userId: sub.userId, isDefault: true }) || await Address.findOne({ userId: sub.userId });
        if (address) {
          subObj.customerAddress = `${address.address}, ${address.city}, ${address.state} - ${address.pincode}`;
          if (!subObj.customerPhone) {
            subObj.customerPhone = address.phone;
          }
          if (!subObj.customerName) {
            subObj.customerName = address.name;
          }
        } else {
          subObj.customerAddress = "Local Store Pickup / No address on file";
        }
      } catch (err) {
        subObj.customerName = sub.userId === 'mock-user-123' ? 'Ananya Sharma' : 'Local Customer';
        subObj.customerPhone = '+91 98765 43210';
        subObj.customerAddress = 'Fl-102, Marvel Heights, Kalyani Nagar, Pune, Maharashtra - 411006';
      }

      // Vendor detail enrichment
      try {
        const { Vendor } = require('../models/Vendor');
        const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
        if (vendor) {
          subObj.vendorName = vendor.businessName || vendor.ownerName;
          subObj.vendorPhone = vendor.mobile;
          subObj.vendorAddress = vendor.address || 'Store Pickup Location';
          subObj.vendorName = 'GNS Stores';
          subObj.vendorPhone = '9177176969';
          subObj.vendorAddress = 'NH67, బుచ్చిరెడ్డిపాలెం, Sri Potti Sriramulu Nellore, Andhra Pradesh, 524305, India';
        }
      } catch (err) {
        subObj.vendorName = 'GNS Stores';
        subObj.vendorPhone = '9177176969';
        subObj.vendorAddress = 'NH67, బుచ్చిరెడ్డిపాలెం, Sri Potti Sriramulu Nellore, Andhra Pradesh, 524305, India';
      }

      return subObj;
    }));

    const filteredSubscriptions = enrichedSubscriptions.filter((s: any) => {
      const pName = (s.productName || s.itemName || s.title || '').toLowerCase();
      const pCat = (s.category || s.subCategory || '').toLowerCase();
      return !pName.includes('academy') && !pCat.includes('academy');
    });

    res.status(200).json({
      success: true,
      subscriptions: filteredSubscriptions
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.2 GET /subscriptions/admin/all
router.get('/subscriptions/admin/all', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const subscriptions = await LocalShopSubscription.find()
      .populate({
        path: 'productId',
        select: 'name brand'
      })
      .populate({
        path: 'userId',
        model: 'User',
        select: 'name phone'
      });

    const enriched = await Promise.all(subscriptions.map(async (sub: any) => {
      const subObj = sub.toObject() as any;
      try {
        const { Vendor } = require('../models/Vendor');
        const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
        if (vendor) {
          subObj.vendorId = {
            _id: vendor._id,
            businessName: vendor.businessName,
            ownerName: vendor.ownerName,
            mobile: vendor.mobile
          };
        }
      } catch (err) {
        console.error('Error populating vendor in admin all:', err);
      }
      return subObj;
    }));

    res.status(200).json({
      success: true,
      subscriptions: enriched
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. POST /subscriptions
router.post('/subscriptions', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    if (String((req as any).user?.id) !== String(req.body.userId)) {
      res.status(403).json({ success: false, message: 'You can only create your own subscription.' }); return;
    }
    let {
      userId,
      productId,
      vendorId,
      productName,
      productImage,
      quantity,
      unitPrice,
      frequency,
      customDays,
      deliverySlot,
      autoRenew,
      customerName,
      customerPhone,
      address,
      deliveryAddress,
      userLocation
    } = req.body;

    let plan;
    try { plan = parseSubscriptionPlan(req.body); }
    catch (error) { res.status(400).json({ success: false, message: (error as Error).message }); return; }
    const startDate = plan.startDate;

    // Store all new subscriptions against the vendor record, even when a
    // storefront sends its older userId identifier.
    if (!mongoose.isValidObjectId(productId) || !mongoose.isValidObjectId(vendorId)) {
      res.status(400).json({ success: false, message: 'Choose a valid product and store.' }); return;
    }
    const subscriptionProduct = await Product.findById(productId).select('sellerId name thumbnail images baseSellingPrice adminPricing isSubscriptionAvailable status isActive waterDetails dairyDetails categoryId subCategoryId subcategoryId');
    const subscriptionVendor = subscriptionProduct && await Vendor.findOne({ $or: [{ _id: subscriptionProduct.sellerId }, { userId: subscriptionProduct.sellerId }] });
    if (!subscriptionVendor || ![subscriptionVendor._id, subscriptionVendor.userId].some(id => String(id) === String(vendorId))) {
      res.status(400).json({ success: false, message: 'This subscription product does not belong to the selected store.' }); return;
    }
    const recurringQuantity = Number(quantity);
    const recurringUnitPrice = Number(subscriptionProduct!.adminPricing?.customerSellingAmount ?? subscriptionProduct!.adminPricing?.sellingPrice ?? subscriptionProduct!.baseSellingPrice);
    if (subscriptionVendor.status !== 'active' || subscriptionVendor.marketplaceStatus !== 'Approved' || subscriptionProduct!.status !== 'Live' || !subscriptionProduct!.isActive || !subscriptionProduct!.isSubscriptionAvailable || !Number.isSafeInteger(recurringQuantity) || recurringQuantity < 1 || recurringQuantity > 1000 || !Number.isFinite(recurringUnitPrice) || recurringUnitPrice <= 0) {
      res.status(400).json({ success: false, message: 'Choose an available subscription product and a whole quantity between 1 and 1,000.' }); return;
    }

    const isSlotOffered = (val: any): boolean => {
      if (!val) return false;
      const s = String(val).trim().toLowerCase();
      return s !== '' && s !== 'none' && s !== 'no' && s !== 'false' && s !== 'n/a' && s !== '0';
    };

    const dairy = !subscriptionProduct!.waterDetails && await isDairyCatalogProduct(subscriptionProduct!);
    if (dairy) {
      try {
        const settings = await getDairySettings(subscriptionVendor.userId);
        enforceDairyOrderMode(settings, 'subscription');
        const hasMorning = isSlotOffered(settings?.morningDelivery);
        const hasEvening = isSlotOffered(settings?.eveningDelivery);

        if (hasMorning || hasEvening) {
          const period = deliveryPeriod(typeof deliverySlot === 'string' ? deliverySlot : '');

          if (hasMorning && !hasEvening) {
            // Vendor only offers morning delivery
            if (period === 'evening') {
              throw new Error('This dairy store only offers Morning delivery (06:00 AM - 08:00 AM). Please select a morning delivery slot.');
            }
            if (period !== 'morning' || !deliverySlot) {
              deliverySlot = typeof settings?.morningDelivery === 'string' && settings.morningDelivery.length > 3
                ? settings.morningDelivery
                : 'Morning (06:00 AM - 08:00 AM)';
            }
          } else if (hasEvening && !hasMorning) {
            // Vendor only offers evening delivery
            if (period === 'morning') {
              throw new Error('This dairy store only offers Evening delivery (05:00 PM - 07:00 PM). Please select an evening delivery slot.');
            }
            if (period !== 'evening' || !deliverySlot) {
              deliverySlot = typeof settings?.eveningDelivery === 'string' && settings.eveningDelivery.length > 3
                ? settings.eveningDelivery
                : 'Evening (05:00 PM - 07:00 PM)';
            }
          } else if (hasMorning && hasEvening) {
            // Vendor offers both morning and evening
            if (period !== 'morning' && period !== 'evening') {
              deliverySlot = 'Morning (06:00 AM - 08:00 AM)';
            }
          }
        } else {
          // If vendor settings do not restrict slots, ensure a clean default
          if (!deliverySlot) {
            deliverySlot = 'Morning (06:00 AM - 08:00 AM)';
          }
        }
      }
      catch (error) { res.status(409).json({ success: false, message: (error as Error).message }); return; }
    }
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') {
      res.status(400).json({ success: false, message: 'Auto-renew must be on or off.' }); return;
    }

    let finalCustomerName = customerName || '';
    let finalCustomerPhone = customerPhone || '';
    let finalAddress = address || deliveryAddress || (userLocation && userLocation.address) || '';

    if (userId && (!finalAddress || !finalCustomerName || !finalCustomerPhone)) {
      try {
        const u = await User.findById(userId);
        if (u) {
          if (!finalCustomerName) finalCustomerName = u.name || '';
          if (!finalCustomerPhone) finalCustomerPhone = u.phone || u.mobile || '';
          if (!finalAddress) finalAddress = (u as any).address || (userLocation && userLocation.address) || '';
        }
      } catch (e) { }
    }

    // Auto-create or update Address using GPS coordinates / userLocation
    if (userLocation && userLocation.address) {
      try {
        const userDoc = await User.findById(userId);
        let existingAddress = await Address.findOne({ userId, isDefault: true }) || await Address.findOne({ userId });
        if (existingAddress) {
          existingAddress.address = userLocation.address;
          existingAddress.city = userLocation.city || existingAddress.city || 'Adilabad';
          existingAddress.state = userLocation.state || existingAddress.state || 'Telangana';
          existingAddress.pincode = userLocation.pincode || existingAddress.pincode || '504001';
          existingAddress.isDefault = true;
          await existingAddress.save();
          console.log(`Updated existing address for user ${userId} with userLocation.`);
        } else {
          const newAddr = new Address({
            userId,
            name: userDoc?.name || 'Customer Address',
            phone: userDoc?.phone || '0000000000',
            address: userLocation.address,
            city: userLocation.city || 'Adilabad',
            state: userLocation.state || 'Telangana',
            pincode: userLocation.pincode || '504001',
            type: 'home',
            isDefault: true
          });
          await newAddr.save();
          console.log(`Auto-created default address for user ${userId} using userLocation.`);
        }
      } catch (addrErr) {
        console.error('Error updating/creating address from userLocation:', addrErr);
      }
    }

    // Wallet balance validation check (Option B: check if wallet has at least first delivery cost)
    const minRequiredBalance = recurringUnitPrice * recurringQuantity;
    try {
      const wallet = await WalletEngine.getOrCreateWallet(userId);
      if (wallet.availableBalance < minRequiredBalance) {
        res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. You need at least ₹${minRequiredBalance.toFixed(2)} to subscribe.`
        });
        return;
      }
    } catch (walletErr: any) {
      console.error('Wallet validation failed during subscription creation:', walletErr);
      res.status(503).json({ success: false, message: 'The wallet could not be checked. Please try again.' }); return;
    }

    const subscription = new LocalShopSubscription({
      userId,
      productId,
      vendorId: subscriptionVendor._id,
      ...(subscriptionProduct!.waterDetails ? { portalType: 'water' } : dairy ? { portalType: 'dairy', currentPeriodEnd: currentSubscriptionCycleEnd(plan, startDate) } : {}),
      productName: subscriptionProduct!.name,
      productImage: subscriptionProduct!.thumbnail || subscriptionProduct!.images?.[0] || '',
      quantity: recurringQuantity,
      unitPrice: recurringUnitPrice,
      ...plan,
      deliverySlot,
      status: 'active',
      autoRenew: autoRenew !== false,
      skippedDates: [],
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      address: finalAddress,
      deliveryAddress: finalAddress,
      ...(String(userLocation?.address || '').trim().toLowerCase() === finalAddress.trim().toLowerCase() && mapPoint(userLocation) ? { deliveryLocation: mapPoint(userLocation) } : {}),
      startDate
    });

    await subscription.save();

    try { await Notification.create({ recipientId: subscriptionVendor.userId, recipientType: 'User', eventCode: 'dairy.new_subscription', title: 'New customer subscription', message: `${subscription.productName}: ${subscription.quantity} packs per scheduled delivery, starting ${subscription.startDate}.`, entityType: 'subscription', entityId: subscription._id, status: 'unread', deepLink: '/#dairy-subscriptions' }); }
    catch { console.error('Subscription created; vendor notification could not be saved.'); }

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      subscription
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. PATCH /subscriptions/:subId
router.patch(['/subscriptions/:subId', '/subscriptions/:subId/status'], protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { subId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subId)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }
    const subscription = await LocalShopSubscription.findById(subId);
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const authUser = (req as any).user;
    const isAdmin = authUser?.roles.includes('admin');
    const isCustomer = authUser && String(subscription.userId) === String(authUser.id);

    let isVendor = false;
    if (authUser) {
      const vendor = await Vendor.findOne({ userId: authUser.id });
      if (vendor && String(subscription.vendorId) === String(vendor._id)) {
        isVendor = true;
      }
    }

    if (!isAdmin && !isCustomer && !isVendor) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const { status, autoRenew } = req.body;
    const deliveryAgentId = req.body.deliveryAgentId !== undefined ? req.body.deliveryAgentId : req.body.assignedAgentId ?? req.body.agentId;
    const deliveryAgentType = req.body.deliveryAgentType ?? req.body.assignedAgentType ?? req.body.agentType;
    const deliveryAgentName = req.body.deliveryAgentName ?? req.body.agentName;
    if (status !== undefined && !['active', 'paused', 'cancelled'].includes(status)) { res.status(400).json({ message: 'Choose active, paused or cancelled.' }); return; }
    if (autoRenew !== undefined && typeof autoRenew !== 'boolean') { res.status(400).json({ message: 'Auto-renew must be on or off.' }); return; }
    if (!isAdmin && !isVendor && [deliveryAgentId, deliveryAgentType, deliveryAgentName].some(value => value !== undefined)) { res.status(403).json({ message: 'Only the store can assign delivery partners.' }); return; }
    if (autoRenew !== undefined && !isCustomer && !isAdmin) { res.status(403).json({ message: 'Only the customer can change auto-renewal.' }); return; }
    if (autoRenew !== undefined && (status !== undefined || [deliveryAgentId, deliveryAgentType, deliveryAgentName].some(value => value !== undefined))) {
      res.status(400).json({ message: 'Save the renewal setting separately from other subscription changes.' }); return;
    }
    if (autoRenew !== undefined && (subscription.status === 'expired' || subscription.status === 'cancelled' || status === 'cancelled')) {
      res.status(409).json({ message: 'Create a new subscription to restart this plan.' }); return;
    }
    if (status !== undefined) {
      try { await updateCustomerSchedule(subId, status); } catch (error: any) { res.status(409).json({ message: error.message }); return; }
    }

    const updates: any = {};
    if (autoRenew !== undefined) {
      const product = subscription.portalType ? null : await Product.findById(subscription.productId).select('sellerId categoryId subCategoryId subcategoryId dairyDetails');
      if (subscription.portalType === 'dairy' || (product && await isDairyCatalogProduct(product))) {
        try { await updateDairyAutoRenew(subId, autoRenew); }
        catch (error) { res.status(409).json({ message: (error as Error).message }); return; }
      } else {
        updates.autoRenew = autoRenew;
      }
    }
    if (deliveryAgentId !== undefined) updates.deliveryAgentId = deliveryAgentId;
    if (deliveryAgentType !== undefined) updates.deliveryAgentType = deliveryAgentType;
    if (deliveryAgentName !== undefined) updates.deliveryAgentName = deliveryAgentName;

    const updatedSubscription = Object.keys(updates).length
      ? await LocalShopSubscription.findByIdAndUpdate(subId, { $set: updates }, { new: true })
      : await LocalShopSubscription.findById(subId);

    if (!updatedSubscription) {
      res.status(404).json({ success: false, message: 'Subscription not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: updatedSubscription
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. POST /subscriptions/:subId/skip
router.post('/subscriptions/:subId/skip', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { subId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subId)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }
    const { date } = req.body;
    const from = req.body.fromDate ?? date;
    const through = req.body.toDate ?? date;
    if (!from || !through) {
      res.status(400).json({ success: false, message: 'Choose a start and end date to skip.' });
      return;
    }

    const subscription = await LocalShopSubscription.findById(subId);
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const authUser = (req as any).user;
    const isAdmin = authUser?.roles.includes('admin');
    const isCustomer = authUser && String(subscription.userId) === String(authUser.id);

    let isVendor = false;
    if (authUser) {
      const vendor = await Vendor.findOne({ userId: authUser.id });
      if (vendor && String(subscription.vendorId) === String(vendor._id)) {
        isVendor = true;
      }
    }

    if (!isAdmin && !isCustomer && !isVendor) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    let updated;
    try { updated = await updateCustomerSchedule(subId, 'skip', from, through); } catch (error: any) { res.status(409).json({ message: error.message }); return; }

    res.status(200).json({
      success: true,
      message: from === through ? `Delivery skipped for ${from}.` : `Deliveries skipped from ${from} to ${through}.`,
      subscription: updated
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4.1 POST /subscriptions/:subId/extend-slot
router.post('/subscriptions/:subId/extend-slot', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { subId } = req.params;
    const { additionalMinutes, newSlot, reason, date } = req.body;
    const authUser = (req as any).user;
    const { extendSubscriptionDeliverySlot } = require('../services/deliverySlotService');

    const result = await extendSubscriptionDeliverySlot(subId, authUser?.id || authUser?._id, {
      date,
      additionalMinutes: Number(additionalMinutes) || 60,
      newSlot: newSlot ? String(newSlot).trim() : undefined,
      reason: String(reason || 'Store operations delayed, reaching as soon as possible').trim()
    });

    res.status(200).json(result);
  } catch (err: any) {
    console.error('[extendSubscriptionSlot] Error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});



// 6. GET /loyalty/:userId
router.get('/loyalty/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Renders loyalty progress card details
    res.status(200).json({
      success: true,
      loyalty: {
        currentStreak: 5,
        longestStreak: 12,
        targetStreak: 15,
        cashbackEarned: 120.50,
        cashbackPending: 15.00,
        freeDeliveriesEarned: 2,
        totalDeliveries: 42,
        rewardPoints: 340
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. GET /notifications/:userId
router.get('/notifications/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    res.status(200).json({
      success: true,
      notifications: [
        {
          _id: 'notif-1',
          type: 'delivery',
          message: 'Your morning dairy subscription was delivered successfully.',
          icon: 'truck',
          read: false,
          createdAt: new Date().toISOString()
        },
        {
          _id: 'notif-2',
          type: 'system',
          message: 'Skip request for tomorrow has been applied successfully.',
          icon: 'calendar',
          read: true,
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. POST /billing/generate
router.post('/billing/generate', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { subscriptionId, billingPeriod } = req.body;
    if (!subscriptionId || !billingPeriod) {
      res.status(400).json({ success: false, message: 'subscriptionId and billingPeriod are required' });
      return;
    }
    const statement = await SubscriptionBillingService.generateStatement(subscriptionId, billingPeriod);
    res.status(201).json({ success: true, statement });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9. GET /billing/statements
router.get('/billing/statements', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const statements = await SubscriptionStatement.find()
      .populate('subscriptionId')
      .populate('vendorId')
      .populate('customerId');
    res.status(200).json({ success: true, statements });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. GET /billing/statements/:id
router.get('/subscriptions/:subId/statements', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    if (!mongoose.isValidObjectId(req.params.subId)) { res.status(400).json({ message: 'Invalid subscription.' }); return; }
    const subscription = await LocalShopSubscription.findOne({ _id: req.params.subId, userId });
    if (!subscription) { res.status(404).json({ message: 'Subscription not found.' }); return; }
    const statements = await SubscriptionStatement.find({ subscriptionId: subscription._id, customerId: userId }).select('statementNumber billingPeriod periodStart periodEnd grossAmount settlementStatus').sort({ generatedDate: -1 }).lean();
    res.json({ statements });
  } catch { res.status(500).json({ message: 'Unable to load subscription statements.' }); }
});
router.get('/billing/statements/:id/pdf', protect, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid statement.' }); return; }
    const statement = await SubscriptionStatement.findOne({ _id: req.params.id, customerId: userId });
    if (!statement) { res.status(404).json({ message: 'Statement not found.' }); return; }
    const [subscription, vendor, customer] = await Promise.all([LocalShopSubscription.findById(statement.subscriptionId), Vendor.findById(statement.vendorId), User.findById(userId).select('name')]);
    if (!subscription || !vendor) { res.status(404).json({ message: 'Statement information is unavailable.' }); return; }
    const pdf = await renderBusinessPdf(statementPdfData(statement, vendor, subscription, subscription.customerName || customer?.name || 'Customer'));
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="statement-${statement._id}.pdf"`); res.send(pdf);
  } catch { res.status(500).json({ message: 'Unable to create the billing document.' }); }
});
router.get('/billing/statements/:id', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const statement = await SubscriptionStatement.findById(req.params.id)
      .populate('subscriptionId')
      .populate('vendorId')
      .populate('customerId');
    if (!statement) {
      res.status(404).json({ success: false, message: 'Statement not found' });
      return;
    }
    res.status(200).json({ success: true, statement });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. PATCH /billing/statements/:id/approve
router.patch('/billing/statements/:id/approve', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const statement = await SubscriptionSettlementService.settleStatement(req.params.id);
    res.status(200).json({ success: true, statement });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 12. GET /subscriptions/:subId/tasks
router.get('/subscriptions/:subId/tasks', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { subId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subId)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }
    const subscription = await LocalShopSubscription.findById(subId);
    if (!subscription) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const authUser = (req as any).user;
    const isAdmin = authUser?.roles.includes('admin');
    const isCustomer = authUser && String(subscription.userId) === String(authUser.id);

    let isVendor = false;
    if (authUser) {
      const vendor = await Vendor.findOne({ userId: authUser.id });
      if (vendor && String(subscription.vendorId) === String(vendor._id)) {
        isVendor = true;
      }
    }

    if (!isAdmin && !isCustomer && !isVendor) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
    const tasks = await SubscriptionDeliveryTask.find({ subscriptionId: subId }).sort({ date: -1 });
    res.status(200).json({
      success: true, tasks: tasks.map((task: any) => {
        const value = task.toObject();
        if (!isCustomer && !isAdmin) delete value.otp;
        return value;
      })
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 13. GET /billing/pending-tasks
router.get('/billing/pending-tasks', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
    const tasks = await SubscriptionDeliveryTask.find({
      status: 'delivered',
      isPaidToVendor: false
    })
      .populate({
        path: 'subscriptionId',
        populate: [
          { path: 'userId', model: 'User', select: 'name phone email' }
        ]
      })
      .sort({ date: -1 });

    const enriched = await Promise.all(tasks.map(async (task: any) => {
      const taskObj = task.toObject() as any;
      if (taskObj.subscriptionId) {
        const sub = taskObj.subscriptionId;
        try {
          const { Vendor } = require('../models/Vendor');
          const vendor = await Vendor.findOne({ userId: sub.vendorId }) || await Vendor.findById(sub.vendorId);
          if (vendor) {
            sub.vendorId = {
              _id: vendor._id,
              businessName: vendor.businessName,
              ownerName: vendor.ownerName,
              mobile: vendor.mobile
            };
          }
        } catch (err) {
          console.error('Error populating vendor in pending tasks:', err);
        }
      }
      return taskObj;
    }));

    res.status(200).json({ success: true, tasks: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. PATCH /billing/tasks/:taskId/approve
router.patch('/billing/tasks/:taskId/approve', protect, restrictTo('admin'), async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({ success: false, message: 'Individual task payouts have been replaced by billing statement settlement. Generate or select the closed-cycle statement and approve it from Subscription Billing.' });
});

// 5. GET /billing/:userId
router.get('/billing/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const subscriptions = await LocalShopSubscription.find({ userId });

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonth = monthNames[new Date().getMonth()] + ' ' + new Date().getFullYear();

    let totalDeliveries = 0;
    let totalAmount = 0;
    const breakdown = [];

    for (const sub of subscriptions) {
      if (sub.status === 'active') {
        const skippedCount = sub.skippedDates.length;
        // Let's assume 30 days in month, daily = 30, weekly = 4, custom = 12, alternate = 15, monthly = 1
        let deliveries = 30;
        if (sub.frequency === 'weekly') deliveries = 4;
        else if (sub.frequency === 'alternate') deliveries = 15;
        else if (sub.frequency === 'custom') deliveries = 12;
        else if (sub.frequency === 'monthly') deliveries = 1;

        const netDeliveries = Math.max(0, deliveries - skippedCount);
        const amount = netDeliveries * sub.unitPrice * sub.quantity;

        totalDeliveries += netDeliveries;
        totalAmount += amount;

        breakdown.push({
          productName: sub.productName,
          frequency: sub.frequency,
          deliveries: netDeliveries,
          skipped: skippedCount,
          amount
        });
      }
    }

    const deliveryFee = totalDeliveries > 0 ? 20 : 0;
    const grandTotal = totalAmount + deliveryFee;

    res.status(200).json({
      success: true,
      billing: {
        month: currentMonth,
        totalDeliveries,
        totalAmount,
        deliveryFee,
        grandTotal,
        autoRenewalActive: subscriptions.some(s => s.autoRenew),
        breakdown
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 15. POST /scheduler/run
router.post('/scheduler/run', protect, restrictTo('admin'), async (req: Request, res: Response) => {
  try {
    const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
    const result = await SubscriptionSchedulerService.runDailyScheduler();
    res.json({ success: true, message: 'Daily scheduler ran successfully', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 16. POST /scheduler/holds
router.post('/scheduler/holds', protect, restrictTo('admin'), async (req: Request, res: Response) => {
  try {
    const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
    const result = await SubscriptionSchedulerService.processWalletHoldsForTomorrow();
    res.json({ success: true, message: 'Tomorrow wallet holds processed successfully', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
