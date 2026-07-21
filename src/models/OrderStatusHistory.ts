import mongoose, { Document, Schema } from 'mongoose';

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned'
  | 'refund_pending'
  | 'refunded';

export type ActorType = 'system' | 'customer' | 'store' | 'delivery' | 'admin';

export interface IOrderStatusHistory extends Document {
  orderId: mongoose.Types.ObjectId;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  changedBy: mongoose.Types.ObjectId;
  actorType: ActorType;
  note?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
}

const OrderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    fromStatus: { type: String },
    toStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorType: { type: String, enum: ['system', 'customer', 'store', 'delivery', 'admin'], required: true },
    note: { type: String },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OrderStatusHistorySchema.index({ orderId: 1 });

export const OrderStatusHistory = mongoose.model<IOrderStatusHistory>('OrderStatusHistory', OrderStatusHistorySchema);
export default OrderStatusHistory;
