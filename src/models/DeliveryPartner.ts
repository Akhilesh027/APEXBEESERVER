import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicleDetails {
  type: 'Bike' | 'Car' | 'EV' | 'Bicycle' | 'Two-Wheeler';
  number?: string;
  rcNumber?: string;
  insurance?: string;
  drivingLicense?: string;
}

export interface IDeliveryRatings {
  customerRating: number;
  vendorRating: number;
  adminRating: number;
  averageRating: number;
}

export interface IDeliveryPartner extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  mobile: string;
  email: string;
  status: 'active' | 'pending_approval' | 'suspended' | 'offline';
  vehicle?: IVehicleDetails;
  ratings: IDeliveryRatings;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleDetailsSchema = new Schema<IVehicleDetails>({
  type: { type: String, enum: ['Bike', 'Car', 'EV', 'Bicycle', 'Two-Wheeler'], default: 'Bike' },
  number: { type: String, default: '' },
  rcNumber: { type: String, default: '' },
  insurance: { type: String, default: '' },
  drivingLicense: { type: String, default: '' }
}, { _id: false });

const DeliveryRatingsSchema = new Schema<IDeliveryRatings>({
  customerRating: { type: Number, default: 5.0 },
  vendorRating: { type: Number, default: 5.0 },
  adminRating: { type: Number, default: 5.0 },
  averageRating: { type: Number, default: 5.0 }
}, { _id: false });

const DeliveryPartnerSchema = new Schema<IDeliveryPartner>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['active', 'pending_approval', 'suspended', 'offline'], default: 'pending_approval' },
  vehicle: { type: VehicleDetailsSchema },
  ratings: { type: DeliveryRatingsSchema, default: () => ({}) }
}, { timestamps: true });

export const DeliveryPartner = mongoose.model<IDeliveryPartner>('DeliveryPartner', DeliveryPartnerSchema);
