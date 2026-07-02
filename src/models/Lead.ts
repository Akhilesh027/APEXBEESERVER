import mongoose, { Document, Schema } from "mongoose";

export interface ILead extends Document {
  name: string;
  mobile: string;
  email: string;
  source: string;
  entrepreneurId?: mongoose.Types.ObjectId | null;
  stateId?: mongoose.Types.ObjectId | null;
  districtId?: mongoose.Types.ObjectId | null;
  mandalId?: mongoose.Types.ObjectId | null;
  status: "New" | "Contacted" | "Follow-up" | "Converted" | "Lost";
  convertedTo?: string;
  convertedBusinessId?: mongoose.Types.ObjectId | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true, index: true },
    email: { type: String, default: "", trim: true },
    source: { type: String, default: "Manual" },
    entrepreneurId: {
      type: Schema.Types.ObjectId,
      ref: "Entrepreneur",
      default: null,
      index: true,
    },
    stateId: {
      type: Schema.Types.ObjectId,
      ref: "StateMaster",
      default: null,
    },
    districtId: {
      type: Schema.Types.ObjectId,
      ref: "DistrictMaster",
      default: null,
    },
    mandalId: {
      type: Schema.Types.ObjectId,
      ref: "MandalMaster",
      default: null,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Follow-up", "Converted", "Lost"],
      default: "New",
      index: true,
    },
    convertedTo: { type: String, default: "" },
    convertedBusinessId: { type: Schema.Types.ObjectId, default: null },
    notes: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

export const Lead = mongoose.model<ILead>("Lead", LeadSchema);
