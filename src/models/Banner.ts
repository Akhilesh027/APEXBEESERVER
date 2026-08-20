import mongoose, { Schema, Document } from "mongoose";

export interface IBanner extends Document {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  mobileImageUrl?: string;
  placement:
    | 'home_hero'
    | 'time_of_day'
    | 'home_strip'
    | 'food_hero'
    | 'services_hero'
    | 'stores_hero'
    | 'category_hero'
    | 'cart_strip'
    | 'popup_modal'
    | 'custom';
  size: 'big' | 'medium' | 'small' | 'strip' | 'popup';
  targetCategory?: string;
  type?: 'morning' | 'afternoon' | 'evening' | 'night' | 'festival' | 'promo';
  timeOfDaySlot?: 'all' | 'morning' | 'afternoon' | 'evening' | 'night' | 'festival';
  tag?: string;
  discount?: string;
  couponCode?: string;
  buttonText?: string;
  link: string;
  order: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  countdownHours?: number;
  targetDevice?: 'all' | 'mobile' | 'desktop';
  targetPincodes?: string[];
  clicks: number;
  impressions: number;
  bgGradient?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    imageUrl: { type: String, required: true },
    mobileImageUrl: { type: String, default: "" },
    placement: {
      type: String,
      enum: [
        'home_hero',
        'time_of_day',
        'home_strip',
        'food_hero',
        'services_hero',
        'stores_hero',
        'category_hero',
        'cart_strip',
        'popup_modal',
        'custom'
      ],
      default: 'home_hero',
      index: true
    },
    size: {
      type: String,
      enum: ['big', 'medium', 'small', 'strip', 'popup'],
      default: 'big'
    },
    targetCategory: { type: String, default: "all", index: true },
    type: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'festival', 'promo'],
      default: 'promo'
    },
    timeOfDaySlot: {
      type: String,
      enum: ['all', 'morning', 'afternoon', 'evening', 'night', 'festival'],
      default: 'all'
    },
    tag: { type: String, default: "" },
    discount: { type: String, default: "" },
    couponCode: { type: String, default: "" },
    buttonText: { type: String, default: "Explore Now" },
    link: { type: String, default: "/" },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    countdownHours: { type: Number, default: 0 },
    targetDevice: {
      type: String,
      enum: ['all', 'mobile', 'desktop'],
      default: 'all'
    },
    targetPincodes: [{ type: String }],
    clicks: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    bgGradient: { type: String, default: "from-amber-600 via-orange-600 to-rose-700" }
  },
  { timestamps: true }
);

// Helpful index for fast frontend retrieval
BannerSchema.index({ placement: 1, isActive: 1, order: 1, createdAt: -1 });

export const Banner = mongoose.model<IBanner>("Banner", BannerSchema);
