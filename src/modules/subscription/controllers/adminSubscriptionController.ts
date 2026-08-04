import { Response } from 'express';
import { AuthRequest } from '../../../middleware/auth';
import { SubscriptionProduct } from '../models/SubscriptionProduct';
import { SubscriptionPrice } from '../models/SubscriptionPrice';
import { SubscriptionFeature } from '../models/SubscriptionFeature';
import { SubscriptionProductFeature } from '../models/SubscriptionProductFeature';
import { SubscriptionDiscount } from '../models/SubscriptionDiscount';
import { SubscriptionVendorPricing } from '../models/SubscriptionVendorPricing';
import { SubscriptionVendorAgreement } from '../models/SubscriptionVendorAgreement';
import { SubscriptionCustomerTypePricing } from '../models/SubscriptionCustomerTypePricing';
import { VendorSubscription } from '../models/VendorSubscription';
import { SubscriptionInvoice } from '../models/SubscriptionInvoice';
import { SubscriptionPayment } from '../models/SubscriptionPayment';
import { SubscriptionAuditLog } from '../models/SubscriptionAuditLog';
import { AdminSubscriptionService } from '../services/AdminSubscriptionService';
import { SubscriptionAnalyticsService } from '../services/SubscriptionAnalyticsService';
import { SubscriptionLifecycleService } from '../services/SubscriptionLifecycleService';

export class AdminSubscriptionController {
  /**
   * GET /api/admin/subscriptions/dashboard
   */
  public static async getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const analytics = await SubscriptionAnalyticsService.getAnalytics();
      res.json({ success: true, analytics });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/subscription-products
   */
  public static async upsertProduct(req: AuthRequest, res: Response): Promise<void> {
    try {
      const product = await AdminSubscriptionService.upsertProduct(req.body, req.user!.id);
      res.json({ success: true, product });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/subscription-products
   */
  public static async getAllProducts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const products = await SubscriptionProduct.find().sort({ sortOrder: 1, createdAt: -1 });
      const productIds = products.map(p => p._id);
      const prices = await SubscriptionPrice.find({ productId: { $in: productIds } });
      const features = await SubscriptionProductFeature.find({ productId: { $in: productIds } }).populate('featureId');

      res.json({ success: true, products, prices, features });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/subscription-products/:id/prices
   */
  public static async addPriceVersion(req: AuthRequest, res: Response): Promise<void> {
    try {
      const price = await AdminSubscriptionService.addPriceVersion(req.params.id, req.body, req.user!.id);
      res.json({ success: true, price });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/subscription-features
   */
  public static async getFeatures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const features = await SubscriptionFeature.find().sort({ category: 1, name: 1 });
      res.json({ success: true, features });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/subscription-features
   */
  public static async createFeature(req: AuthRequest, res: Response): Promise<void> {
    try {
      const feature = await SubscriptionFeature.create(req.body);
      await AdminSubscriptionService.logAudit('CREATE_FEATURE', 'FEATURE', feature._id.toString(), undefined, 'Created feature', req.user!.id, {}, feature);
      res.json({ success: true, feature });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * PUT /api/admin/subscription-products/:id/features
   */
  public static async assignProductFeatures(req: AuthRequest, res: Response): Promise<void> {
    try {
      const productId = req.params.id;
      const { features } = req.body; // Array of { featureId, enabled, limitValue, enforcementMode }

      await SubscriptionProductFeature.deleteMany({ productId });
      const mappings = (features || []).map((f: any) => ({
        productId,
        featureId: f.featureId,
        enabled: f.enabled ?? true,
        limitValue: f.limitValue !== undefined ? f.limitValue : null,
        enforcementMode: f.enforcementMode || 'HARD_BLOCK'
      }));

      const created = await SubscriptionProductFeature.insertMany(mappings);
      await AdminSubscriptionService.logAudit('ASSIGN_PRODUCT_FEATURES', 'PLAN', productId, undefined, 'Assigned plan features', req.user!.id, {}, created);

      res.json({ success: true, mappings: created });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/subscription-discounts
   */
  public static async createDiscount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const discount = await SubscriptionDiscount.create({ ...req.body, createdBy: req.user!.id });
      await AdminSubscriptionService.logAudit('CREATE_DISCOUNT', 'DISCOUNT', discount._id.toString(), undefined, 'Created discount', req.user!.id, {}, discount);
      res.json({ success: true, discount });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/subscription-discounts
   */
  public static async getDiscounts(req: AuthRequest, res: Response): Promise<void> {
    try {
      const discounts = await SubscriptionDiscount.find().sort({ createdAt: -1 });
      res.json({ success: true, discounts });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/vendor-pricing
   */
  public static async setVendorPricingOverride(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { vendorId, productId, overridePrice, reason, validTill } = req.body;
      const override = await AdminSubscriptionService.setVendorPricingOverride(vendorId, productId, overridePrice, reason, req.user!.id, validTill);
      res.json({ success: true, override });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/vendor-pricing
   */
  public static async getVendorPricings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const pricings = await SubscriptionVendorPricing.find().populate('vendorId').populate('productId').sort({ createdAt: -1 });
      res.json({ success: true, pricings });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/vendor-subscriptions/assign
   */
  public static async assignVendorPlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { vendorId, productId, priceId, reason } = req.body;
      const sub = await AdminSubscriptionService.assignVendorPlan(vendorId, productId, priceId, reason || 'Admin manual assignment', req.user!.id);
      res.json({ success: true, subscription: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/vendor-subscriptions/:id/pause
   */
  public static async pauseSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reason } = req.body;
      const sub = await SubscriptionLifecycleService.pauseSubscription(req.params.id, reason || 'Admin pause', req.user!.id);
      res.json({ success: true, subscription: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/admin/vendor-subscriptions/:id/resume
   */
  public static async resumeSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const sub = await SubscriptionLifecycleService.resumeSubscription(req.params.id, req.user!.id);
      res.json({ success: true, subscription: sub });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/admin/subscription-audit-logs
   */
  public static async getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
    try {
      const logs = await SubscriptionAuditLog.find().populate('performedBy').populate('vendorId').sort({ createdAt: -1 }).limit(100);
      res.json({ success: true, logs });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
