import mongoose, { Schema, Document } from 'mongoose';
import { ILocationCoords } from './DeliveryAttendance';

export interface IDeliveryLocation extends Document {
  partnerId: mongoose.Types.ObjectId;
  coordinates: ILocationCoords;
  timestamp: Date;
}

const CoordsSchema = new Schema<ILocationCoords>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const DeliveryLocationSchema = new Schema<IDeliveryLocation>({
  partnerId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
  coordinates: { type: CoordsSchema, required: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

// Create TTL index to keep location history clean (e.g., expire after 30 days)
DeliveryLocationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

export const DeliveryLocation = mongoose.model<IDeliveryLocation>('DeliveryLocation', DeliveryLocationSchema);
