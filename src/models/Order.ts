import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  itemTotal?: number;
  image?: string;
  color?: string;
  size?: string;
  variantId?: string;
  variantName?: string;
  selectedVariant?: any;
  selectedAttributes?: any;
  attributes?: any;
  vendorId?: mongoose.Types.ObjectId | string;
  categoryId?: mongoose.Types.ObjectId | string;
  categoryName?: string;
  waterDetails?: {volumeLitres:number;returnable:boolean;depositAmount:number;workspaceId:mongoose.Types.ObjectId};
  isPreOrder?: boolean;
  preOrderReleaseDate?: Date | null;
  preOrderDeliveryDate?: Date | null;
  preOrderTimeSlot?: string;
  preOrderCustomNote?: string;
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
  | 'ready'
  | 'served'
  | 'Served'
  | 'completed'
  | 'Failed to Deliver'
  | 'failed_to_deliver'
  | 'Failed'
  | 'failed'
  | 'Cancelled';

export interface IOrder extends Document {
  orderNumber: string;
  customerId?: mongoose.Types.ObjectId;
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
  businessInquiryId?: mongoose.Types.ObjectId;
  procurementPurchaseOrderId?: mongoose.Types.ObjectId;
  deliveryVerification?: any;
  courierPartner?: string;
  trackingId?: string;
  pickupVerification?: any;
  fulfillment?: any;
  deliveryDetails?: any;
  isSelfPickup?: boolean;
  isVendorSelfDelivery?: boolean;
  isSelfDelivery?: boolean;
  categoryId?: mongoose.Types.ObjectId | string;
  categoryName?: string;
  orderType?: string;
  tableNumber?: string;
  estimatedDeliveryMinutes?: number;
  acceptedAt?: Date | null;
  estimatedDeliveryTime?: Date | null;
  prepStatus?: string;
  paymentMethod?: string;
  paymentDetails?: any;
  referralCode?: string;
  productSharerId?: mongoose.Types.ObjectId;
  isPreOrder?: boolean;
  preOrderReleaseDate?: Date | null;
  preOrderDeliveryDate?: Date | null;
  preOrderTimeSlot?: string;
  preOrderCustomNote?: string;
  slotExtended?: boolean;
  slotExtendedUntil?: Date | null;
  slotExtensionReason?: string;
  slotExtensionHistory?: Array<{
    extendedAt: Date;
    extendedUntil: Date;
    reason: string;
    extendedBy?: string;
  }>;
  slotMissed?: boolean;
  isInventoryCommitted?: boolean;
  inventoryCommittedAt?: Date | null;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: false },
    productName: { type: String, required: true },
    sku: { type: String, default: 'N/A' },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: 0 },
    itemTotal: { type: Number, default: 0 },
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    size: { type: String, default: '' },
    variantId: { type: String, default: '' },
    variantName: { type: String, default: '' },
    selectedVariant: { type: Schema.Types.Mixed, default: undefined },
    selectedAttributes: { type: Schema.Types.Mixed, default: undefined },
    attributes: { type: Schema.Types.Mixed, default: undefined },
    vendorId: { type: Schema.Types.Mixed },
    categoryId: { type: Schema.Types.Mixed },
    categoryName: { type: String, default: '' },
    waterDetails: {type: new Schema({volumeLitres:Number,returnable:Boolean,depositAmount:Number,workspaceId:Schema.Types.ObjectId},{_id:false}),default:undefined},
    isPreOrder: { type: Boolean, default: false },
    preOrderReleaseDate: { type: Date, default: null },
    preOrderDeliveryDate: { type: Date, default: null },
    preOrderTimeSlot: { type: String, default: '' },
    preOrderCustomNote: { type: String, default: '' },
  },
  { _id: true, strict: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    businessInquiryId: { type: Schema.Types.ObjectId, ref: 'BusinessInquiry', unique: true, sparse: true },
    procurementPurchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', unique: true, sparse: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
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
        'Accepted',
        'assigned',
        'Assigned',
        'Confirmed',
        'Packed',
        'Ready',
        'Shipped',
        'Reached Vendor',
        'Pickup OTP Verified',
        'Picked Up',
        'Out for Delivery',
        'Reached Customer',
        'Delivery OTP Verified',
        'Delivered',
        'Completed',
        'Returned',
        'Payment Verified',
        'Payment Rejected',
        'ready',
        'served',
        'Served',
        'completed',
        'Failed to Deliver',
        'failed_to_deliver',
        'Failed',
        'failed',
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
      enum: ['Platform', 'Vendor', 'Independent', 'self_delivery', 'store_delivery', 'pickup', 'delivery'],
    },
    isVendorSelfDelivery: { type: Boolean, default: false },
    isSelfDelivery: { type: Boolean, default: false },
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
    fulfillment: { type: Schema.Types.Mixed },
    deliveryDetails: { type: Schema.Types.Mixed },
    isSelfPickup: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.Mixed },
    categoryName: { type: String, default: '' },
    orderType: { type: String, default: 'RETAIL' },
    tableNumber: { type: String, default: '' },
    estimatedDeliveryMinutes: { type: Number, default: 20 },
    acceptedAt: { type: Date, default: null },
    estimatedDeliveryTime: { type: Date, default: null },
    prepStatus: { type: String, default: 'pending' },
    paymentMethod: { type: String, default: 'cod' },
    paymentDetails: { type: Schema.Types.Mixed },
    referralCode: { type: String, default: null, trim: true },
    productSharerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isPreOrder: { type: Boolean, default: false },
    preOrderReleaseDate: { type: Date, default: null },
    preOrderDeliveryDate: { type: Date, default: null },
    preOrderTimeSlot: { type: String, default: '' },
    preOrderCustomNote: { type: String, default: '' },
    slotExtended: { type: Boolean, default: false },
    slotExtendedUntil: { type: Date, default: null },
    slotExtensionReason: { type: String, default: '' },
    slotExtensionHistory: [
      {
        extendedAt: { type: Date, default: Date.now },
        extendedUntil: { type: Date, required: true },
        reason: { type: String, default: '' },
        extendedBy: { type: String, default: '' }
      }
    ],
    slotMissed: { type: Boolean, default: false },
    isInventoryCommitted: { type: Boolean, default: false },
    inventoryCommittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ customerId: 1 });
OrderSchema.index({ sellerId: 1 });
OrderSchema.index({ orderStatus: 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
