import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledDelivery extends Document {
  orderId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId;
  deliveryDate: Date;
  deliveryWindow: string; // e.g. "09:00 AM - 12:00 PM"
  status: 'Booked' | 'Confirmed' | 'Out for Delivery' | 'Delivered' | 'Failed' | 'Cancelled' | 'Rescheduled';
  driverAssignedId?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledDeliverySchema = new Schema<IScheduledDelivery>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: 'DeliverySlot', required: true, index: true },
    deliveryDate: { type: Date, required: true, index: true },
    deliveryWindow: { type: String, required: true },
    status: {
      type: String,
      enum: ['Booked', 'Confirmed', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled', 'Rescheduled'],
      default: 'Booked',
      index: true
    },
    driverAssignedId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner' },
    notes: String
  },
  { timestamps: true }
);

export default mongoose.model<IScheduledDelivery>('ScheduledDelivery', ScheduledDeliverySchema);
