import mongoose from 'mongoose';
import { SubscriptionCustomerTypePricing } from '../models/SubscriptionCustomerTypePricing';
import { SubscriptionVendorPricing } from '../models/SubscriptionVendorPricing';
import { SubscriptionVendorAgreement } from '../models/SubscriptionVendorAgreement';

export interface IVendorResolvedBasePrice {
  resolvedPrice: number;
  pricingSource: 'DEFAULT_PRICE' | 'CUSTOMER_TYPE_PRICE' | 'VENDOR_OVERRIDE' | 'ENTERPRISE_AGREEMENT';
  sourceDetails?: Record<string, any>;
}

export class VendorPricingService {
  /**
   * Resolves the starting base price for a vendor according to the priority:
   * 1. Active Enterprise Vendor Agreement
   * 2. Active Vendor Custom Negotiated Pricing Override
   * 3. Customer Type / Category Pricing
   * 4. Standard Plan Default Price
   */
  public static async resolveVendorBasePrice(
    vendorId: string,
    vendorType: string,
    productId: string,
    priceId: string,
    defaultPriceAmount: number
  ): Promise<IVendorResolvedBasePrice> {
    const vId = new mongoose.Types.ObjectId(vendorId);
    const pId = new mongoose.Types.ObjectId(productId);
    const prId = new mongoose.Types.ObjectId(priceId);

    // 1. Check Enterprise Contract Agreement
    const activeAgreement = await SubscriptionVendorAgreement.findOne({
      vendorId: vId,
      productId: pId,
      status: 'ACTIVE',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() }
    });

    if (activeAgreement) {
      return {
        resolvedPrice: activeAgreement.lockedPricePerMonth,
        pricingSource: 'ENTERPRISE_AGREEMENT',
        sourceDetails: {
          agreementNumber: activeAgreement.agreementNumber,
          contractTitle: activeAgreement.contractTitle
        }
      };
    }

    // 2. Check Custom Vendor Pricing Override
    const activeVendorPricing = await SubscriptionVendorPricing.findOne({
      vendorId: vId,
      productId: pId,
      status: 'ACTIVE',
      validFrom: { $lte: new Date() },
      $or: [{ validTill: { $exists: false } }, { validTill: null }, { validTill: { $gte: new Date() } }]
    });

    if (activeVendorPricing) {
      return {
        resolvedPrice: activeVendorPricing.finalPrice,
        pricingSource: 'VENDOR_OVERRIDE',
        sourceDetails: {
          originalPrice: activeVendorPricing.originalPrice,
          overridePrice: activeVendorPricing.overridePrice,
          reason: activeVendorPricing.reason,
          validTill: activeVendorPricing.validTill
        }
      };
    }

    // 3. Check Customer Type Pricing
    const customerTypePricing = await SubscriptionCustomerTypePricing.findOne({
      productId: pId,
      priceId: prId,
      vendorType: vendorType.toLowerCase(),
      isActive: true
    });

    if (customerTypePricing) {
      return {
        resolvedPrice: customerTypePricing.customAmount,
        pricingSource: 'CUSTOMER_TYPE_PRICE',
        sourceDetails: {
          vendorType: customerTypePricing.vendorType
        }
      };
    }

    // 4. Default Plan Price
    return {
      resolvedPrice: defaultPriceAmount,
      pricingSource: 'DEFAULT_PRICE'
    };
  }
}
