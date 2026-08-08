import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeSlot {
  open: string;  // e.g. "07:00"
  close: string; // e.g. "11:00"
}

export interface IDayOperatingHours {
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  enabled: boolean;
  slots: ITimeSlot[];
}

export interface ITemporaryScheduleOverride {
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  reason?: string;
}

export interface IRestaurantOperatingHours extends Document {
  restaurantId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  weeklyHours: IDayOperatingHours[];
  scheduleOverrides: ITemporaryScheduleOverride[];
  createdAt: Date;
  updatedAt: Date;
}

const TimeSlotSchema = new Schema<ITimeSlot>(
  {
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false }
);

const DayOperatingHoursSchema = new Schema<IDayOperatingHours>(
  {
    dayOfWeek: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true,
    },
    enabled: { type: Boolean, default: true },
    slots: { type: [TimeSlotSchema], default: [{ open: '09:00', close: '22:00' }] },
  },
  { _id: false }
);

const TemporaryScheduleOverrideSchema = new Schema<ITemporaryScheduleOverride>(
  {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isClosed: { type: Boolean, default: true },
    reason: { type: String, default: '' },
  },
  { _id: false }
);

const RestaurantOperatingHoursSchema = new Schema<IRestaurantOperatingHours>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, unique: true, index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    weeklyHours: {
      type: [DayOperatingHoursSchema],
      default: [
        { dayOfWeek: 'monday', enabled: true, slots: [{ open: '09:00', close: '22:00' }] },
        { dayOfWeek: 'tuesday', enabled: true, slots: [{ open: '09:00', close: '22:00' }] },
        { dayOfWeek: 'wednesday', enabled: true, slots: [{ open: '09:00', close: '22:00' }] },
        { dayOfWeek: 'thursday', enabled: true, slots: [{ open: '09:00', close: '22:00' }] },
        { dayOfWeek: 'friday', enabled: true, slots: [{ open: '09:00', close: '22:00' }] },
        { dayOfWeek: 'saturday', enabled: true, slots: [{ open: '09:00', close: '23:00' }] },
        { dayOfWeek: 'sunday', enabled: true, slots: [{ open: '09:00', close: '23:00' }] },
      ],
    },
    scheduleOverrides: { type: [TemporaryScheduleOverrideSchema], default: [] },
  },
  { timestamps: true }
);

export const RestaurantOperatingHours = mongoose.model<IRestaurantOperatingHours>(
  'RestaurantOperatingHours',
  RestaurantOperatingHoursSchema
);
export default RestaurantOperatingHours;
