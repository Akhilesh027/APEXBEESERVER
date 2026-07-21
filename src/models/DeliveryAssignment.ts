import mongoose, { Document, Schema } from 'mongoose';

export type DeliveryAssignmentStatus =
  | 'pending'
  | 'accepted'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'Assigned'
  | 'Failed'
  | 'Completed'
  | 'Pending'
  | 'Accepted'
  | 'Reached Pickup'
  | 'Picked Up'
  | 'Out For Delivery'
  | 'Reached Customer'
  | 'Reschedule'
  | 'Returned';

export interface IDeliveryAssignment extends Document {
  orderId: mongoose.Types.ObjectId;
  deliveryPartnerId: mongoose.Types.ObjectId;
  partnerSnapshot: {
    name: string;
    phoneMasked: string;
    photoUrl?: string;
  };
  assignedAt: Date;
  acceptedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
  deliveryOtpHash?: string;
  otpExpiresAt?: Date;
  currentLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  estimatedArrivalTime?: Date;
  partnerId?: mongoose.Types.ObjectId;
  status?: string;
  failedReason?: string;
  codCollection?: { expected: number; collected: number; };
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryAssignmentSchema = new Schema<IDeliveryAssignment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    deliveryPartnerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    partnerSnapshot: {
      name: { type: String, required: true },
      phoneMasked: { type: String, required: true },
      photoUrl: { type: String },
    },
    assignedAt: { type: Date, required: true, default: Date.now },
    acceptedAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    deliveryOtpHash: { type: String },
    otpExpiresAt: { type: Date },
    currentLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
    estimatedArrivalTime: { type: Date },
    partnerId: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'Pending' },
    failedReason: { type: String },
    codCollection: {
      expected: { type: Number, default: 0 },
      collected: { type: Number, default: 0 },
    },
    notes: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

DeliveryAssignmentSchema.index({ orderId: 1 });
DeliveryAssignmentSchema.index({ deliveryPartnerId: 1 });
if (DeliveryAssignmentSchema.index) {
  DeliveryAssignmentSchema.index({ currentLocation: '2dsphere' });
}

export const DeliveryAssignment = mongoose.model<IDeliveryAssignment>('DeliveryAssignment', DeliveryAssignmentSchema);
export default DeliveryAssignment;
