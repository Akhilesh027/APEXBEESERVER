import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliverySlot extends Document {
  sellerId: mongoose.Types.ObjectId;
  date: string; // Format: YYYY-MM-DD
  timeSlot: string; // Format: 08:00 AM - 10:00 AM, etc.
  maxOrders: number;
  bookedOrders: number;
}

const DeliverySlotSchema = new Schema<IDeliverySlot>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true,
      index: true
    },
    timeSlot: {
      type: String,
      required: true,
      index: true
    },
    maxOrders: {
      type: Number,
      default: 20
    },
    bookedOrders: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

DeliverySlotSchema.index({ sellerId: 1, date: 1, timeSlot: 1 }, { unique: true });

export default mongoose.model<IDeliverySlot>('DeliverySlot', DeliverySlotSchema);
