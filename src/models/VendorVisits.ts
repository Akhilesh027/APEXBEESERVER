import mongoose, { Document, Schema } from 'mongoose';

export interface IVendorVisit extends Document {
  vendorId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  actionType: "search_impression" | "store_open" | "product_click" | "cart_add" | "order_placed";
  timestamp: Date;
}

const VendorVisitSchema = new Schema<IVendorVisit>({
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  actionType: {
    type: String,
    enum: ["search_impression", "store_open", "product_click", "cart_add", "order_placed"],
    required: true,
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true }
});

export const VendorVisit = mongoose.model<IVendorVisit>('VendorVisit', VendorVisitSchema);
