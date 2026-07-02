import mongoose, { Schema, Document } from 'mongoose';

export interface ILocalShopSubscription extends Document {
  userId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  productName: string;
  productImage: string;
  quantity: number;
  unitPrice: number;
  frequency: string; // daily, alternate, weekly, monthly, custom
  customDays?: string[];
  deliverySlot: string;
  status: 'active' | 'paused';
  autoRenew: boolean;
  skippedDates: string[];
  completedDates?: string[];
  failedDates?: string[];
  deliveryHistory?: Array<{
    date: string;
    status: 'delivered' | 'failed' | 'skipped';
    notes?: string;
    photo?: string;
    updatedAt?: Date;
  }>;
  startDate: string;
  deliveryAgentId?: mongoose.Types.ObjectId | string | null;
  deliveryAgentType?: string;
  deliveryAgentName?: string;
  createdAt: Date;
}

const LocalShopSubscriptionSchema = new Schema<ILocalShopSubscription>(
  {
    userId: {
      type: Schema.Types.Mixed, // Supports ObjectId or String ids (like mock-user-123)
      required: true,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    productImage: {
      type: String,
      default: ''
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: true,
      default: 0
    },
    frequency: {
      type: String,
      required: true,
      enum: ['daily', 'alternate', 'weekly', 'monthly', 'custom'],
      default: 'daily'
    },
    customDays: {
      type: [String],
      default: []
    },
    deliverySlot: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active'
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    skippedDates: {
      type: [String],
      default: []
    },
    startDate: {
      type: String,
      required: true
    },
    deliveryAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deliveryAgentType: {
      type: String,
      default: ''
    },
    deliveryAgentName: {
      type: String,
      default: ''
    },
    completedDates: {
      type: [String],
      default: []
    },
    failedDates: {
      type: [String],
      default: []
    },
    deliveryHistory: {
      type: [
        {
          date: { type: String, required: true },
          status: { type: String, enum: ['delivered', 'failed', 'skipped'], required: true },
          notes: { type: String, default: '' },
          photo: { type: String, default: '' },
          updatedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

export default mongoose.model<ILocalShopSubscription>('LocalShopSubscription', LocalShopSubscriptionSchema);
