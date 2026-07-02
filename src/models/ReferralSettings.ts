import mongoose, { Schema, Document } from "mongoose";

export interface IReferralSettings extends Document {
  firstOrderRewards: {
    level1: number;
    level2: number;
    level3: number;
  };
  enabled: boolean;
  defaultReferralCode: string;
}

const ReferralSettingsSchema = new Schema<IReferralSettings>(
  {
    firstOrderRewards: {
      level1: { type: Number, default: 50 },
      level2: { type: Number, default: 25 },
      level3: { type: Number, default: 25 }
    },
    enabled: { type: Boolean, default: true },
    defaultReferralCode: { type: String, default: "APEXBEE" }
  },
  { timestamps: true }
);

export const ReferralSettings = mongoose.model<IReferralSettings>(
  "ReferralSettings",
  ReferralSettingsSchema
);
