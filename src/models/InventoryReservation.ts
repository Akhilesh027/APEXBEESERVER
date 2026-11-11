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
  batchAllocations?: Array<{ batchId: mongoose.Types.ObjectId; quantity: number }>;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    reservationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    batchAllocations: [{ batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch' }, quantity: Number }],
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
      min: [0.001, 'quantity must be at least 0.001 sellable units'],
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
