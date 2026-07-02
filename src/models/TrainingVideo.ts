import mongoose, { Schema, Document } from "mongoose";

export interface ITrainingVideo extends Document {
  title: string;
  description: string;
  url: string;
  roleType: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrainingVideoSchema = new Schema<ITrainingVideo>(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    url: { type: String, required: true },
    roleType: { type: String, default: "All" }
  },
  { timestamps: true }
);

export const TrainingVideo = mongoose.model<ITrainingVideo>("TrainingVideo", TrainingVideoSchema);
