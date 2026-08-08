import mongoose, { Document, Schema } from 'mongoose';

export type FoodBusinessType = 'RESTAURANT' | 'STREET_FOOD' | 'CAFE_BAKERY_BEVERAGES' | 'SWEETS_DESSERTS';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BLOCKED';
export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
export type OperationalStatus = 'OPEN' | 'CLOSED' | 'TEMPORARILY_CLOSED' | 'BUSY';

export interface IRestaurantProfile extends Document {
  userId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  restaurantName: string;
  slug: string;
  businessType: FoodBusinessType;
  legalBusinessName: string;
  description: string;
  logo: string;
  coverImage: string;
  cuisines: string[];
  foodPreference: 'VEG' | 'NON_VEG' | 'BOTH' | 'VEGAN';
  phone: string;
  alternatePhone?: string;
  email: string;
  fssaiNumber: string;
  gstNumber?: string;
  panNumber?: string;
  address: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  averagePreparationMinutes: number;
  minimumOrderValue: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  diningEnabled: boolean;
  diningInfo?: {
    totalTables: number;
    seatingCapacity: number;
    tableTypes: Array<{ type: string; count: number; capacity: number }>;
    amenities: string[];
    openingTime: string;
    closingTime: string;
    slotDurationMinutes: number;
    advanceBookingDays: number;
    description: string;
    images: string[];
    videos: string[];
    bookingNotice?: string;
  };
  acceptingOrders: boolean;
  busyMode: boolean;
  busyModeExtraMinutes: number;
  operationalStatus: OperationalStatus;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  onboardingStep: number;
  isOnboardingCompleted: boolean;
  rating: {
    average: number;
    totalReviews: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RestaurantProfileSchema = new Schema<IRestaurantProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    restaurantName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    businessType: {
      type: String,
      enum: ['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'SWEETS_DESSERTS'],
      default: 'RESTAURANT',
      required: true,
    },
    legalBusinessName: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    cuisines: [{ type: String }],
    foodPreference: {
      type: String,
      enum: ['VEG', 'NON_VEG', 'BOTH', 'VEGAN'],
      default: 'BOTH',
    },
    phone: { type: String, required: true, trim: true },
    alternatePhone: { type: String, default: '' },
    email: { type: String, required: true, trim: true },
    fssaiNumber: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    panNumber: { type: String, default: '' },
    address: { type: String, required: true },
    locality: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    averagePreparationMinutes: { type: Number, default: 20 },
    minimumOrderValue: { type: Number, default: 100 },
    deliveryEnabled: { type: Boolean, default: true },
    pickupEnabled: { type: Boolean, default: true },
    diningEnabled: { type: Boolean, default: true },
    diningInfo: { type: Schema.Types.Mixed, default: {} },
    acceptingOrders: { type: Boolean, default: true },
    busyMode: { type: Boolean, default: false },
    busyModeExtraMinutes: { type: Number, default: 15 },
    operationalStatus: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'TEMPORARILY_CLOSED', 'BUSY'],
      default: 'OPEN',
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    accountStatus: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED', 'BLOCKED'],
      default: 'ACTIVE',
    },
    onboardingStep: { type: Number, default: 1 },
    isOnboardingCompleted: { type: Boolean, default: false },
    rating: {
      average: { type: Number, default: 5.0 },
      totalReviews: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

RestaurantProfileSchema.index({ location: '2dsphere' });
RestaurantProfileSchema.index({ slug: 1 });
RestaurantProfileSchema.index({ storeId: 1, vendorId: 1 });

export const RestaurantProfile = mongoose.model<IRestaurantProfile>('RestaurantProfile', RestaurantProfileSchema);
export default RestaurantProfile;
