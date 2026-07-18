import mongoose, { ClientSession } from 'mongoose';
import { Coupon } from '../models/Coupon';
import { CouponRedemption } from '../models/CouponRedemption';

export class CouponService {
  /**
   * Validates and atomically redeems a coupon for checkout.
   * Decrements Coupon usageCount atomically and saves a CouponRedemption.
   */
  static async redeemCoupon(
    couponCode: string,
    userId: string | mongoose.Types.ObjectId,
    orderId: string | mongoose.Types.ObjectId,
    subtotal: number,
    sellerId: string,
    session?: ClientSession
  ): Promise<any> {
    const normalizedCode = couponCode.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode }).session(session || null);

    if (!coupon) {
      throw new Error(`Coupon not found: ${normalizedCode}`);
    }

    if (coupon.status !== 'Active') {
      throw new Error('This coupon is no longer active.');
    }

    // Expiry Check
    const todayStr = new Date().toISOString().split('T')[0]!;
    if (coupon.expiryDate && coupon.expiryDate < todayStr) {
      throw new Error('This coupon has expired.');
    }

    // Minimum subtotal
    if (subtotal < (coupon.minSubtotal || 0)) {
      throw new Error(`Minimum subtotal of ₹${coupon.minSubtotal || 0} is required for this coupon.`);
    }

    // Seller scope check
    if (coupon.scope === 'vendor' && coupon.vendorId) {
      if (coupon.vendorId.toString() !== sellerId.toString()) {
        throw new Error('This coupon is not valid for products from this seller.');
      }
    }

    // Per-user limit verification
    const userLimit = coupon.userLimit || 1;
    const userRedemptionCount = await CouponRedemption.countDocuments({
      couponId: coupon._id,
      userId,
      status: { $in: ['active', 'committed'] },
    }).session(session || null);

    if (userRedemptionCount >= userLimit) {
      throw new Error(`You have already redeemed this coupon the maximum allowed times (${userLimit}).`);
    }

    // Atomic increment of global usageCount
    let query = Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        status: 'Active',
        $expr: {
          $lt: ['$usageCount', coupon.usageLimit || 999999],
        },
      },
      {
        $inc: { usageCount: 1 },
      },
      { new: true }
    );

    if (session) {
      query = query.session(session);
    }

    const updatedCoupon = await query;
    if (!updatedCoupon) {
      throw new Error('Coupon usage limit has been reached.');
    }

    // Compute discount amount
    let discount = 0;
    const isPercentage = ['percentage', 'Percentage'].includes(updatedCoupon.discountType);
    if (isPercentage) {
      discount = Math.round((subtotal * updatedCoupon.discountValue) / 100);
    } else {
      discount = updatedCoupon.discountValue;
    }

    if (discount > subtotal) {
      discount = subtotal;
    }

    // Save redemption tracking record
    const redemption = new CouponRedemption({
      couponId: updatedCoupon._id,
      userId,
      orderId,
      discountAmount: discount,
      status: 'active',
    });

    await redemption.save({ session });
    return redemption;
  }

  /**
   * Commits active coupon redemptions on successful checkout.
   */
  static async commitRedemption(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const redemptions = await CouponRedemption.find({
      orderId,
      status: 'active',
    }).session(session || null);

    for (const redemption of redemptions) {
      redemption.status = 'committed';
      await redemption.save({ session });
    }
  }

  /**
   * Releases active coupon redemptions (refunds/reverts usage counts).
   */
  static async releaseRedemption(
    orderId: string | mongoose.Types.ObjectId,
    session?: ClientSession
  ): Promise<void> {
    const redemptions = await CouponRedemption.find({
      orderId,
      status: 'active',
    }).session(session || null);

    for (const redemption of redemptions) {
      // Revert usage count on coupon atomically
      let query = Coupon.findByIdAndUpdate(
        redemption.couponId,
        {
          $inc: { usageCount: -1 },
        },
        { new: true }
      );

      if (session) {
        query = query.session(session);
      }

      await query;

      redemption.status = 'released';
      await redemption.save({ session });
    }
  }
}

export default CouponService;
