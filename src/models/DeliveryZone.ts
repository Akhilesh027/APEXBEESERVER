import mongoose, { Schema, Document } from 'mongoose';
import { ILocationCoords } from './DeliveryAttendance';

export interface IDeliveryZone extends Document {
  name: string;
  state: string;
  district: string;
  mandal: string;
  coordinates: ILocationCoords[];
  radius?: number; // radius in km if circle model is used
  priority: number;
}

const CoordsSchema = new Schema<ILocationCoords>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const DeliveryZoneSchema = new Schema<IDeliveryZone>({
  name: { type: String, required: true, unique: true },
  state: { type: String, required: true, index: true },
  district: { type: String, required: true, index: true },
  mandal: { type: String, required: true, index: true },
  coordinates: { type: [CoordsSchema], default: [] },
  radius: { type: Number, default: 0 },
  priority: { type: Number, default: 0 }
}, { timestamps: true });

export const DeliveryZone = mongoose.model<IDeliveryZone>('DeliveryZone', DeliveryZoneSchema);
