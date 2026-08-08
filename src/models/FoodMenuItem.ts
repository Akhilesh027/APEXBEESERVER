import mongoose, { Document, Schema } from 'mongoose';

export type FoodType = 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
export type ItemStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type ItemApprovalStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'PENDING_RESTAURANT_ACCEPTANCE'
  | 'PUBLISHED_LIVE'
  | 'REJECTED_BY_ADMIN'
  | 'REJECTED_BY_RESTAURANT';

export interface IFoodMenuItem extends Document {
  restaurantId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  foodType: FoodType;
  cuisine?: string;
  image?: string;
  imageUrl?: string;
  basePrice: number;
  offerPrice?: number;
  taxRatePercent: number;
  packagingCharge?: number;
  preparationTimeMinutes: number;
  isBestseller: boolean;
  isRecommended: boolean;
  isSpicy: boolean;
  isCustomisable: boolean;
  status: ItemStatus;
  approvalStatus: ItemApprovalStatus;
  platformCommissionPercent: number;
  vendorPayoutAmount?: number;
  platformShareAmount?: number;
  adminPricingNotes?: string;
  adminApprovedAt?: Date;
  restaurantAcceptedAt?: Date;
  soldOut: boolean;
  availabilitySchedule?: {
    enabled: boolean;
    startTime?: string; // e.g. "06:00"
    endTime?: string;   // e.g. "11:00"
    daysOfWeek?: string[];
  };
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const FoodMenuItemSchema = new Schema<IFoodMenuItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'FoodMenuCategory', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    foodType: {
      type: String,
      enum: ['VEG', 'NON_VEG', 'EGG', 'VEGAN'],
      default: 'VEG',
      required: true,
    },
    cuisine: { type: String, default: '' },
    image: { type: String, default: '' },
    basePrice: { type: Number, required: true, min: 0 },
    offerPrice: { type: Number, default: 0 },
    taxRatePercent: { type: Number, default: 5 }, // 5% GST standard for food
    packagingCharge: { type: Number, default: 0 },
    preparationTimeMinutes: { type: Number, default: 20 },
    isBestseller: { type: Boolean, default: false },
    isRecommended: { type: Boolean, default: false },
    isSpicy: { type: Boolean, default: false },
    isCustomisable: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'INACTIVE',
    },
    approvalStatus: {
      type: String,
      enum: [
        'PENDING_ADMIN_REVIEW',
        'PENDING_RESTAURANT_ACCEPTANCE',
        'PUBLISHED_LIVE',
        'REJECTED_BY_ADMIN',
        'REJECTED_BY_RESTAURANT',
      ],
      default: 'PENDING_ADMIN_REVIEW',
    },
    platformCommissionPercent: { type: Number, default: 12 },
    vendorPayoutAmount: { type: Number, default: 0 },
    platformShareAmount: { type: Number, default: 0 },
    adminPricingNotes: { type: String, default: '' },
    adminApprovedAt: { type: Date },
    restaurantAcceptedAt: { type: Date },
    soldOut: { type: Boolean, default: false },
    availabilitySchedule: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: '' },
      endTime: { type: String, default: '' },
      daysOfWeek: [{ type: String }],
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

FoodMenuItemSchema.index({ restaurantId: 1, categoryId: 1, status: 1 });
FoodMenuItemSchema.index({ restaurantId: 1, name: 1 });

export const FoodMenuItem = mongoose.model<IFoodMenuItem>('FoodMenuItem', FoodMenuItemSchema);
export default FoodMenuItem;
