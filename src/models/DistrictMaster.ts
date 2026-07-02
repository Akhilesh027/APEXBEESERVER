import mongoose, { Document, Schema } from "mongoose";

export interface IDistrictMaster extends Document {
  stateId: mongoose.Types.ObjectId;
  name: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const DistrictMasterSchema = new Schema<IDistrictMaster>(
  {
    stateId: {
      type: Schema.Types.ObjectId,
      ref: "StateMaster",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique district name per state
DistrictMasterSchema.index({ stateId: 1, name: 1 }, { unique: true });

export const DistrictMaster = mongoose.model<IDistrictMaster>(
  "DistrictMaster",
  DistrictMasterSchema
);
