import mongoose, { Schema, Document } from "mongoose";

export interface ICommissionSettlement extends Document {
  orderId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  
  // Unified fields
  recipientId: mongoose.Types.ObjectId;
  amount: number;
  settlementType: 'vendor' | 'franchise' | 'entrepreneur' | 'company' | 'wishlink' | 'referralPool';
  releasedTransactionId?: string;

  // Legacy/tracing fields
  vendorId?: mongoose.Types.ObjectId;
  stateFranchiseId?: mongoose.Types.ObjectId | null;
  districtFranchiseId?: mongoose.Types.ObjectId | null;
  mandalFranchiseId?: mongoose.Types.ObjectId | null;
  entrepreneurId?: mongoose.Types.ObjectId | null;
  totalPlatformFee?: number;
  stateCommission?: number;
  districtCommission?: number;
  mandalCommission?: number;
  entrepreneurCommission?: number;
  wishLinkCommission?: number;
  companyCommission?: number;
  referralPoolCommission?: number;

  status: "placed" | "pending" | "released" | "cancelled";
  released?: boolean;
  walletCredited?: boolean;
  releasedBy?: mongoose.Types.ObjectId | string | null;
  releaseDate: Date;
  releasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionSettlementSchema = new Schema<ICommissionSettlement>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, default: 0 },
    settlementType: {
      type: String,
      enum: ['vendor', 'franchise', 'entrepreneur', 'company', 'wishlink', 'referralPool'],
      required: true,
      index: true
    },
    releasedTransactionId: { type: String, default: "" },

    vendorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    stateFranchiseId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    districtFranchiseId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    mandalFranchiseId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    entrepreneurId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    totalPlatformFee: { type: Number, default: 0 },
    stateCommission: { type: Number, default: 0 },
    districtCommission: { type: Number, default: 0 },
    mandalCommission: { type: Number, default: 0 },
    entrepreneurCommission: { type: Number, default: 0 },
    wishLinkCommission: { type: Number, default: 0 },
    companyCommission: { type: Number, default: 0 },
    referralPoolCommission: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["placed", "pending", "released", "cancelled"],
      default: "placed",
      index: true
    },
    released: { type: Boolean, default: false },
    walletCredited: { type: Boolean, default: false },
    releasedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    releaseDate: { type: Date, required: true },
    releasedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate payouts
CommissionSettlementSchema.index(
  { orderId: 1, productId: 1, recipientId: 1, settlementType: 1 },
  { unique: true }
);

CommissionSettlementSchema.index({ recipientId: 1, settlementType: 1, createdAt: -1 });

export const CommissionSettlement = mongoose.model<ICommissionSettlement>(
  "CommissionSettlement",
  CommissionSettlementSchema
);
