import mongoose, { Schema, Document } from "mongoose";

export interface ICampaign extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  budget: number;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Paused' | 'Ended' | 'Pending Approval';
  createdAt: Date;
  updatedAt: Date;
}

const CampaignSchema = new Schema<ICampaign>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    type: { type: String, default: "Banner" },
    budget: { type: Number, default: 0 },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Ended', 'Pending Approval'],
      default: 'Pending Approval'
    }
  },
  { timestamps: true }
);

export const Campaign = mongoose.model<ICampaign>("Campaign", CampaignSchema);
