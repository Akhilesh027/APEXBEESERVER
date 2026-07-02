import mongoose, { Schema, Document } from "mongoose";

export interface ICommissionRule extends Document {
  name?: string;
  businessType?: string;
  description?: string;
  platformPercentage: number;
  franchisePercentage: number;
  vendorPercentage: number;
  isActive: boolean;
  entrepreneurPercent?: number;
  mandalPercent?: number;
  districtPercent?: number;
  statePercent?: number;
  companyPercent?: number;
  active?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommissionRuleSchema = new Schema<ICommissionRule>(
  {
    name: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    businessType: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    description: { type: String, default: "" },
    platformPercentage: { type: Number, required: true, default: 5 },
    franchisePercentage: { type: Number, required: true, default: 5 },
    vendorPercentage: { type: Number, required: true, default: 90 },
    isActive: { type: Boolean, default: true, index: true },
    entrepreneurPercent: { type: Number, default: 0 },
    mandalPercent: { type: Number, default: 0 },
    districtPercent: { type: Number, default: 0 },
    statePercent: { type: Number, default: 0 },
    companyPercent: { type: Number, default: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const CommissionRule = mongoose.model<ICommissionRule>(
  "CommissionRule",
  CommissionRuleSchema
);
