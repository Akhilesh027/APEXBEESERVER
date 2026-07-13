import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryReservation extends Document {
  orderId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  quantity: number;
  status: 'Reserved' | 'Released' | 'Fulfilled';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['Reserved', 'Released', 'Fulfilled'],
      default: 'Reserved',
      index: true
    },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate reservations per order item
InventoryReservationSchema.index({ orderId: 1, productId: 1 }, { unique: true });

export default mongoose.model<IInventoryReservation>('InventoryReservation', InventoryReservationSchema);
