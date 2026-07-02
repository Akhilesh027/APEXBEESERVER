import mongoose, { Schema, Document } from "mongoose";

export interface ISubscriptionTemplate extends Document {
  vendorId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  name: string;
  defaultPrice: number;
  allowedFrequencies: ('daily' | 'alternate' | 'weekly' | 'monthly' | 'custom')[];
  defaultSlot: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionTemplateSchema = new Schema<ISubscriptionTemplate>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true
    },
    name: { type: String, required: true },
    defaultPrice: { type: Number, required: true, default: 0 },
    allowedFrequencies: {
      type: [String],
      enum: ['daily', 'alternate', 'weekly', 'monthly', 'custom'],
      default: ['daily']
    },
    defaultSlot: { type: String, default: "Morning (6:00 AM - 8:00 AM)" },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

export const SubscriptionTemplate = mongoose.model<ISubscriptionTemplate>(
  "SubscriptionTemplate",
  SubscriptionTemplateSchema
);
