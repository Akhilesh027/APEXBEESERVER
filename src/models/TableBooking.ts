import mongoose, { Schema, Document } from 'mongoose';

export interface ITableBooking extends Document {
  vendorId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  guestName: string;
  guestPhone: string;
  bookingDate: Date;
  timeSlot: string;
  guestCount: number;
  specialRequests?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const TableBookingSchema = new Schema<ITableBooking>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    guestName: { type: String, required: true },
    guestPhone: { type: String, required: true },
    bookingDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    guestCount: { type: Number, required: true, default: 2 },
    specialRequests: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

TableBookingSchema.index({ vendorId: 1, bookingDate: 1 });
TableBookingSchema.index({ guestPhone: 1 });

export const TableBooking = mongoose.model<ITableBooking>('TableBooking', TableBookingSchema);
export default TableBooking;
