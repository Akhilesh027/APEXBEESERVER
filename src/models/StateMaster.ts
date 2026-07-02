import mongoose, { Document, Schema } from "mongoose";

export interface IStateMaster extends Document {
  name: string;
  code: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const StateMasterSchema = new Schema<IStateMaster>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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

export const StateMaster = mongoose.model<IStateMaster>(
  "StateMaster",
  StateMasterSchema
);
