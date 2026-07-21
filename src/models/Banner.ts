import mongoose, { Schema, Document } from "mongoose";

export interface IBanner extends Document {
  title: string;
  description: string;
  imageUrl: string;
  type: 'morning' | 'afternoon' | 'evening' | 'night' | 'festival' | 'promo';
  isActive: boolean;
  discount: string;
  link: string;
  countdownHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    type: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night', 'festival', 'promo'],
      default: 'promo'
    },
    isActive: { type: Boolean, default: true },
    discount: { type: String, default: "" },
    link: { type: String, default: "" },
    countdownHours: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>("Banner", BannerSchema);
