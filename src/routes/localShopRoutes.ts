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

const router = Router();

// 1. GET /subscriptions/:userId
router.get('/subscriptions/:userId', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const authUser = (req as any).user;
    const isAdmin = authUser?.roles.includes('admin');
    if (!isAdmin && String(userId) !== String(authUser?.id)) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }
    const subscriptions = await LocalShopSubscription.find({ userId });
    res.status(200).json({
      success: true,
      subscriptions
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
    const isAdmin = authUser?.roles.includes('admin');

    let targetUserId = vendorId;
    const vendorDoc = await Vendor.findOne({ userId: vendorId }) || await Vendor.findById(vendorId);
    if (vendorDoc) {
      targetUserId = vendorDoc.userId.toString();
    }

    if (!isAdmin && String(targetUserId) !== String(authUser?.id)) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    let queryVendorId = vendorId;
    if (vendorDoc) {
      queryVendorId = vendorDoc._id.toString();
    }

    const subscriptions = await LocalShopSubscription.find({
      $or: [
        { vendorId: queryVendorId },
        { vendorId: vendorId }
      ]
    });

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
        } else {
          subObj.vendorName = 'Local Merchant Store';
          subObj.vendorPhone = '+91 99999 88888';
          subObj.vendorAddress = 'Amanora Mall, Hadapsar, Pune, Maharashtra - 411028';
        }
      } catch (err) {
        subObj.vendorName = 'Local Merchant Store';
        subObj.vendorPhone = '+91 99999 88888';
        subObj.vendorAddress = 'Amanora Mall, Hadapsar, Pune, Maharashtra - 411028';
      }

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

// 1.2 GET /subscriptions/admin/all
router.get('/subscriptions/admin/all', protect, restrictTo('admin'), async (req: Request, res: Response): Promise<void> => {
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
router.post('/subscriptions', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
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
      userLocation
    } = req.body;

    const startDate = new Date().toISOString().split('T')[0];

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
    const minRequiredBalance = Number(unitPrice || 0) * Number(quantity || 1);
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
    }

    const subscription = new LocalShopSubscription({
      userId,
      productId,
      vendorId,
      productName,
      productImage,
      quantity: Number(quantity || 1),
      unitPrice: Number(unitPrice || 0),
      frequency,
      customDays: customDays || [],
      deliverySlot,
      status: 'active',
      autoRenew: autoRenew !== false,
      skippedDates: [],
      startDate
    });

    await subscription.save();

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
router.patch('/subscriptions/:subId', protect, async (req: Request, res: Response): Promise<void> => {
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

    const { status, autoRenew, deliveryAgentId, deliveryAgentType, deliveryAgentName } = req.body;

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (autoRenew !== undefined) updates.autoRenew = autoRenew;
    if (deliveryAgentId !== undefined) updates.deliveryAgentId = deliveryAgentId;
    if (deliveryAgentType !== undefined) updates.deliveryAgentType = deliveryAgentType;
    if (deliveryAgentName !== undefined) updates.deliveryAgentName = deliveryAgentName;

    const updatedSubscription = await LocalShopSubscription.findByIdAndUpdate(
      subId,
      { $set: updates },
      { new: true }
    );

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

    if (!date) {
      res.status(400).json({ success: false, message: 'Skip date is required' });
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

    if (!subscription.skippedDates.includes(date)) {
      subscription.skippedDates.push(date);
      await subscription.save();
    }

    res.status(200).json({
      success: true,
      message: `Date ${date} successfully skipped for this subscription`,
      subscription
    });
  } catch (err: any) {
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
router.post('/billing/generate', async (req: Request, res: Response): Promise<void> => {
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
router.get('/billing/statements', async (req: Request, res: Response): Promise<void> => {
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
router.get('/billing/statements/:id', async (req: Request, res: Response): Promise<void> => {
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
router.patch('/billing/statements/:id/approve', async (req: Request, res: Response): Promise<void> => {
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
    res.status(200).json({ success: true, tasks });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 13. GET /billing/pending-tasks
router.get('/billing/pending-tasks', async (req: Request, res: Response): Promise<void> => {
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
router.patch('/billing/tasks/:taskId/approve', async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { taskId } = req.params;
    const { SubscriptionDeliveryTask } = require('../models/SubscriptionDeliveryTask');
    const { WalletLedgerService } = require('../services/WalletLedgerService');
    const { CommissionService } = require('../services/CommissionService');

    const task = await SubscriptionDeliveryTask.findById(taskId);
    if (!task) {
      res.status(404).json({ success: false, message: 'Delivery task not found' });
      return;
    }

    if (task.status !== 'delivered') {
      res.status(400).json({ success: false, message: 'Task is not marked as delivered' });
      return;
    }

    if (task.isPaidToVendor) {
      res.status(400).json({ success: false, message: 'Task payout has already been processed' });
      return;
    }

    const sub = await LocalShopSubscription.findById(task.subscriptionId);
    if (!sub) {
      res.status(404).json({ success: false, message: 'Subscription not found for this task' });
      return;
    }

    const grossAmount = sub.unitPrice * sub.quantity;
    const splits = await CommissionService.calculateSubscriptionSplits(grossAmount);

    // 1. Debit customer wallet (only if not already debited by the delivery boy)
    if (!task.isDebitedFromUser) {
      await WalletLedgerService.debit(
        sub.userId,
        grossAmount,
        'payment',
        task._id,
        'SubscriptionDeliveryTask',
        `Direct task payment for run on date ${task.date}`,
        session
      );
      task.isDebitedFromUser = true;
    }

    // 2. Credit net vendor wallet
    await WalletLedgerService.credit(
      sub.vendorId,
      splits.vendorAmount,
      'subscription_credit',
      task._id,
      'SubscriptionDeliveryTask',
      `Payout for subscription delivery run on date ${task.date}`,
      session
    );

    // Update task status
    task.isPaidToVendor = true;
    await task.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ success: true, message: 'Task payout released successfully', task });
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
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
router.post('/scheduler/run', async (req: Request, res: Response) => {
  try {
    const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
    const result = await SubscriptionSchedulerService.runDailyScheduler();
    res.json({ success: true, message: 'Daily scheduler ran successfully', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 16. POST /scheduler/holds
router.post('/scheduler/holds', async (req: Request, res: Response) => {
  try {
    const { SubscriptionSchedulerService } = require('../services/SubscriptionSchedulerService');
    const result = await SubscriptionSchedulerService.processWalletHoldsForTomorrow();
    res.json({ success: true, message: 'Tomorrow wallet holds processed successfully', result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
