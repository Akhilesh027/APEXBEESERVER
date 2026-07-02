import mongoose, { Schema, Document } from "mongoose";

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'flat' | 'Percentage' | 'Fixed Amount';
  discountValue: number;
  minSubtotal?: number;
  expiryDate: string;
  usageCount?: number;
  status: 'Active' | 'Inactive' | 'Expired';
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
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Expired'],
      default: 'Active'
    }
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
