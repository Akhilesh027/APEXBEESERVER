import { IFoodMenuItem } from '../models/FoodMenuItem';
import { IFoodMenuCategory } from '../models/FoodMenuCategory';
import { IRestaurantProfile } from '../models/RestaurantProfile';
import { IRestaurantOperatingHours } from '../models/RestaurantOperatingHours';
import { IFoodVariant } from '../models/FoodVariant';

export interface AvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  isRestaurantOpen: boolean;
  isItemSoldOut: boolean;
  isCategoryActive: boolean;
  effectivePreparationTimeMinutes: number;
}

export class FoodAvailabilityService {
  /**
   * Helper to check if current HH:mm is within start and end time range
   */
  private static isTimeWithinSlot(currentTimeHHMM: string, startTimeHHMM: string, endTimeHHMM: string): boolean {
    if (!startTimeHHMM || !endTimeHHMM) return true;
    return currentTimeHHMM >= startTimeHHMM && currentTimeHHMM <= endTimeHHMM;
  }

  /**
   * Check if restaurant is currently open based on profile, settings, weekly hours, and overrides
   */
  public static isRestaurantOpen(
    profile: IRestaurantProfile,
    operatingHours?: IRestaurantOperatingHours | null,
    now: Date = new Date()
  ): { isOpen: boolean; reason?: string } {
    if (profile.accountStatus === 'BLOCKED' || profile.accountStatus === 'SUSPENDED') {
      return { isOpen: false, reason: `Account is ${profile.accountStatus}` };
    }

    if (profile.verificationStatus === 'REJECTED') {
      return { isOpen: false, reason: `Verification status is ${profile.verificationStatus}` };
    }

    if (!profile.acceptingOrders) {
      return { isOpen: false, reason: 'Restaurant is currently not accepting orders' };
    }

    if (profile.operationalStatus === 'CLOSED' || profile.operationalStatus === 'TEMPORARILY_CLOSED') {
      return { isOpen: false, reason: `Restaurant status is ${profile.operationalStatus}` };
    }

    if (!operatingHours) {
      return { isOpen: true };
    }

    // Check temporary overrides first
    const activeOverride = operatingHours.scheduleOverrides.find(
      (override) => now >= new Date(override.startDate) && now <= new Date(override.endDate)
    );

    if (activeOverride) {
      if (activeOverride.isClosed) {
        return { isOpen: false, reason: activeOverride.reason || 'Closed due to temporary schedule override' };
      }
    }

    // Check weekly schedule
    const days: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const currentDay = days[now.getDay()];
    const dayConfig = operatingHours.weeklyHours.find((d) => d.dayOfWeek === currentDay);

    if (!dayConfig || !dayConfig.enabled || dayConfig.slots.length === 0) {
      return { isOpen: false, reason: `Closed on ${currentDay}s` };
    }

    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const isSlotMatching = dayConfig.slots.some((slot) =>
      this.isTimeWithinSlot(currentTimeStr, slot.open, slot.close)
    );

    if (!isSlotMatching) {
      return { isOpen: false, reason: `Outside operating hours for ${currentDay}` };
    }

    return { isOpen: true };
  }

  /**
   * Calculate complete customer-facing item availability
   */
  public static calculateItemAvailability(
    item: IFoodMenuItem,
    category?: IFoodMenuCategory | null,
    profile?: IRestaurantProfile | null,
    operatingHours?: IRestaurantOperatingHours | null,
    variant?: IFoodVariant | null,
    now: Date = new Date()
  ): AvailabilityResult {
    const isItemSoldOut = Boolean(item.soldOut);

    let isRestaurantOpen = true;
    let restaurantOpenReason: string | undefined;

    if (profile) {
      const openCheck = this.isRestaurantOpen(profile, operatingHours, now);
      isRestaurantOpen = openCheck.isOpen;
      restaurantOpenReason = openCheck.reason;
    }

    let isCategoryActive = true;
    if (category) {
      if (!category.isActive) {
        isCategoryActive = false;
      } else if (category.availabilitySchedule?.enabled) {
        const days: string[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDay = days[now.getDay()];
        const sched = category.availabilitySchedule;

        if (sched.daysOfWeek && sched.daysOfWeek.length > 0 && !sched.daysOfWeek.includes(currentDay)) {
          isCategoryActive = false;
        }

        if (sched.startTime && sched.endTime) {
          const currentHours = String(now.getHours()).padStart(2, '0');
          const currentMinutes = String(now.getMinutes()).padStart(2, '0');
          const currentTimeStr = `${currentHours}:${currentMinutes}`;
          if (!this.isTimeWithinSlot(currentTimeStr, sched.startTime, sched.endTime)) {
            isCategoryActive = false;
          }
        }
      }
    }

    let isItemAvailable = true;
    let reason: string | undefined;

    if (item.status !== 'ACTIVE') {
      isItemAvailable = false;
      reason = `Item status is ${item.status}`;
    } else if (isItemSoldOut) {
      isItemAvailable = false;
      reason = 'Item is marked SOLD OUT';
    } else if (!isCategoryActive) {
      isItemAvailable = false;
      reason = 'Category is inactive or outside availability schedule';
    } else if (!isRestaurantOpen) {
      isItemAvailable = false;
      reason = restaurantOpenReason || 'Restaurant is currently closed';
    } else if (variant && (!variant.available || !variant.isActive)) {
      isItemAvailable = false;
      reason = 'Selected variant is currently unavailable';
    } else if (item.availabilitySchedule?.enabled) {
      const days: string[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = days[now.getDay()];
      const sched = item.availabilitySchedule;

      if (sched.daysOfWeek && sched.daysOfWeek.length > 0 && !sched.daysOfWeek.includes(currentDay)) {
        isItemAvailable = false;
        reason = `Item not available on ${currentDay}s`;
      } else if (sched.startTime && sched.endTime) {
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTimeStr = `${currentHours}:${currentMinutes}`;
        if (!this.isTimeWithinSlot(currentTimeStr, sched.startTime, sched.endTime)) {
          isItemAvailable = false;
          reason = 'Outside item availability hours';
        }
      }
    }

    // Effective Prep Time (including Busy Mode extra time)
    let effectivePrep = item.preparationTimeMinutes || profile?.averagePreparationMinutes || 20;
    if (profile?.busyMode) {
      effectivePrep += profile.busyModeExtraMinutes || 15;
    }

    return {
      isAvailable: isItemAvailable,
      reason,
      isRestaurantOpen,
      isItemSoldOut,
      isCategoryActive,
      effectivePreparationTimeMinutes: effectivePrep,
    };
  }
}

export default FoodAvailabilityService;
