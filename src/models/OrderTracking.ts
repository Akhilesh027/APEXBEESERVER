import mongoose, { Schema, Document } from "mongoose";

export interface IOrderTracking extends Document {
  orderId: string;
  orderNumber: string;
  etaMinutes: number;
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';
  otp: string;
  deliveryPartnerName: string;
  deliveryPartnerPhone: string;
  deliveryPartnerVehicle: string;
  deliveryPartnerRating: number;
  progressPercentage: number; // 0 to 100
  createdAt: Date;
  updatedAt: Date;
}

const OrderTrackingSchema = new Schema<IOrderTracking>(
  {
    orderId: { type: String, required: true },
    orderNumber: { type: String, required: true },
    etaMinutes: { type: Number, default: 15 },
    status: {
      type: String,
      enum: ['placed', 'preparing', 'out_for_delivery', 'delivered'],
      default: 'placed'
    },
    otp: { type: String, default: '5829' },
    deliveryPartnerName: { type: String, default: '' },
    deliveryPartnerPhone: { type: String, default: '' },
    deliveryPartnerVehicle: { type: String, default: '' },
    deliveryPartnerRating: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const OrderTracking = mongoose.model<IOrderTracking>("OrderTracking", OrderTrackingSchema);
