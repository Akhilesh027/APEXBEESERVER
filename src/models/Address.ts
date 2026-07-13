import mongoose, { Document, Schema } from 'mongoose';

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  type: 'home' | 'work' | 'other';
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });


export const Address = mongoose.model<IAddress>('Address', AddressSchema);

