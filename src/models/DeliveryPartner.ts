import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicleDetails {
  type: 'Bike' | 'Car' | 'EV' | 'Bicycle' | 'Two-Wheeler';
  number?: string;
  rcNumber?: string;
  insurance?: string;
  drivingLicense?: string;
  rcExpiry?: Date;
  insuranceExpiry?: Date;
  licenseExpiry?: Date;
}

export interface IDeliveryRatings {
  customerRating: number;
  vendorRating: number;
  adminRating: number;
  averageRating: number;
}

export interface IDeliveryKyc {
  aadhaarNumber?: string;
  drivingLicenseNumber?: string;
  panNumber?: string;
  selfieUrl?: string;
  isVerified: boolean;
}

export interface IDeliveryPartner extends Document {
  userId: mongoose.Types.ObjectId;
  deliveryPartnerId?: string;
  name: string;
  mobile: string;
  email: string;
  status: 'active' | 'pending_approval' | 'suspended' | 'offline';
  partnerType: 'Employee' | 'Freelancer';
  vehicle?: IVehicleDetails;
  kyc?: IDeliveryKyc;
  ratings: IDeliveryRatings;
  fixedSalary: number;
  dailyTarget: number;
  deliveriesCount: number;
  badge: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Platinum' | 'Legend';
  referredBy?: mongoose.Types.ObjectId;
  referralBonusReceived?: boolean;
  tdsDeducted: number;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleDetailsSchema = new Schema<IVehicleDetails>({
  type: { type: String, enum: ['Bike', 'Car', 'EV', 'Bicycle', 'Two-Wheeler'], default: 'Bike' },
  number: { type: String, default: '' },
  rcNumber: { type: String, default: '' },
  insurance: { type: String, default: '' },
  drivingLicense: { type: String, default: '' },
  rcExpiry: { type: Date },
  insuranceExpiry: { type: Date },
  licenseExpiry: { type: Date }
}, { _id: false });

const DeliveryRatingsSchema = new Schema<IDeliveryRatings>({
  customerRating: { type: Number, default: 5.0 },
  vendorRating: { type: Number, default: 5.0 },
  adminRating: { type: Number, default: 5.0 },
  averageRating: { type: Number, default: 5.0 }
}, { _id: false });

const DeliveryKycSchema = new Schema<IDeliveryKyc>({
  aadhaarNumber: { type: String, default: '' },
  drivingLicenseNumber: { type: String, default: '' },
  panNumber: { type: String, default: '' },
  selfieUrl: { type: String, default: '' },
  isVerified: { type: Boolean, default: false }
}, { _id: false });

const DeliveryPartnerSchema = new Schema<IDeliveryPartner>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  deliveryPartnerId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  status: { type: String, enum: ['active', 'pending_approval', 'suspended', 'offline'], default: 'pending_approval' },
  partnerType: { type: String, enum: ['Employee', 'Freelancer'], default: 'Employee' },
  vehicle: { type: VehicleDetailsSchema },
  kyc: { type: DeliveryKycSchema, default: () => ({ isVerified: false }) },
  ratings: { type: DeliveryRatingsSchema, default: () => ({}) },
  fixedSalary: { type: Number, default: 0 },
  dailyTarget: { type: Number, default: 10 },
  deliveriesCount: { type: Number, default: 0 },
  badge: { type: String, enum: ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Legend'], default: 'Bronze' },
  referredBy: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner' },
  referralBonusReceived: { type: Boolean, default: false },
  tdsDeducted: { type: Number, default: 0 }
}, { timestamps: true });

export const DeliveryPartner = mongoose.model<IDeliveryPartner>('DeliveryPartner', DeliveryPartnerSchema);

