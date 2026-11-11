import mongoose, { Schema } from 'mongoose';
const score = { type: Number, required: true, min: 1, max: 5 };
const schema = new Schema({
  subscriptionId: { type: Schema.Types.ObjectId, required: true, ref: 'LocalShopSubscription', unique: true },
  customerId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  vendorId: { type: Schema.Types.ObjectId, required: true, ref: 'Vendor', index: true },
  productId: { type: Schema.Types.ObjectId, required: true, ref: 'Product' },
  customerName: String, productName: String,
  freshness: score, taste: score, deliveryTiming: score, packaging: score, overall: score,
  comment: { type: String, maxlength: 2000, default: '' }, reply: { type: String, maxlength: 1000, default: '' }, repliedAt: Date,
}, { timestamps: true });
export const DairyReview = mongoose.model('DairyReview', schema);
