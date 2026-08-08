import mongoose, { Document, Schema } from 'mongoose';

export interface IRestaurantSettings extends Document {
  restaurantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  defaultPreparationMinutes: number;
  acceptingOrders: boolean;
  autoAcceptOrders: boolean;
  codEnabled: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  minimumOrderValue: number;
  packagingChargeMode: 'PER_ITEM' | 'PER_ORDER' | 'NONE';
  defaultPackagingCharge: number;
  busyModeExtraMinutes: number;
  maxConcurrentOrders: number;
  pauseOrdersWhenCapacityReached: boolean;
  scheduledOrdersEnabled: boolean;
  timezone: string;
  orderNotificationSound: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantSettingsSchema = new Schema<IRestaurantSettings>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, unique: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    defaultPreparationMinutes: { type: Number, default: 20 },
    acceptingOrders: { type: Boolean, default: true },
    autoAcceptOrders: { type: Boolean, default: false },
    codEnabled: { type: Boolean, default: true },
    pickupEnabled: { type: Boolean, default: true },
    deliveryEnabled: { type: Boolean, default: true },
    minimumOrderValue: { type: Number, default: 100 },
    packagingChargeMode: {
      type: String,
      enum: ['PER_ITEM', 'PER_ORDER', 'NONE'],
      default: 'PER_ORDER',
    },
    defaultPackagingCharge: { type: Number, default: 15 },
    busyModeExtraMinutes: { type: Number, default: 15 },
    maxConcurrentOrders: { type: Number, default: 50 },
    pauseOrdersWhenCapacityReached: { type: Boolean, default: false },
    scheduledOrdersEnabled: { type: Boolean, default: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    orderNotificationSound: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RestaurantSettings = mongoose.model<IRestaurantSettings>('RestaurantSettings', RestaurantSettingsSchema);
export default RestaurantSettings;
