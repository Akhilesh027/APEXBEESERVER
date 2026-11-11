import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import { RestaurantProfile } from '../models/RestaurantProfile';
import { RestaurantSettings } from '../models/RestaurantSettings';
import { RestaurantOperatingHours } from '../models/RestaurantOperatingHours';
import { BusinessApplication } from '../models/BusinessApplication';
import { getRedisClient } from '../config/redis';
import { FoodPartnerAuthRequest } from '../middleware/foodPartnerAuthMiddleware';
import { SmsService } from '../services/smsService';
import { EmailService } from '../services/emailService';

const generateFoodToken = (id: string, email: string, roles: string[]): string => {
  return jwt.sign(
    { id, email, roles, panelType: 'FOOD_PARTNER' },
    process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork',
    { expiresIn: '30d' }
  );
};

export const sendFoodPartnerOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email } = req.body;
    const rawKey = (phone || email || '').toString().trim();
    if (!rawKey) {
      res.status(400).json({ success: false, message: 'Phone or email is required' });
      return;
    }

    const cleanEmail = rawKey.toLowerCase();
    const cleanDigits = rawKey.replace(/\D/g, '').slice(-10);

    // Build user lookup query (handles email, full phone, and 10-digit phone)
    const userOrConditions: any[] = [];
    if (rawKey.includes('@')) {
      userOrConditions.push({ email: cleanEmail });
    } else {
      userOrConditions.push({ phone: rawKey }, { mobile: rawKey });
      if (cleanDigits && cleanDigits.length === 10) {
        userOrConditions.push(
          { phone: cleanDigits },
          { mobile: cleanDigits },
          { phone: `+91${cleanDigits}` },
          { mobile: `+91${cleanDigits}` }
        );
      }
    }

    let user: any = await User.findOne({ $or: userOrConditions });

    let restaurant: any = null;
    if (user) {
      restaurant = await RestaurantProfile.findOne({ userId: user._id });
    }
    if (!restaurant) {
      const restOrConditions: any[] = [{ phone: rawKey }, { email: cleanEmail }];
      if (cleanDigits && cleanDigits.length === 10) {
        restOrConditions.push({ phone: cleanDigits });
      }
      restaurant = await RestaurantProfile.findOne({ $or: restOrConditions });
      if (restaurant?.userId && !user) {
        user = await User.findById(restaurant.userId);
      }
    }

    // Also check BusinessApplication for any applied or pending food partner application
    const appOrConditions: any[] = [
      { email: cleanEmail },
      { mobile: rawKey },
      { phone: rawKey },
    ];
    if (user) {
      appOrConditions.push({ userId: user._id });
    }
    if (cleanDigits && cleanDigits.length === 10) {
      appOrConditions.push(
        { mobile: cleanDigits },
        { phone: cleanDigits },
        { mobile: `+91${cleanDigits}` }
      );
    }

    const foodApp: any = await BusinessApplication.findOne({
      $and: [
        { $or: appOrConditions },
        {
          $or: [
            { applicationType: { $in: ['food_partner', 'food', 'restaurant', 'food-partner'] } },
            { roleId: { $in: ['food_partner', 'food', 'restaurant', 'food-partner'] } },
            { categories: { $in: ['Food & Dining', 'Food & Beverages', 'Food'] } },
            { primaryCategory: { $regex: /food|dining/i } },
            { category: { $regex: /food|dining/i } },
            { foodBusinessType: { $exists: true, $ne: '' } },
            { restaurantName: { $exists: true, $ne: '' } }
          ]
        }
      ]
    }).sort({ createdAt: -1 });

    if (!user && foodApp?.userId) {
      user = await User.findById(foodApp.userId);
    }

    // Auto-heal food_partner role on user if application exists
    if (user && foodApp && !user.roles.includes('food_partner')) {
      user.roles.push('food_partner');
      await user.save().catch(() => null);
    }

    const hasFoodApp = !!foodApp;
    const hasFoodRole = user && (user.roles.includes('food_partner') || user.roles.includes('food_staff') || user.roles.includes('vendor') || hasFoodApp);

    if ((!user && !restaurant && !hasFoodApp) || (user && !hasFoodRole && !restaurant && !hasFoodApp)) {
      res.status(404).json({
        success: false,
        notApplied: true,
        message: `Account Not Applied: Mobile number/email '${rawKey}' is not registered or applied as a Food Partner. Registration is disabled on this portal.`,
        process: {
          title: 'How to Apply as a Food Partner',
          steps: [
            '1. Open the main ApexBee Mobile App or Web Application.',
            '2. Navigate to "Earn with ApexBee" section.',
            '3. Select "Food Partner Application" and submit your restaurant profile and KYC documents.',
            '4. Once reviewed & approved by ApexBee Admin, your mobile number will be enabled for login here.',
          ],
        },
      });
      return;
    }

    // Always generate dynamic random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const redis = getRedisClient();
    const targetEmail = (user?.email || (rawKey.includes('@') ? cleanEmail : '')).trim().toLowerCase();
    const targetPhone = user?.phone || user?.mobile || (!rawKey.includes('@') ? rawKey : '');

    // Store OTP under all relevant normalized keys for seamless verification
    const keysToStore = [`otp:food:${rawKey}`, `otp:food:${cleanEmail}`];
    if (targetEmail) keysToStore.push(`otp:food:${targetEmail}`);
    if (targetPhone) {
      keysToStore.push(`otp:food:${targetPhone}`);
      const d10 = targetPhone.replace(/\D/g, '').slice(-10);
      if (d10) keysToStore.push(`otp:food:${d10}`, `otp:food:+91${d10}`);
    }

    for (const k of keysToStore) {
      await redis.set(k, generatedOtp, 'EX', 600);
    }

    console.log(`Food Partner OTP generated for: ${rawKey} (${generatedOtp})`);

    // Dispatch SMS OTP if mobile phone is available
    const cleanPhone = SmsService.sanitizePhone(targetPhone || rawKey);
    if (cleanPhone && cleanPhone.length === 10) {
      SmsService.sendLoginOtp(cleanPhone, generatedOtp).catch((err) => {
        console.error('[FOOD PARTNER OTP] SMS dispatch error:', err);
      });
    }

    // Also dispatch Email OTP if valid email is present
    if (targetEmail && targetEmail.includes('@')) {
      EmailService.sendVendorLoginOtp(targetEmail, generatedOtp, user?.name || 'Food Partner').catch((err) => {
        console.error('[FOOD PARTNER OTP] Email dispatch error:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Food Partner OTP sent successfully',
      devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
  }
};

export const verifyFoodPartnerOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, otp } = req.body;
    const rawKey = (phone || email || '').toString().trim();
    const cleanOtp = (otp || '').toString().trim();
    if (!rawKey || !cleanOtp) {
      res.status(400).json({ success: false, message: 'Phone/email and OTP are required' });
      return;
    }

    const cleanEmail = rawKey.toLowerCase();
    const cleanDigits = rawKey.replace(/\D/g, '').slice(-10);

    const redis = getRedisClient();
    const possibleKeys = [
      `otp:food:${rawKey}`,
      `otp:food:${cleanEmail}`,
    ];
    if (cleanDigits && cleanDigits.length === 10) {
      possibleKeys.push(`otp:food:${cleanDigits}`);
      possibleKeys.push(`otp:food:+91${cleanDigits}`);
    }

    let isValid = false;
    let matchedKey: string | null = null;
    for (const k of possibleKeys) {
      const saved = await redis.get(k);
      if (saved && saved.toString().trim() === cleanOtp) {
        isValid = true;
        matchedKey = k;
        break;
      }
    }

    // Bypass in non-production mode
    if (!isValid && process.env.NODE_ENV !== 'production' && cleanOtp === '123456') {
      isValid = true;
    }

    if (isValid) {
      await redis.set(`verified:food:${rawKey}`, 'true', 'EX', 900);
      await redis.set(`verified:food:${cleanEmail}`, 'true', 'EX', 900);
      if (cleanDigits) await redis.set(`verified:food:${cleanDigits}`, 'true', 'EX', 900);
      if (matchedKey) await redis.del(matchedKey);
      res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
  }
};

export const foodPartnerRegister = async (req: Request, res: Response): Promise<void> => {
  res.status(403).json({
    success: false,
    notApplied: true,
    message: 'Direct registration is disabled on the Food Partner Portal. Only pre-applied and approved food partners can log in. Please submit your application via the main ApexBee App under "Earn with ApexBee".',
  });
};

export const foodPartnerLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, password, otp } = req.body;
    const identifier = (email || phone || '').toString().trim();

    if (!identifier) {
      res.status(400).json({ success: false, message: 'Email or phone is required' });
      return;
    }

    const cleanIdentifier = identifier.toLowerCase();
    const cleanDigits = identifier.replace(/\D/g, '').slice(-10);

    const userOrConditions: any[] = [];
    if (identifier.includes('@')) {
      userOrConditions.push({ email: cleanIdentifier });
    } else {
      userOrConditions.push({ phone: identifier }, { mobile: identifier });
      if (cleanDigits && cleanDigits.length === 10) {
        userOrConditions.push(
          { phone: cleanDigits },
          { mobile: cleanDigits },
          { phone: `+91${cleanDigits}` },
          { mobile: `+91${cleanDigits}` }
        );
      }
    }

    let user: any = await User.findOne({ $or: userOrConditions }).select('+passwordHash');

    let restaurant: any = null;
    if (user) {
      restaurant = await RestaurantProfile.findOne({ userId: user._id });
    } else {
      const restOrConditions: any[] = [{ phone: identifier }, { email: cleanIdentifier }];
      if (cleanDigits && cleanDigits.length === 10) {
        restOrConditions.push({ phone: cleanDigits });
      }
      restaurant = await RestaurantProfile.findOne({ $or: restOrConditions });
      if (restaurant?.userId) {
        user = await User.findById(restaurant.userId).select('+passwordHash');
      }
    }

    // Check BusinessApplication for submitted or pending food partner application
    const appOrConditions: any[] = [
      { email: cleanIdentifier },
      { mobile: identifier },
      { phone: identifier },
    ];
    if (user) {
      appOrConditions.push({ userId: user._id });
    }
    if (cleanDigits && cleanDigits.length === 10) {
      appOrConditions.push(
        { mobile: cleanDigits },
        { phone: cleanDigits },
        { mobile: `+91${cleanDigits}` }
      );
    }

    const foodApp: any = await BusinessApplication.findOne({
      $and: [
        { $or: appOrConditions },
        {
          $or: [
            { applicationType: { $in: ['food_partner', 'food', 'restaurant', 'food-partner'] } },
            { roleId: { $in: ['food_partner', 'food', 'restaurant', 'food-partner'] } },
            { categories: { $in: ['Food & Dining', 'Food & Beverages', 'Food'] } },
            { primaryCategory: { $regex: /food|dining/i } },
            { category: { $regex: /food|dining/i } },
            { foodBusinessType: { $exists: true, $ne: '' } },
            { restaurantName: { $exists: true, $ne: '' } }
          ]
        }
      ]
    }).sort({ createdAt: -1 });

    if (!user && foodApp?.userId) {
      user = await User.findById(foodApp.userId).select('+passwordHash');
    }

    const hasFoodApp = !!foodApp;
    const hasFoodRole = user && (user.roles.includes('food_partner') || user.roles.includes('food_staff') || user.roles.includes('vendor') || hasFoodApp);

    if ((!user && !restaurant && !hasFoodApp) || (user && !hasFoodRole && !restaurant && !hasFoodApp)) {
      res.status(404).json({
        success: false,
        notApplied: true,
        message: `Account Not Applied: Mobile number '${identifier}' is not registered or applied as a Food Partner. Registration is disabled on this portal.`,
        process: {
          title: 'How to Apply as a Food Partner',
          steps: [
            '1. Open the main ApexBee Mobile App or Web Application.',
            '2. Navigate to "Earn with ApexBee" section.',
            '3. Select "Food Partner Application" and submit your restaurant profile and KYC documents.',
            '4. Once reviewed & approved by ApexBee Admin, your mobile number will be enabled for login here.',
          ],
        },
      });
      return;
    }

    // Validate password or OTP
    const redis = getRedisClient();
    let isVerifiedOtp = (await redis.get(`verified:food:${identifier}`)) === 'true'
      || (await redis.get(`verified:food:${cleanIdentifier}`)) === 'true';

    if (user?.email) isVerifiedOtp = isVerifiedOtp || (await redis.get(`verified:food:${user.email.toLowerCase()}`)) === 'true';
    if (user?.phone) isVerifiedOtp = isVerifiedOtp || (await redis.get(`verified:food:${user.phone}`)) === 'true';
    if (cleanDigits) isVerifiedOtp = isVerifiedOtp || (await redis.get(`verified:food:${cleanDigits}`)) === 'true';

    if (!isVerifiedOtp && otp) {
      const cleanOtp = otp.toString().trim();
      if (process.env.NODE_ENV !== 'production' && cleanOtp === '123456') {
        isVerifiedOtp = true;
      } else {
        const savedOtp = (await redis.get(`otp:food:${identifier}`)) || (await redis.get(`otp:food:${cleanIdentifier}`));
        if (savedOtp && savedOtp.trim() === cleanOtp) {
          isVerifiedOtp = true;
        }
      }
    }

    if (password) {
      const isMatch = await bcrypt.compare(password, user?.passwordHash || '');
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid password credentials' });
        return;
      }
    } else if (!isVerifiedOtp) {
      res.status(400).json({ success: false, message: 'Password or valid verified OTP is required' });
      return;
    }

    if (user && !user.roles.includes('food_partner') && !user.roles.includes('food_staff')) {
      user.roles.push('food_partner');
      await user.save();
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User record not found.' });
      return;
    }

    if (user.status && ['blocked', 'suspended'].includes(user.status.toLowerCase())) {
      res.status(403).json({
        success: false,
        message: `Your account status is ${user.status}. Please contact ApexBee support.`,
      });
      return;
    }

    // Resolve or auto-provision Vendor and RestaurantProfile with application data if available
    let vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      vendor = new Vendor({
        userId: user._id,
        businessName: foodApp?.restaurantName || foodApp?.businessName || user.sellerProfile?.businessName || user.name + ' Restaurant',
        ownerName: foodApp?.ownerName || user.name,
        mobile: user.phone || identifier,
        email: user.email,
        address: foodApp?.address || 'Food Store Address Pending Onboarding',
        pincode: foodApp?.pincode || user.pincode || '',
        storeType: 'restaurant',
        categories: ['Food & Dining'],
        primaryCategory: 'Food & Dining',
        category: 'Food & Dining',
        subCategory: foodApp?.subCategory || foodApp?.foodBusinessType || 'Restaurants',
        approvedSubcategories: [foodApp?.subCategory || foodApp?.foodBusinessType || 'Restaurants'],
        subCategories: [foodApp?.subCategory || foodApp?.foodBusinessType || 'Restaurants'],
        marketplaceStatus: foodApp?.status === 'approved' ? 'Approved' : 'Pending Review',
      });
      await vendor.save();
    }

    if (!restaurant) {
      restaurant = await RestaurantProfile.findOne({ userId: user._id });
    }
    if (!restaurant) {
      const restName = foodApp?.restaurantName || foodApp?.businessName || user.sellerProfile?.businessName || user.name + ' Restaurant';
      const slugName = (restName || 'restaurant').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Math.floor(1000 + Math.random() * 9000);
      const normalizeBt = (bt?: string): any => {
        const raw = String(bt || '').toUpperCase().trim();
        if (raw.includes('CAFE') || raw.includes('BAKERY') || raw.includes('BEVERAGE')) return 'CAFE_BAKERY_BEVERAGES';
        if (raw.includes('STREET') || raw.includes('CHAAT') || raw.includes('FAST FOOD') || raw.includes('SNACK') || raw.includes('TIFFIN')) return 'STREET_FOOD';
        if (raw.includes('SWEET') || raw.includes('DESSERT') || raw.includes('ICE CREAM')) return 'SWEETS_DESSERTS';
        if (['RESTAURANT', 'STREET_FOOD', 'CAFE_BAKERY_BEVERAGES', 'SWEETS_DESSERTS'].includes(raw)) return raw;
        return 'RESTAURANT';
      };

      restaurant = new RestaurantProfile({
        userId: user._id,
        vendorId: vendor._id,
        storeId: vendor._id,
        restaurantName: restName,
        slug: slugName,
        businessType: normalizeBt(foodApp?.foodBusinessType),
        legalBusinessName: foodApp?.businessName || user.name,
        phone: user.phone || identifier,
        email: user.email,
        fssaiNumber: foodApp?.fssaiNumber || '',
        cuisines: foodApp?.cuisines || [],
        foodPreference: (foodApp?.foodPreference === 'Veg' ? 'VEG' : foodApp?.foodPreference === 'Non-Veg' ? 'NON_VEG' : 'BOTH') as any,
        address: foodApp?.address || 'Address Pending Onboarding',
        locality: foodApp?.mandal || 'Locality Pending',
        city: foodApp?.district || 'Hyderabad',
        state: foodApp?.state || 'Telangana',
        pincode: foodApp?.pincode || user.pincode || '',
        location: { type: 'Point', coordinates: [78.4867, 17.385] },
        verificationStatus: foodApp?.status === 'approved' ? 'APPROVED' : 'PENDING',
        accountStatus: 'ACTIVE',
        onboardingStep: 1,
        isOnboardingCompleted: false,
      });
      await restaurant.save();
    }

    // Ensure Restaurant Settings & Operating Hours exist
    let settings = await RestaurantSettings.findOne({ restaurantId: restaurant._id });
    if (!settings) {
      settings = new RestaurantSettings({ restaurantId: restaurant._id, storeId: vendor._id });
      await settings.save();
    }

    let operatingHours = await RestaurantOperatingHours.findOne({ restaurantId: restaurant._id });
    if (!operatingHours) {
      operatingHours = new RestaurantOperatingHours({ restaurantId: restaurant._id, storeId: vendor._id });
      await operatingHours.save();
    }

    const token = generateFoodToken((user._id as any).toString(), user.email, user.roles);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: user.roles,
      },
      partnerContext: {
        userId: user._id,
        vendorId: vendor._id,
        storeId: vendor._id,
        restaurantId: restaurant._id,
        restaurantName: restaurant.restaurantName,
        businessType: restaurant.businessType,
        verificationStatus: restaurant.verificationStatus,
        accountStatus: restaurant.accountStatus,
        operationalStatus: restaurant.operationalStatus,
        isOnboardingCompleted: restaurant.isOnboardingCompleted,
        onboardingStep: restaurant.onboardingStep,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Food Partner login failed', error: error.message });
  }
};

export const getFoodPartnerMe = async (req: FoodPartnerAuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.foodPartnerContext) {
      res.status(401).json({ success: false, message: 'Partner context unavailable' });
      return;
    }

    const { restaurantProfile, restaurantSettings } = req.foodPartnerContext;
    const operatingHours = await RestaurantOperatingHours.findOne({ restaurantId: restaurantProfile._id });

    res.status(200).json({
      success: true,
      context: req.foodPartnerContext,
      restaurant: restaurantProfile,
      settings: restaurantSettings,
      operatingHours,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch me details', error: error.message });
  }
};
