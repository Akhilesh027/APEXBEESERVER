import mongoose, { Schema, Document } from "mongoose";

export interface ICourse extends Document {
  providerId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  price: number;
  status: 'Draft' | 'Published' | 'Pending Review' | 'Rejected';
  duration: string;
  instructors: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['Draft', 'Published', 'Pending Review', 'Rejected'],
      default: 'Published'
    },
    duration: { type: String, default: "" },
    instructors: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>("Course", CourseSchema);
