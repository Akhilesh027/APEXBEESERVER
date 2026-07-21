import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
}

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
  | 'refunded'
  | 'Placed'
  | 'Confirmed'
  | 'Packed'
  | 'Ready'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Completed'
  | 'Returned'
  | 'Payment Verified'
  | 'Payment Rejected'
  | 'Cancelled';

export interface IOrder extends Document {
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Approved' | 'Rejected';
  orderStatus: OrderStatus;
  paymentVerificationStatus?: 'Not Required' | 'Pending Verification' | 'Verified' | 'Rejected';
  deliveryType?: 'Platform' | 'Vendor' | 'Independent';
  deliveryAgentId?: string;
  customerNotes?: string;
  returnReason?: string;
  refundStatus?: 'Pending' | 'Approved' | 'Rejected' | 'None';
  commissionReleaseStatus?: 'Pending' | 'Released';
  commissionReleasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  checkoutIdempotencyKey?: string;
  timeline: any[];
  orderStatusObj?: any;
  shippingAddress?: any;
  priority?: string;
  deliverySlot?: string;
  internalNotes?: string;
  packingChecklist: string[];
  orderSummary?: any;
  checkoutRequestHash?: string;
  deliveryVerification?: any;
  courierPartner?: string;
  trackingId?: string;
  pickupVerification?: any;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true },
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Approved', 'Rejected'],
      default: 'Pending',
    },
    orderStatus: {
      type: String,
      enum: [
        'pending_payment',
        'placed',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'picked_up',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'return_requested',
        'returned',
        'refund_pending',
        'refunded',
        'Placed',
        'Confirmed',
        'Packed',
        'Ready',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Completed',
        'Returned',
        'Payment Verified',
        'Payment Rejected',
        'Cancelled',
      ],
      default: 'placed',
      required: true,
    },
    paymentVerificationStatus: {
      type: String,
      enum: ['Not Required', 'Pending Verification', 'Verified', 'Rejected'],
      default: 'Not Required',
    },
    deliveryType: {
      type: String,
      enum: ['Platform', 'Vendor', 'Independent'],
    },
    deliveryAgentId: { type: String },
    customerNotes: { type: String, default: '' },
    returnReason: { type: String },
    refundStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'None'],
      default: 'None',
    },
    commissionReleaseStatus: {
      type: String,
      enum: ['Pending', 'Released'],
      default: 'Pending',
    },
    commissionReleasedAt: { type: Date, default: null },
    customerName: { type: String },
    customerPhone: { type: String },
    deliveryAddress: { type: String },
    checkoutIdempotencyKey: { type: String, index: true },
    timeline: [Schema.Types.Mixed],
    orderStatusObj: { type: Schema.Types.Mixed },
    shippingAddress: { type: Schema.Types.Mixed },
    priority: { type: String, default: 'Normal' },
    deliverySlot: { type: String },
    internalNotes: { type: String },
    packingChecklist: [{ type: String }],
    orderSummary: { type: Schema.Types.Mixed },
    checkoutRequestHash: { type: String, index: true },
    deliveryVerification: { type: Schema.Types.Mixed },
    courierPartner: { type: String },
    trackingId: { type: String },
    pickupVerification: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ sellerId: 1 });
OrderSchema.index({ orderStatus: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
