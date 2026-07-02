import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorReview extends Document {
  customerId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  images: string[];
  reply?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorReviewSchema = new Schema<IVendorReview>({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: "" },
  images: { type: [String], default: [] },
  reply: { type: String, default: "" }
}, { timestamps: true });

export const VendorReview = mongoose.model<IVendorReview>('VendorReview', VendorReviewSchema);
