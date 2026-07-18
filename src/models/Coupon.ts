import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'flat' | 'Percentage' | 'Fixed Amount';
  discountValue: number;
  minSubtotal?: number;
  expiryDate: string;
  usageCount?: number;
  usageLimit?: number;
  userLimit?: number;
  status: 'Active' | 'Inactive' | 'Expired';
  scope: 'vendor' | 'platform';
  vendorId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: {
      type: String,
      enum: ['percentage', 'flat', 'Percentage', 'Fixed Amount'],
      required: true
    },
    discountValue: { type: Number, required: true },
    minSubtotal: { type: Number, default: 0 },
    expiryDate: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: 999999 },
    userLimit: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Expired'],
      default: 'Active'
    },
    scope: {
      type: String,
      enum: ['vendor', 'platform'],
      default: 'vendor',
      required: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.scope === 'vendor';
      }
    }
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);

