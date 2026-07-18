import mongoose, { Document, Schema } from 'mongoose';

export interface IProductReview extends Document {
  customerId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId;
  vendorId?: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  reply?: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductReviewSchema = new Schema<IProductReview>({
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
  vendorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, default: "" },
  comment: { type: String, default: "" },
  images: { type: [String], default: [] },
  reply: { type: String, default: "" },
  isApproved: { type: Boolean, default: true }
}, { timestamps: true });

export const ProductReview = mongoose.model<IProductReview>('ProductReview', ProductReviewSchema);
