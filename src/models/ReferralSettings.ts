import mongoose, { Schema, Document } from "mongoose";

export interface IReferralSettings extends Document {
  firstOrderRewards: {
    level1: number;
    level2: number;
    level3: number;
  };
  onboardingRewards: {
    vendor: number;
    service_provider: number;
    wholesaler: number;
    manufacturer: number;
    entrepreneur: number;
    mandal_franchise: number;
    district_franchise: number;
    state_franchise: number;
  };
  enabled: boolean;
  defaultReferralCode: string;
}

const ReferralSettingsSchema = new Schema<IReferralSettings>(
  {
    firstOrderRewards: {
      level1: { type: Number, default: 0 },
      level2: { type: Number, default: 0 },
      level3: { type: Number, default: 0 }
    },
    onboardingRewards: {
      vendor: { type: Number, default: 0 },
      service_provider: { type: Number, default: 0 },
      wholesaler: { type: Number, default: 0 },
      manufacturer: { type: Number, default: 0 },
      entrepreneur: { type: Number, default: 0 },
      mandal_franchise: { type: Number, default: 0 },
      district_franchise: { type: Number, default: 0 },
      state_franchise: { type: Number, default: 0 }
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
