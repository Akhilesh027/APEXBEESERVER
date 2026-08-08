import mongoose, { Document, Schema } from 'mongoose';

export type DiningBookingStatus = 'PENDING' | 'CONFIRMED' | 'SEATED' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';

export interface ITableBooking extends Document {
  restaurantId: mongoose.Types.ObjectId;
  bookingNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // e.g. "07:30 PM"
  tableType: string;
  occasion?: string;
  specialRequests?: string;
  status: DiningBookingStatus;
  tableNumber?: string;
  rejectionReason?: string;
  depositAmount?: number;
  depositStatus?: 'PENDING' | 'PAID' | 'REFUNDED';
  createdAt: Date;
  updatedAt: Date;
}

const TableBookingSchema = new Schema<ITableBooking>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    bookingNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    customerEmail: { type: String, default: '' },
    guestCount: { type: Number, required: true, min: 1, default: 2 },
    bookingDate: { type: String, required: true, index: true },
    bookingTime: { type: String, required: true },
    tableType: { type: String, default: 'Standard Table' },
    occasion: { type: String, default: 'Casual Dining' },
    specialRequests: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    tableNumber: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    depositAmount: { type: Number, default: 0 },
    depositStatus: { type: String, enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PAID' }
  },
  { timestamps: true }
);

TableBookingSchema.index({ restaurantId: 1, bookingDate: 1 });
TableBookingSchema.index({ restaurantId: 1, status: 1 });

export const TableBooking = mongoose.model<ITableBooking>('TableBooking', TableBookingSchema);
export default TableBooking;
