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
  otpAttempts?: number;
  updatedBy?: mongoose.Types.ObjectId;
  confirmedAt?: Date;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
  };
  signature?: string;
  isPaidToVendor?: boolean;
  isDebitedFromUser?: boolean;
  chargeAmount?: number;
  fundingStatus?: 'reserved' | 'captured' | 'refunded';
  fundingRevision?: number;
  fundingReminderDate?: string;
  batchAllocations?: Array<{ batchId: mongoose.Types.ObjectId; quantity: number }>;
  reportingVersion?: number;
  reportedComponents?: Array<{ productId: mongoose.Types.ObjectId; productName: string; packs: number; packSize: string; litres: number | null; warning?: string }>;
  deliverySlot?: string;
  slotExtended?: boolean;
  slotExtendedUntil?: Date | null;
  slotExtensionReason?: string;
  failedReason?: string;
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
    otpAttempts: { type: Number, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    confirmedAt: Date,
    gpsCoordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    },
    signature: { type: String, default: "" },
    isPaidToVendor: { type: Boolean, default: false },
    isDebitedFromUser: { type: Boolean, default: false },
    chargeAmount: Number,
    fundingStatus: { type: String, enum: ['reserved', 'captured', 'refunded'] },
    fundingRevision: Number,
    fundingReminderDate: String,
    batchAllocations: [{ batchId: { type: Schema.Types.ObjectId, ref: 'StockBatch' }, quantity: Number }],
    reportingVersion: Number,
    reportedComponents: [{ productId: { type: Schema.Types.ObjectId, required: true }, productName: String, packs: Number, packSize: String, litres: { type: Number, default: null }, warning: String }],
    deliverySlot: { type: String, default: '' },
    slotExtended: { type: Boolean, default: false },
    slotExtendedUntil: { type: Date, default: null },
    slotExtensionReason: { type: String, default: '' },
    failedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of tasks per subscription per day
SubscriptionDeliveryTaskSchema.index({ subscriptionId: 1, date: 1 }, { unique: true });

export const SubscriptionDeliveryTask = mongoose.model<ISubscriptionDeliveryTask>(
  "SubscriptionDeliveryTask",
  SubscriptionDeliveryTaskSchema
);
