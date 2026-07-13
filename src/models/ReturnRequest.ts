import mongoose, { Schema, Document } from 'mongoose';

export interface IReturnRequestItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
}

export interface IReturnRequest extends Document {
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  requestedItems: IReturnRequestItem[];
  reason: string;
  images: string[];
  returnStatus: 'None' | 'Requested' | 'Approved' | 'Rejected' | 'Pickup Scheduled' | 'In Transit' | 'Received' | 'Under Inspection' | 'Completed';
  pickupScheduledAt?: Date;
  pickupAddress?: string;
  receivedAt?: Date;
  inspectionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReturnRequestItemSchema = new Schema<IReturnRequestItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 }
});

const ReturnRequestSchema = new Schema<IReturnRequest>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedItems: { type: [ReturnRequestItemSchema], required: true },
    reason: { type: String, required: true },
    images: [{ type: String }],
    returnStatus: {
      type: String,
      enum: ['None', 'Requested', 'Approved', 'Rejected', 'Pickup Scheduled', 'In Transit', 'Received', 'Under Inspection', 'Completed'],
      default: 'Requested',
      index: true
    },
    pickupScheduledAt: Date,
    pickupAddress: String,
    receivedAt: Date,
    inspectionNotes: String
  },
  { timestamps: true }
);

export default mongoose.model<IReturnRequest>('ReturnRequest', ReturnRequestSchema);
