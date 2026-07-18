import mongoose, { Schema, Document } from 'mongoose';

export interface ICouponRedemption extends Document {
  couponId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  discountAmount: number;
  status: 'active' | 'committed' | 'released';
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'committed', 'released'],
      required: true,
      default: 'active',
      index: true,
    },
    idempotencyKey: {
      type: String,
    },
  },
  { timestamps: true }
);

// Prevent duplicate redemptions for the same order and user
CouponRedemptionSchema.index({ couponId: 1, userId: 1, orderId: 1 }, { unique: true });

// Index for counting active redemptions per coupon
CouponRedemptionSchema.index({ couponId: 1, status: 1 });

export const CouponRedemption = mongoose.model<ICouponRedemption>(
  'CouponRedemption',
  CouponRedemptionSchema
);
export default CouponRedemption;
