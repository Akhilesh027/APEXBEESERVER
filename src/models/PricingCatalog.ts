import mongoose, { Schema, Document } from "mongoose";

export interface IPricingCatalog extends Document {
  serviceKey: string;
  category: "franchise" | "vendor" | "partner" | "general";
  title: string;
  description: string;
  amount: number;
  currency: string;
  billingCycle: "one_time" | "monthly" | "quarterly" | "yearly";
  minAdvancePercentage?: number;
  features: string[];
  taxPercentage: number;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PricingCatalogSchema = new Schema<IPricingCatalog>(
  {
    serviceKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["franchise", "vendor", "partner", "general"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    billingCycle: {
      type: String,
      enum: ["one_time", "monthly", "quarterly", "yearly"],
      default: "one_time",
    },
    minAdvancePercentage: {
      type: Number,
      default: 20,
    },
    features: {
      type: [String],
      default: [],
    },
    taxPercentage: {
      type: Number,
      default: 18,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const PricingCatalog = mongoose.model<IPricingCatalog>(
  "PricingCatalog",
  PricingCatalogSchema
);
