import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryMovement extends Document {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  type: 'inbound' | 'outbound' | 'adjustment';
  reason: 'Purchase' | 'Sale' | 'Damage' | 'Theft' | 'Expired' | 'Sample' | 'Correction';
  timestamp: Date;
  remarks?: string;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    quantity: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['inbound', 'outbound', 'adjustment'],
      required: true,
      index: true
    },
    reason: {
      type: String,
      enum: ['Purchase', 'Sale', 'Damage', 'Theft', 'Expired', 'Sample', 'Correction'],
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    remarks: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

export default mongoose.model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema);
