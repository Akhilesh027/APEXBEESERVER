import mongoose, { Schema, Document } from 'mongoose';
import { ILocationCoords } from './DeliveryAttendance';

export interface IDeliveryProof extends Document {
  assignmentId: mongoose.Types.ObjectId;
  otpCode?: string;
  signatureImageUrl?: string;
  proofPhotoUrl?: string;
  coordinates: ILocationCoords;
  timestamp: Date;
  customerNote?: string;
  deliveryNote?: string;
}

const CoordsSchema = new Schema<ILocationCoords>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true }
}, { _id: false });

const DeliveryProofSchema = new Schema<IDeliveryProof>({
  assignmentId: { type: Schema.Types.ObjectId, ref: 'DeliveryAssignment', required: true, unique: true, index: true },
  otpCode: { type: String },
  signatureImageUrl: { type: String, default: '' },
  proofPhotoUrl: { type: String, default: '' },
  coordinates: { type: CoordsSchema, required: true },
  timestamp: { type: Date, default: Date.now, required: true },
  customerNote: { type: String, default: '' },
  deliveryNote: { type: String, default: '' }
}, { timestamps: true });

export const DeliveryProof = mongoose.model<IDeliveryProof>('DeliveryProof', DeliveryProofSchema);
