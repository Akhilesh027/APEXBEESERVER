import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryReservation extends Document {
  reservationId: string;
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId | null;
  quantity: number;
  status: 'active' | 'committed' | 'released' | 'expired';
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['active', 'committed', 'released', 'expired'],
      default: 'active',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate reservations per order item
InventoryReservationSchema.index({ orderId: 1, productId: 1, variantId: 1 }, { unique: true });

// Index for query validation and expiry monitoring
InventoryReservationSchema.index({ status: 1, expiresAt: 1 });

export const InventoryReservation = mongoose.model<IInventoryReservation>(
  'InventoryReservation',
  InventoryReservationSchema
);
export default InventoryReservation;
