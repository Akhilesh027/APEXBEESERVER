import mongoose, { Schema, Document } from 'mongoose';

export type DeliveryAssignmentStatus =
  | 'Created'
  | 'Assigned'
  | 'Accepted'
  | 'Reached Pickup'
  | 'Picked Up'
  | 'Out For Delivery'
  | 'Reached Customer'
  | 'OTP Verified'
  | 'Delivered'
  | 'Settlement Released'
  | 'Failed'
  | 'Reschedule'
  | 'Returned';

export interface IDeliveryAssignment extends Document {
  orderId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  partnerId?: mongoose.Types.ObjectId;
  franchiseId?: mongoose.Types.ObjectId;
  status: DeliveryAssignmentStatus;
  assignedAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  failedReason?: string;
  notes?: string;
  codCollection: {
    collected: number;
    expected: number;
    submitted: boolean;
    verified: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner', index: true },
    franchiseId: { type: Schema.Types.ObjectId, ref: 'Franchise', index: true },
    status: {
      type: String,
      enum: [
        'Created',
        'Assigned',
        'Accepted',
        'Reached Pickup',
        'Picked Up',
        'Out For Delivery',
        'Reached Customer',
        'OTP Verified',
        'Delivered',
        'Settlement Released',
        'Failed',
        'Reschedule',
        'Returned',
      ],
      default: 'Created',
      required: true,
    },
    assignedAt: { type: Date },
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    failedReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    codCollection: {
      collected: { type: Number, default: 0 },
      expected: { type: Number, default: 0 },
      submitted: { type: Boolean, default: false },
      verified: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export const DeliveryAssignment = mongoose.model<IDeliveryAssignment>('DeliveryAssignment', DeliveryAssignmentSchema);
