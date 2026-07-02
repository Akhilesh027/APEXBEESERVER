import mongoose, { Schema, Document } from 'mongoose';

export interface IDeliveryLeave extends Document {
  partnerId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryLeaveSchema = new Schema<IDeliveryLeave>({
  partnerId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending', required: true }
}, { timestamps: true });

export const DeliveryLeave = mongoose.model<IDeliveryLeave>('DeliveryLeave', DeliveryLeaveSchema);
