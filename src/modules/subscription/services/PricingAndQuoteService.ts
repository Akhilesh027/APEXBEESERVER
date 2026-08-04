import mongoose from 'mongoose';
import { SubscriptionProduct } from '../models/SubscriptionProduct';
import { SubscriptionPrice } from '../models/SubscriptionPrice';
import { SubscriptionPlanProfile } from '../models/SubscriptionPlanProfile';
import { SubscriptionProfilePrice } from '../models/SubscriptionProfilePrice';
import { SubscriptionDiscount } from '../models/SubscriptionDiscount';
import { SubscriptionQuote, ISubscriptionQuote } from '../models/SubscriptionQuote';
import { Vendor } from '../../../models/Vendor';
import { Wallet } from '../../../models/Wallet';
import { VendorPricingService } from './VendorPricingService';
import { TaxEngineService } from './TaxEngineService';

export interface ICalculateQuoteInput {
  vendorId: string;
  productId: string;
  priceId?: string;
  billingCycle?: string;
  quantity?: number;
  couponCode?: string;
  applyWalletCredits?: boolean;
}

export class PricingAndQuoteService {
  /**
   * Generates an authoritative 15-minute locked quote executing the 10-step calculation cascade
   */
  public static async createQuote(input: ICalculateQuoteInput): Promise<ISubscriptionQuote> {
    const vId = new mongoose.Types.ObjectId(input.vendorId);
    let pId: mongoose.Types.ObjectId;

    if (input.productId && mongoose.Types.ObjectId.isValid(input.productId)) {
      pId = new mongoose.Types.ObjectId(input.productId);
    } else {
      const fallbackProfile = await SubscriptionPlanProfile.findOne({ tierCode: 'APEXBEE_BUSINESS', status: 'ACTIVE' })
        || await SubscriptionPlanProfile.findOne({ status: 'ACTIVE' })
        || await SubscriptionProduct.findOne({ status: 'ACTIVE' });
      
      if (!fallbackProfile) {
        throw new Error('No active subscription product available');
      }
      pId = fallbackProfile._id as mongoose.Types.ObjectId;
    }

    const vendor = await Vendor.findById(vId);
    if (!vendor) {
      throw new Error('Vendor not found');
    }

    let productName = '';
    let productType = 'PLAN';
    let defaultAmount = 0;
    let gstRate = 18;
    let taxMode = 'EXCLUSIVE';
    let priceIdStr = input.priceId || '';

    const product = await SubscriptionProduct.findById(pId);
    if (product && product.status === 'ACTIVE') {
      productName = product.name;
      productType = product.productType;

      let priceRecord;
      if (input.priceId && mongoose.Types.ObjectId.isValid(input.priceId)) {
        priceRecord = await SubscriptionPrice.findById(input.priceId);
      } else if (input.billingCycle) {
        priceRecord = await SubscriptionPrice.findOne({
          productId: pId,
          billingCycle: input.billingCycle,
          isActive: true
        }).sort({ version: -1 });
      } else {
        priceRecord = await SubscriptionPrice.findOne({
          productId: pId,
          isActive: true
        }).sort({ version: -1 });
      }

      if (!priceRecord) {
        priceRecord = {
          _id: new mongoose.Types.ObjectId(),
          originalAmount: 9990,
          gstRate: 18,
          taxMode: 'EXCLUSIVE'
        };
      }

      defaultAmount = priceRecord.originalAmount * (input.quantity && input.quantity > 0 ? input.quantity : 1);
      gstRate = priceRecord.gstRate || 18;
      taxMode = priceRecord.taxMode || 'EXCLUSIVE';
      priceIdStr = priceRecord._id.toString();
    } else {
      const profile = await SubscriptionPlanProfile.findById(pId) || await SubscriptionPlanProfile.findOne({ status: 'ACTIVE' });
      if (!profile) {
        throw new Error('Subscription plan profile unavailable');
      }

      productName = profile.displayName || (profile as any).name || 'Vendor Business Plan';
      productType = 'PLAN';

      let profilePrice: any;
      if (input.priceId && mongoose.Types.ObjectId.isValid(input.priceId)) {
        profilePrice = await SubscriptionProfilePrice.findById(input.priceId);
      }
      if (!profilePrice && input.billingCycle) {
        profilePrice = await SubscriptionProfilePrice.findOne({
          profileId: profile._id,
          billingCycle: input.billingCycle,
          isActive: true
        });
      }
      if (!profilePrice) {
        profilePrice = await SubscriptionProfilePrice.findOne({
          profileId: profile._id,
          isActive: true
        });
      }

      if (!profilePrice) {
        profilePrice = {
          _id: new mongoose.Types.ObjectId(),
          originalAmount: 9990,
          gstRate: 18,
          taxMode: 'EXCLUSIVE'
        };
      }

      defaultAmount = profilePrice.originalAmount * (input.quantity && input.quantity > 0 ? input.quantity : 1);
      gstRate = profilePrice.gstRate || 18;
      taxMode = profilePrice.taxMode || 'EXCLUSIVE';
      priceIdStr = profilePrice._id.toString();
    }

    // STEP 1, 2, 3: Resolve Vendor Custom Negotiated Price / Customer Type Price / Default Price
    const resolvedBase = await VendorPricingService.resolveVendorBasePrice(
      input.vendorId,
      vendor.storeType || 'restaurant',
      input.productId,
      priceIdStr,
      defaultAmount
    );

    let currentPrice = resolvedBase.resolvedPrice;

    // STEP 4: Individual Vendor Discount
    let vendorDiscountAmount = 0;
    const vendorDiscount = await SubscriptionDiscount.findOne({
      scope: 'VENDOR',
      vendorIds: vId,
      status: 'ACTIVE',
      startsAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    }).sort({ priority: 1 });

    if (vendorDiscount) {
      if (vendorDiscount.discountType === 'FLAT') {
        vendorDiscountAmount = vendorDiscount.discountValue;
      } else {
        vendorDiscountAmount = (currentPrice * vendorDiscount.discountValue) / 100;
        if (vendorDiscount.maximumDiscountAmount) {
          vendorDiscountAmount = Math.min(vendorDiscountAmount, vendorDiscount.maximumDiscountAmount);
        }
      }
    }

    // STEP 5: Global / Promotional / Festival Offer
    let globalOfferAmount = 0;
    const globalOffer = await SubscriptionDiscount.findOne({
      scope: { $in: ['GLOBAL', 'FESTIVAL'] },
      status: 'ACTIVE',
      startsAt: { $lte: new Date() },
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    }).sort({ priority: 1 });

    if (globalOffer) {
      if (globalOffer.discountType === 'FLAT') {
        globalOfferAmount = globalOffer.discountValue;
      } else {
        globalOfferAmount = (currentPrice * globalOffer.discountValue) / 100;
        if (globalOffer.maximumDiscountAmount) {
          globalOfferAmount = Math.min(globalOfferAmount, globalOffer.maximumDiscountAmount);
        }
      }
    }

    // STEP 6: Coupon Code Discount
    let couponDiscountAmount = 0;
    let appliedCouponObj: any = null;
    if (input.couponCode) {
      const cleanCoupon = input.couponCode.trim().toUpperCase();
      const coupon = await SubscriptionDiscount.findOne({
        code: cleanCoupon,
        status: 'ACTIVE',
        startsAt: { $lte: new Date() },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: new Date() } }]
      });

      if (coupon) {
        if (!coupon.minimumOrderAmount || currentPrice >= coupon.minimumOrderAmount) {
          if (coupon.discountType === 'FLAT') {
            couponDiscountAmount = coupon.discountValue;
          } else {
            couponDiscountAmount = (currentPrice * coupon.discountValue) / 100;
            if (coupon.maximumDiscountAmount) {
              couponDiscountAmount = Math.min(couponDiscountAmount, coupon.maximumDiscountAmount);
            }
          }
          appliedCouponObj = {
            id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountValue: coupon.discountValue
          };
        }
      }
    }

    // STEP 7: Referral Reward Discount (placeholder for stackable referral code logic)
    const referralDiscountAmount = 0;

    // Calculate total discount and taxable amount before wallet & tax
    const totalDiscountBeforeWallet = Math.min(
      currentPrice,
      vendorDiscountAmount + globalOfferAmount + couponDiscountAmount + referralDiscountAmount
    );

    const netTaxableBeforeWallet = Math.max(0, currentPrice - totalDiscountBeforeWallet);

    // STEP 8: Wallet Credit Deduction
    let walletDeductionAmount = 0;
    if (input.applyWalletCredits) {
      const vendorWallet = await Wallet.findOne({ userId: vendor.userId });
      if (vendorWallet && vendorWallet.availableBalance > 0) {
        walletDeductionAmount = Math.min(netTaxableBeforeWallet, vendorWallet.availableBalance);
      }
    }

    const netTaxableAmount = Math.max(0, netTaxableBeforeWallet - walletDeductionAmount);

    // STEP 9: Tax Engine Calculation
    const taxResult = TaxEngineService.calculateTax(
      netTaxableAmount,
      gstRate,
      vendor.state,
      taxMode as any
    );

    // Generate unique 15-minute Quote Number
    const quoteSeq = Math.floor(100000 + Math.random() * 900000);
    const quoteNumber = `Q-SUB-${new Date().getFullYear()}-${quoteSeq}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // STEP 10: Store Immutable Locked Quote
    const quote = await SubscriptionQuote.create({
      quoteNumber,
      vendorId: vId,
      productId: pId,
      priceId: (priceIdStr && mongoose.Types.ObjectId.isValid(priceIdStr)) ? new mongoose.Types.ObjectId(priceIdStr) : undefined,
      billingCycle: input.billingCycle || 'YEARLY',
      quantity: input.quantity || 1,

      basePrice: defaultAmount,
      vendorCustomPrice: resolvedBase.pricingSource !== 'DEFAULT_PRICE' ? resolvedBase.resolvedPrice : undefined,

      subtotal: currentPrice,
      vendorDiscountAmount,
      globalOfferAmount,
      couponDiscountAmount,
      referralDiscountAmount,
      walletDeductionAmount,
      totalDiscountAmount: totalDiscountBeforeWallet + walletDeductionAmount,

      taxableAmount: taxResult.taxableAmount,
      gstRate: taxResult.gstRate,
      isInterstate: taxResult.isInterstate,
      cgstAmount: taxResult.cgstAmount,
      sgstAmount: taxResult.sgstAmount,
      igstAmount: taxResult.igstAmount,
      gstAmount: taxResult.totalGstAmount,

      finalPayableAmount: taxResult.finalAmount,

      appliedDiscounts: appliedCouponObj ? [appliedCouponObj] : [],
      pricingSnapshot: {
        productName: productName,
        productCode: product?.code || 'APEXBEE_PLAN',
        pricingSource: resolvedBase.pricingSource,
        sourceDetails: resolvedBase.sourceDetails,
        durationValue: 1,
        durationUnit: 'MONTH'
      },
      lockedPrice: true,
      expiresAt,
      status: 'ACTIVE'
    });

    return quote;
  }
}
