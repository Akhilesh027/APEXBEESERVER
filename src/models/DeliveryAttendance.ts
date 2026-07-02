import mongoose, { Schema, Document } from 'mongoose';

export interface ILocationCoords {
  lat: number;
  lng: number;
}

export interface IBreak {
  start: Date;
  end?: Date;
  reason?: string;
}

export interface IDeliveryAttendance extends Document {
  partnerId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  checkInTime?: Date;
  checkOutTime?: Date;
  breaks: IBreak[];
  status: 'CheckedIn' | 'OnBreak' | 'CheckedOut';
  startLocation?: ILocationCoords;
  endLocation?: ILocationCoords;
  createdAt: Date;
  updatedAt: Date;
}

const CoordsSchema = new Schema<ILocationCoords>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const BreakSchema = new Schema<IBreak>({
  start: { type: Date, required: true },
  end: { type: Date },
  reason: { type: String, default: '' }
}, { _id: false });

const DeliveryAttendanceSchema = new Schema<IDeliveryAttendance>({
  partnerId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
  date: { type: String, required: true, index: true },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  breaks: { type: [BreakSchema], default: [] },
  status: { type: String, enum: ['CheckedIn', 'OnBreak', 'CheckedOut'], default: 'CheckedOut', required: true },
  startLocation: { type: CoordsSchema },
  endLocation: { type: CoordsSchema }
}, { timestamps: true });

export const DeliveryAttendance = mongoose.model<IDeliveryAttendance>('DeliveryAttendance', DeliveryAttendanceSchema);
