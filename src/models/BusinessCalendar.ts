import mongoose, { Schema, Document } from "mongoose";

export interface IBusinessCalendar extends Document {
  name: string;
  date: string; // YYYY-MM-DD
  type: 'national_holiday' | 'vendor_holiday' | 'franchise_holiday' | 'maintenance' | 'emergency_closure';
  vendorId?: mongoose.Types.ObjectId; // null for national holidays
  state?: string;
  district?: string;
  mandal?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessCalendarSchema = new Schema<IBusinessCalendar>(
  {
    name: { type: String, required: true },
    date: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['national_holiday', 'vendor_holiday', 'franchise_holiday', 'maintenance', 'emergency_closure'],
      index: true
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true
    },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    mandal: { type: String, default: "" },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness of dates per calendar scope
BusinessCalendarSchema.index({ date: 1, type: 1, vendorId: 1 }, { unique: true });

export const BusinessCalendar = mongoose.model<IBusinessCalendar>(
  "BusinessCalendar",
  BusinessCalendarSchema
);
