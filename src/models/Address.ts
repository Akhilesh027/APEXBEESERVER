import mongoose, { Document, Schema } from 'mongoose';

export type AddressLabel = 'home' | 'office' | 'parents' | 'other';
export type ServiceabilityStatus = 'unknown' | 'serviceable' | 'not_serviceable';

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  label: AddressLabel;
  customLabel?: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  district?: string;
  state: string;
  country: string;
  pincode: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  deliveryInstructions?: string;
  isDefault: boolean;
  serviceabilityStatus: ServiceabilityStatus;
  name?: string;
  address?: string;
  type?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, enum: ['home', 'office', 'parents', 'other'], default: 'home', required: true },
    customLabel: { type: String },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    landmark: { type: String },
    city: { type: String, required: true },
    district: { type: String },
    state: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    pincode: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point', required: true },
      coordinates: { type: [Number], required: true }, // [longitude, latitude]
    },
    deliveryInstructions: { type: String },
    isDefault: { type: Boolean, default: false },
    serviceabilityStatus: {
      type: String,
      enum: ['unknown', 'serviceable', 'not_serviceable'],
      default: 'unknown',
    },
    name: { type: String },
    address: { type: String },
    type: { type: String },
  },
  { timestamps: true }
);

AddressSchema.index({ userId: 1 });
AddressSchema.index({ location: '2dsphere' });

export const Address = mongoose.model<IAddress>('Address', AddressSchema);
export default Address;
