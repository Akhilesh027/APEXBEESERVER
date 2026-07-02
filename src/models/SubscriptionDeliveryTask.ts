import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionDeliveryTask extends Document {
  subscriptionId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  status: 'pending' | 'assigned' | 'started' | 'delivered' | 'failed' | 'cancelled';
  riderId?: mongoose.Types.ObjectId;
  proofPhoto?: string;
  notes?: string;
  otp?: string;
  otpVerified: boolean;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  signature?: string;
  isPaidToVendor?: boolean;
  isDebitedFromUser?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionDeliveryTaskSchema = new Schema<ISubscriptionDeliveryTask>(
  {
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "LocalShopSubscription",
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'started', 'delivered', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    proofPhoto: { type: String, default: "" },
    notes: { type: String, default: "" },
    otp: { type: String, default: "" },
    otpVerified: { type: Boolean, default: false },
    gpsCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
    signature: { type: String, default: "" },
    isPaidToVendor: { type: Boolean, default: false },
    isDebitedFromUser: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of tasks per subscription per day
SubscriptionDeliveryTaskSchema.index({ subscriptionId: 1, date: 1 }, { unique: true });

export const SubscriptionDeliveryTask = mongoose.model<ISubscriptionDeliveryTask>(
  "SubscriptionDeliveryTask",
  SubscriptionDeliveryTaskSchema
);
