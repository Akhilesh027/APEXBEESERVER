import mongoose, { Document, Schema } from 'mongoose';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILLING' | 'RESERVED';

export interface ITableQR extends Document {
  restaurantId: mongoose.Types.ObjectId;
  tableNumber: string;
  section: string;
  capacity: number;
  label: string;
  qrToken: string;
  menuMode: 'ALL_ITEMS' | 'CUSTOM_SELECTION';
  selectedItemIds: mongoose.Types.ObjectId[];
  discountPercent: number;
  specialNote?: string;
  status: TableStatus;
  isActive: boolean;
  scanCount: number;
  lastScannedAt?: Date;
  activeOrder?: {
    orderNumber: string;
    itemsCount: number;
    amount: number;
    seatedAt: string;
    waiter: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TableQRSchema = new Schema<ITableQR>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    tableNumber: { type: String, required: true, uppercase: true, trim: true },
    section: { type: String, default: 'Main Dining Hall', trim: true },
    capacity: { type: Number, default: 4, min: 1 },
    label: { type: String, required: true, trim: true },
    qrToken: { type: String, required: true, unique: true, index: true },
    menuMode: { type: String, enum: ['ALL_ITEMS', 'CUSTOM_SELECTION'], default: 'ALL_ITEMS' },
    selectedItemIds: [{ type: Schema.Types.ObjectId, ref: 'FoodMenuItem' }],
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    specialNote: { type: String, default: '' },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'BILLING', 'RESERVED'],
      default: 'AVAILABLE',
      index: true,
    },
    isActive: { type: Boolean, default: true },
    scanCount: { type: Number, default: 0 },
    lastScannedAt: { type: Date },
    activeOrder: {
      orderNumber: { type: String },
      itemsCount: { type: Number },
      amount: { type: Number },
      seatedAt: { type: String },
      waiter: { type: String },
    },
  },
  { timestamps: true }
);

TableQRSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

export const TableQR = mongoose.model<ITableQR>('TableQR', TableQRSchema);
export default TableQR;
