import mongoose, { Schema, Document } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface IOrderTimeline {
  status: string;
  date: string;
  note?: string;
  performedBy?: mongoose.Types.ObjectId;
  performedByRole?: string;
  isAdminOverride?: boolean;
}

export interface IOrder extends Document {
  orderNumber: string;
  customerId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Refunded' | 'Approved' | 'Rejected';
  orderStatus: 'Placed' | 'Confirmed' | 'Packed' | 'Ready' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Completed' | 'Returned' | 'Payment Verified' | 'Payment Rejected' | 'Cancelled';
  paymentVerificationStatus?: 'Not Required' | 'Pending Verification' | 'Verified' | 'Rejected';
  deliveryType?: 'Platform' | 'Vendor' | 'Independent';
  deliveryAgentId?: string;
  customerNotes?: string;
  returnReason?: string;
  refundStatus?: 'Pending' | 'Approved' | 'Rejected' | 'None';
  commissionReleaseStatus?: 'Pending' | 'Released';
  commissionReleasedAt?: Date | null;
  timeline: IOrderTimeline[];
  createdAt: Date;
  updatedAt: Date;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  orderItems?: any[];
  shippingAddress?: any;
  paymentDetails?: any;
  orderSummary?: any;
  preOrder?: any;
  isScheduledSubscription?: boolean;
  scheduleDetails?: any;
  orderStatusObj?: any;
  deliveryVerification?: {
    otp: string;
    otpExpires: Date;
    verified: boolean;
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
    verificationMethod: 'OTP' | 'QR' | 'Signature' | 'None';
  };
  pickupVerification?: {
    otp: string;
    verified: boolean;
    verifiedAt?: Date;
  };
  priority?: 'Normal' | 'Express' | 'Scheduled';
  internalNotes?: string;
  packingChecklist?: string[];
  deliverySlot?: string;
  trackingId?: string;
  courierPartner?: string;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  sku: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  price: { type: Number, required: true }
});

const OrderTimelineSchema = new Schema<IOrderTimeline>({
  status: { type: String, required: true },
  date: { type: String, required: true },
  note: { type: String, default: "" },
  performedBy: { type: Schema.Types.ObjectId, ref: "User" },
  performedByRole: { type: String },
  isAdminOverride: { type: Boolean, default: false }
});

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [OrderItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'Refunded', 'Approved', 'Rejected'],
      default: 'Pending'
    },
    orderStatus: {
      type: String,
      enum: ['Placed', 'Confirmed', 'Packed', 'Ready', 'Shipped', 'Out for Delivery', 'Delivered', 'Completed', 'Returned', 'Payment Verified', 'Payment Rejected', 'Cancelled'],
      default: 'Placed'
    },
    paymentVerificationStatus: {
      type: String,
      enum: ['Not Required', 'Pending Verification', 'Verified', 'Rejected'],
      default: 'Not Required'
    },
    deliveryType: { type: String },
    deliveryAgentId: { type: String },
    customerNotes: { type: String, default: "" },
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    returnReason: { type: String, default: "" },
    refundStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'None'],
      default: 'None'
    },
    commissionReleaseStatus: {
      type: String,
      enum: ['Pending', 'Released'],
      default: 'Pending'
    },
    commissionReleasedAt: {
      type: Date,
      default: null
    },
    timeline: { type: [OrderTimelineSchema], default: [] },
    // E-commerce integration fields
    orderItems: { type: [Schema.Types.Mixed], default: [] },
    shippingAddress: { type: Schema.Types.Mixed, default: null },
    paymentDetails: { type: Schema.Types.Mixed, default: null },
    orderSummary: { type: Schema.Types.Mixed, default: null },
    preOrder: { type: Schema.Types.Mixed, default: null },
    isScheduledSubscription: { type: Boolean, default: false },
    scheduleDetails: { type: Schema.Types.Mixed, default: null },
    orderStatusObj: { type: Schema.Types.Mixed, default: null },
    deliveryVerification: {
      otp: { type: String },
      otpExpires: { type: Date },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner' },
      verificationMethod: { type: String, enum: ['OTP', 'QR', 'Signature', 'None'], default: 'None' }
    },
    pickupVerification: {
      otp: { type: String },
      verified: { type: Boolean, default: false },
      verifiedAt: { type: Date }
    },
    priority: {
      type: String,
      enum: ['Normal', 'Express', 'Scheduled'],
      default: 'Normal'
    },
    internalNotes: {
      type: String,
      default: ""
    },
    packingChecklist: {
      type: [String],
      default: []
    },
    deliverySlot: {
      type: String,
      default: ""
    },
    trackingId: {
      type: String,
      default: ""
    },
    courierPartner: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

OrderSchema.index({ sellerId: 1, createdAt: -1 });
OrderSchema.index({ customerId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });
OrderSchema.index({ 'shippingAddress.state': 1, 'shippingAddress.district': 1, 'shippingAddress.mandal': 1 });

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
