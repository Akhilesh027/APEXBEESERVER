import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledPickup extends Document {
  vendorId: mongoose.Types.ObjectId;
  customer: string;
  pickupAddress: string;
  pickupDate: string;
  timeSlot: string;
  status: 'Scheduled' | 'Pending Pickup' | 'Delivered' | 'Cancelled';
  courier: string;
  ordersCount: number;
  createdAt: Date;
}

const ScheduledPickupSchema = new Schema<IScheduledPickup>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    customer: {
      type: String,
      default: 'Self Collection'
    },
    pickupAddress: {
      type: String,
      required: true
    },
    pickupDate: {
      type: String,
      required: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Pending Pickup', 'Delivered', 'Cancelled'],
      default: 'Scheduled'
    },
    courier: {
      type: String,
      default: 'Self Dispatch'
    },
    ordersCount: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
);

export default mongoose.model<IScheduledPickup>('ScheduledPickup', ScheduledPickupSchema);
