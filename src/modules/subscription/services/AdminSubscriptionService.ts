import mongoose from 'mongoose';
import { SubscriptionProduct } from '../models/SubscriptionProduct';
import { SubscriptionPrice } from '../models/SubscriptionPrice';
import { SubscriptionFeature } from '../models/SubscriptionFeature';
import { SubscriptionProductFeature } from '../models/SubscriptionProductFeature';
import { SubscriptionDiscount } from '../models/SubscriptionDiscount';
import { SubscriptionVendorPricing } from '../models/SubscriptionVendorPricing';
import { SubscriptionVendorAgreement } from '../models/SubscriptionVendorAgreement';
import { SubscriptionOverride } from '../models/SubscriptionOverride';
import { SubscriptionAuditLog } from '../models/SubscriptionAuditLog';
import { SubscriptionLifecycleService } from './SubscriptionLifecycleService';

export class AdminSubscriptionService {
  /**
   * Log administrative audit action
   */
  public static async logAudit(
    action: string,
    targetType: any,
    targetId: string | undefined,
    vendorId: string | undefined,
    reason: string,
    performedByUserId: string,
    previousValue: any = {},
    newValue: any = {}
  ) {
    await SubscriptionAuditLog.create({
      action,
      targetType,
      targetId: targetId ? new mongoose.Types.ObjectId(targetId) : undefined,
      vendorId: vendorId ? new mongoose.Types.ObjectId(vendorId) : undefined,
      reason,
      performedBy: new mongoose.Types.ObjectId(performedByUserId),
      previousValue,
      newValue
    });
  }

  /**
   * Create or update Subscription Product (Plan / Addon)
   */
  public static async upsertProduct(data: any, adminUserId: string) {
    let product;
    if (data._id || data.id) {
      const pId = data._id || data.id;
      const prev = await SubscriptionProduct.findById(pId);
      product = await SubscriptionProduct.findByIdAndUpdate(pId, data, { new: true });
      await this.logAudit('UPDATE_PRODUCT', 'PLAN', pId, undefined, 'Admin updated product', adminUserId, prev, product);
    } else {
      product = await SubscriptionProduct.create(data);
      await this.logAudit('CREATE_PRODUCT', 'PLAN', product._id.toString(), undefined, 'Admin created product', adminUserId, {}, product);
    }
    return product;
  }

  /**
   * Create new price version for product
   */
  public static async addPriceVersion(productId: string, priceData: any, adminUserId: string) {
    const pId = new mongoose.Types.ObjectId(productId);
    
    // Increment version
    const latest = await SubscriptionPrice.findOne({ productId: pId, billingCycle: priceData.billingCycle }).sort({ version: -1 });
    const version = latest ? latest.version + 1 : 1;

    const newPrice = await SubscriptionPrice.create({
      ...priceData,
      productId: pId,
      version,
      isActive: true
    });

    await this.logAudit('ADD_PRICE_VERSION', 'PRICE', newPrice._id.toString(), undefined, 'New price version created', adminUserId, {}, newPrice);
    return newPrice;
  }

  /**
   * Assign plan manually to vendor with reason log
   */
  public static async assignVendorPlan(
    vendorId: string,
    productId: string,
    priceId: string,
    reason: string,
    adminUserId: string
  ) {
    const sub = await SubscriptionLifecycleService.activateSubscription(vendorId, productId, priceId, undefined, adminUserId);
    await this.logAudit('MANUAL_VENDOR_ASSIGNMENT', 'ASSIGNMENT', sub._id.toString(), vendorId, reason, adminUserId, {}, sub);
    return sub;
  }

  /**
   * Create Vendor Pricing Override
   */
  public static async setVendorPricingOverride(
    vendorId: string,
    productId: string,
    overridePrice: number,
    reason: string,
    adminUserId: string,
    validTill?: Date
  ) {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const pId = new mongoose.Types.ObjectId(productId);

    const price = await SubscriptionPrice.findOne({ productId: pId, isActive: true }).sort({ version: -1 });
    const originalPrice = price ? price.originalAmount : overridePrice;

    // Deactivate previous overrides
    await SubscriptionVendorPricing.updateMany({ vendorId: vId, productId: pId, status: 'ACTIVE' }, { status: 'INACTIVE' });

    const vendorPricing = await SubscriptionVendorPricing.create({
      vendorId: vId,
      productId: pId,
      originalPrice,
      overridePrice,
      finalPrice: overridePrice,
      reason,
      approvedBy: new mongoose.Types.ObjectId(adminUserId),
      validFrom: new Date(),
      validTill,
      status: 'ACTIVE'
    });

    await this.logAudit('SET_VENDOR_PRICING', 'VENDOR_PRICING', vendorPricing._id.toString(), vendorId, reason, adminUserId, {}, vendorPricing);
    return vendorPricing;
  }

  /**
   * Individual feature limit override per vendor
   */
  public static async setFeatureOverride(
    vendorId: string,
    featureKey: string,
    enabled: boolean,
    limitValue: number | undefined,
    reason: string,
    adminUserId: string,
    expiresAt?: Date
  ) {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const uppercaseKey = featureKey.toUpperCase();

    const override = await SubscriptionOverride.create({
      vendorId: vId,
      featureKey: uppercaseKey,
      enabled,
      limitValue,
      action: enabled ? 'ENABLE' : 'DISABLE',
      startsAt: new Date(),
      expiresAt,
      reason,
      createdBy: new mongoose.Types.ObjectId(adminUserId)
    });

    await this.logAudit('SET_FEATURE_OVERRIDE', 'OVERRIDE', override._id.toString(), vendorId, reason, adminUserId, {}, override);
    return override;
  }
}
