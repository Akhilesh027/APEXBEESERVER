import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, RoleType } from '../models/User';
import { Wallet } from '../models/Wallet';
import { Referral } from '../models/Referral';
import { LoginAudit } from '../models/LoginAudit';
import { Vendor } from '../models/Vendor';
import { Wholesaler } from '../models/Wholesaler';
import { Manufacturer } from '../models/Manufacturer';
import { BusinessApplication } from '../models/BusinessApplication';
import { AuthRequest } from '../middleware/auth';
import { getRedisClient } from '../config/redis';
import { generateMasterCustomerId, generateUniversalReferralCode, generateRoleReferenceId } from '../services/identityService';
import { EmailService } from '../services/emailService';
import { SmsService } from '../services/smsService';
import { NotificationHelper } from '../services/notificationHelper';

async function generateReferralCode(name: string): Promise<string> {
  const cleanName = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = (cleanName.substring(0, 3) + "XXX").substring(0, 3);
  let isUnique = false;
  let code = "";
  while (!isUnique) {
    const randomChars = Math.random().toString(36).substring(2, 5).toUpperCase();
    code = `APX-${prefix}${randomChars}`;
    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
}


const generateToken = (id: string, email: string, roles: RoleType[]): string => {
  return jwt.sign(
    { id, email, roles },
    process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork',
    { expiresIn: '30d' }
  );
};

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email } = req.body;
    const purpose = (req.body.purpose || '').toLowerCase();
    const key = phone || email;
    if (!key) {
      res.status(400).json({ message: 'Phone or email is required' });
      return;
    }

    // PRE-CHECK: If registering, check if user already exists BEFORE generating/sending OTP
    if (purpose === 'register' || req.body.isRegister) {
      const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
      const cleanPhone = phone ? phone.toString().trim() : '';

      const orConditions: any[] = [];
      if (cleanEmail) {
        orConditions.push({ email: cleanEmail });
      }
      if (cleanPhone) {
        const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
        orConditions.push(
          { phone: cleanPhone },
          { mobile: cleanPhone }
        );
        if (last10 && last10.length === 10) {
          orConditions.push(
            { phone: last10 },
            { mobile: last10 },
            { phone: `+91${last10}` },
            { mobile: `+91${last10}` }
          );
        }
      }

      if (orConditions.length > 0) {
        const userExists = await User.findOne({ $or: orConditions });
        if (userExists) {
          const userEmail = (userExists.email || '').toLowerCase().trim();
          const userPhone = (userExists.phone || '').trim();
          const userMobile = (userExists.mobile || '').trim();
          const last10Input = cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-10) : '';

          const emailMatches = Boolean(cleanEmail && userEmail && userEmail === cleanEmail);
          const phoneMatches = Boolean(
            cleanPhone && (
              userPhone === cleanPhone ||
              userMobile === cleanPhone ||
              (last10Input && (userPhone.endsWith(last10Input) || userMobile.endsWith(last10Input)))
            )
          );

          let errMsg = 'User with this email or phone number already exists';
          if (emailMatches && phoneMatches) {
            errMsg = 'User with this email and phone number already exists';
          } else if (emailMatches) {
            errMsg = 'User with this email already exists';
          } else if (phoneMatches) {
            errMsg = 'User with this phone number already exists';
          }

          res.status(400).json({
            success: false,
            message: errMsg,
            emailExists: emailMatches,
            phoneExists: phoneMatches
          });
          return;
        }
      }
    }

    // PRE-CHECK: If forgot/reset password, check if account exists
    if (purpose === 'reset_password' || purpose === 'forgot_password') {
      const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
      const cleanPhone = phone ? phone.toString().trim() : '';
      const orConditions: any[] = [];
      if (cleanEmail && cleanEmail.includes('@')) {
        orConditions.push({ email: cleanEmail });
        orConditions.push({ email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      } else if (cleanEmail && !cleanEmail.includes('@')) {
        // Input passed in email field is actually a phone number
        const digits = cleanEmail.replace(/\D/g, '');
        const last10 = digits.slice(-10);
        orConditions.push({ phone: cleanEmail }, { mobile: cleanEmail });
        if (last10 && last10.length === 10) {
          orConditions.push(
            { phone: last10 },
            { mobile: last10 },
            { phone: `+91${last10}` },
            { mobile: `+91${last10}` }
          );
        }
      }
      if (cleanPhone) {
        const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
        orConditions.push(
          { phone: cleanPhone },
          { mobile: cleanPhone }
        );
        if (last10 && last10.length === 10) {
          orConditions.push(
            { phone: last10 },
            { mobile: last10 },
            { phone: `+91${last10}` },
            { mobile: `+91${last10}` }
          );
        }
      }

      if (orConditions.length > 0) {
        const userExists = await User.findOne({ $or: orConditions });
        if (!userExists) {
          res.status(404).json({
            success: false,
            message: 'No account found with this email or phone number. Please register or verify the information entered.'
          });
          return;
        }
      }
    }

    // Always generate a dynamic random 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const redis = getRedisClient();
    const redisKey = `otp:${key}`;
    await redis.set(redisKey, generatedOtp, 'EX', 300);

    if (email) {
      const cleanEmail = email.toString().trim().toLowerCase();
      await redis.set(`otp:${cleanEmail}`, generatedOtp, 'EX', 300);
      await redis.set(`otp:${email.toString().trim()}`, generatedOtp, 'EX', 300);
    }
    if (phone) {
      const cleanPhone = phone.toString().trim();
      await redis.set(`otp:${cleanPhone}`, generatedOtp, 'EX', 300);
      const digitsOnly = cleanPhone.replace(/\D/g, '').slice(-10);
      if (digitsOnly) {
        await redis.set(`otp:${digitsOnly}`, generatedOtp, 'EX', 300);
      }
    }

    console.log(`OTP generated for: ${key} (${generatedOtp})`);

    // Dispatch real SMS via DLT template if phone number is provided
    if (phone) {
      if (purpose === 'login') {
        await SmsService.sendLoginOtp(phone, generatedOtp);
      } else if (purpose === 'reset_password' || purpose === 'forgot_password') {
        await SmsService.sendPasswordResetOtp(phone, generatedOtp);
      } else {
        await SmsService.sendRegistrationOtp(phone, generatedOtp);
      }
    }

    // Also dispatch Email OTP if valid email is provided
    if (email && typeof email === 'string' && email.includes('@')) {
      EmailService.sendVerificationOtp(email.trim(), generatedOtp, purpose).catch((err) => {
        console.error('[Send OTP] Email dispatch error:', err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

export const checkUserExists = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
    const cleanPhone = phone ? phone.toString().trim() : '';

    const orConditions: any[] = [];
    if (cleanEmail) {
      orConditions.push({ email: cleanEmail });
    }
    if (cleanPhone) {
      const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
      orConditions.push({ phone: cleanPhone }, { mobile: cleanPhone });
      if (last10 && last10.length === 10) {
        orConditions.push(
          { phone: last10 },
          { mobile: last10 },
          { phone: `+91${last10}` },
          { mobile: `+91${last10}` }
        );
      }
    }

    if (orConditions.length === 0) {
      res.status(400).json({ success: false, message: 'Email or phone number is required' });
      return;
    }

    const existingUser = await User.findOne({ $or: orConditions });
    if (existingUser) {
      const userEmail = (existingUser.email || '').toLowerCase().trim();
      const userPhone = (existingUser.phone || '').trim();
      const userMobile = (existingUser.mobile || '').trim();
      const last10Input = cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-10) : '';

      const emailMatches = Boolean(cleanEmail && userEmail && userEmail === cleanEmail);
      const phoneMatches = Boolean(
        cleanPhone && (
          userPhone === cleanPhone ||
          userMobile === cleanPhone ||
          (last10Input && (userPhone.endsWith(last10Input) || userMobile.endsWith(last10Input)))
        )
      );

      let errMsg = 'User with this email or phone number already exists';
      if (emailMatches && phoneMatches) {
        errMsg = 'User with this email and phone number already exists';
      } else if (emailMatches) {
        errMsg = 'User with this email already exists';
      } else if (phoneMatches) {
        errMsg = 'User with this phone number already exists';
      }

      res.status(200).json({
        success: true,
        exists: true,
        emailExists: emailMatches,
        phoneExists: phoneMatches,
        message: errMsg
      });
      return;
    }

    res.status(200).json({
      success: true,
      exists: false,
      message: 'Available'
    });
  } catch (error: any) {
    console.error('Check user exists error:', error);
    res.status(500).json({ success: false, message: 'Server error checking user existence', error: error.message });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, otp } = req.body;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
    const cleanPhone = phone ? phone.toString().trim() : '';
    const key = cleanEmail || cleanPhone;
    if (!key || !otp) {
      res.status(400).json({ message: 'Phone/email and OTP are required' });
      return;
    }

    const redis = getRedisClient();
    const cleanOtp = otp.toString().trim();

    // Check all possible redis keys for OTP (normalized, raw, stripped)
    const possibleOtpKeys = [
      `otp:${key}`,
      email ? `otp:${email.toString().trim()}` : '',
      email ? `otp:${email.toString().trim().toLowerCase()}` : '',
      phone ? `otp:${phone.toString().trim()}` : '',
      phone ? `otp:${phone.toString().replace(/\D/g, '').slice(-10)}` : '',
    ].filter(Boolean);

    let matchedKey: string | null = null;
    for (const k of possibleOtpKeys) {
      const saved = await redis.get(k);
      if (saved && saved.toString().trim() === cleanOtp) {
        matchedKey = k;
        break;
      }
    }

    if (matchedKey) {
      // Set verified for normalized key and all variants
      await redis.set(`verified:${key}`, 'true', 'EX', 900);
      if (cleanEmail) {
        await redis.set(`verified:${cleanEmail}`, 'true', 'EX', 900);
      }
      if (cleanPhone) {
        await redis.set(`verified:${cleanPhone}`, 'true', 'EX', 900);
        const digits = cleanPhone.replace(/\D/g, '').slice(-10);
        if (digits) await redis.set(`verified:${digits}`, 'true', 'EX', 900);
      }
      if (email) {
        await redis.set(`verified:${email.toString().trim()}`, 'true', 'EX', 900);
      }
      if (phone) {
        await redis.set(`verified:${phone.toString().trim()}`, 'true', 'EX', 900);
      }

      await redis.del(matchedKey);
      res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ message: 'Invalid OTP code' });
    }
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Failed to verify OTP', error: error.message });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, phone, roles, territory, sellerProfile, entrepreneurProfile, referredByCode, referralCode, otp } = req.body;

    // Check OTP verification
    const redis = getRedisClient();
    const isVerifiedPhone = await redis.get(`verified:${phone}`);
    const isVerifiedEmail = await redis.get(`verified:${email}`);
    const isOtpVerified = isVerifiedPhone === 'true' || isVerifiedEmail === 'true';
    if (!isOtpVerified) {
      res.status(400).json({ message: 'Phone/email verification is pending. Please verify OTP first.' });
      return;
    }

    // Check if user already exists
    const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
    const cleanPhone = phone ? phone.toString().trim() : '';
    const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
    const regCheckConditions: any[] = [];
    if (cleanEmail) regCheckConditions.push({ email: cleanEmail });
    if (cleanPhone) {
      regCheckConditions.push({ phone: cleanPhone }, { mobile: cleanPhone });
      if (last10 && last10.length === 10) {
        regCheckConditions.push(
          { phone: last10 },
          { mobile: last10 },
          { phone: `+91${last10}` },
          { mobile: `+91${last10}` }
        );
      }
    }
    const userExists = await User.findOne({ $or: regCheckConditions });
    if (userExists) {
      const userEmail = (userExists.email || '').toLowerCase().trim();
      const userPhone = (userExists.phone || '').trim();
      const userMobile = (userExists.mobile || '').trim();
      const last10Input = cleanPhone ? cleanPhone.replace(/\D/g, '').slice(-10) : '';

      const emailMatches = Boolean(cleanEmail && userEmail && userEmail === cleanEmail);
      const phoneMatches = Boolean(
        cleanPhone && (
          userPhone === cleanPhone ||
          userMobile === cleanPhone ||
          (last10Input && (userPhone.endsWith(last10Input) || userMobile.endsWith(last10Input)))
        )
      );

      let errMsg = 'User with this email or phone already exists';
      if (emailMatches && phoneMatches) {
        errMsg = 'User with this email and phone number already exists';
      } else if (emailMatches) {
        errMsg = 'User with this email already exists';
      } else if (phoneMatches) {
        errMsg = 'User with this phone number already exists';
      }

      res.status(400).json({ success: false, message: errMsg });
      return;
    }

    // Validate referral code if provided, or fallback to APEXBEE
    const refCode = (referralCode || referredByCode || "APEXBEE").trim();
    let referrer = await User.findOne({ referralCode: refCode });
    if (!referrer && refCode !== "APEXBEE") {
      res.status(400).json({ success: false, message: 'Invalid referral code' });
      return;
    }
    if (!referrer) {
      referrer = await User.findOne({ referralCode: "APEXBEE" });
    }

    const referralHierarchy = {
      level1UserId: referrer ? referrer._id : null,
      level2UserId: (referrer && referrer.referralHierarchy) ? referrer.referralHierarchy.level1UserId : null,
      level3UserId: (referrer && referrer.referralHierarchy) ? referrer.referralHierarchy.level2UserId : null,
    };

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Normalize input roles to lowercase
    let mappedRoles: RoleType[] = ['customer'];
    if (Array.isArray(roles) && roles.length > 0) {
      mappedRoles = roles.map(r => r.toLowerCase().replace('-', '_') as RoleType);
    }
    if (!mappedRoles.includes('customer')) {
      mappedRoles.push('customer');
    }

    const generatedReferralCode = await generateUniversalReferralCode(name);
    const masterCustomerId = await generateMasterCustomerId();

    const roleReferenceIdsMap: Record<string, string> = {};
    for (const r of mappedRoles) {
      roleReferenceIdsMap[r] = generateRoleReferenceId(r);
    }

    // Initial User document setup
    const user = new User({
      name,
      email,
      passwordHash,
      phone,
      mobile: phone,
      roles: mappedRoles,
      status: 'active',
      isVerified: true,
      profileImage: '',
      territory,
      sellerProfile,
      entrepreneurProfile,
      referralCode: generatedReferralCode,
      masterCustomerId,
      roleReferenceIds: roleReferenceIdsMap,
      referredBy: referrer ? referrer._id : null,
      firstOrderQualified: false,
      referralHierarchy: referralHierarchy
    });

    // --- Automatic Territory Linking Logic ---
    if (territory && territory.state) {
      const assignedFranchise: {
        stateFranchiseId?: any;
        districtFranchiseId?: any;
        mandalFranchiseId?: any;
      } = {};

      // 1. Locate State Franchise
      const stateFranchise = await User.findOne({
        roles: 'state_franchise',
        'territory.state': territory.state
      });
      if (stateFranchise) {
        assignedFranchise.stateFranchiseId = stateFranchise._id;
      }

      // 2. Locate District Franchise
      if (territory.district) {
        const districtFranchise = await User.findOne({
          roles: 'district_franchise',
          'territory.state': territory.state,
          'territory.district': territory.district
        });
        if (districtFranchise) {
          assignedFranchise.districtFranchiseId = districtFranchise._id;
        }
      }

      // 3. Locate Mandal Franchise
      if (territory.mandal) {
        const mandalFranchise = await User.findOne({
          roles: 'mandal_franchise',
          'territory.state': territory.state,
          'territory.district': territory.district,
          'territory.mandal': territory.mandal
        });
        if (mandalFranchise) {
          assignedFranchise.mandalFranchiseId = mandalFranchise._id;
        }
      }

      user.assignedFranchise = assignedFranchise;
    }

    // --- Referral / MLM link handling ---
    if (referredByCode) {
      const referrer = await User.findOne({ $or: [{ phone: referredByCode }, { email: referredByCode }] });
      if (referrer && user.entrepreneurProfile) {
        user.entrepreneurProfile.referredBy = referrer._id as any;
      }
    }

    // Save user
    const savedUser = await user.save();

    if (referrer) {
      await Referral.create({
        referrerUserId: referrer._id,
        referredUserId: savedUser._id,
        referralCode: refCode,
        status: "registered"
      });
      referrer.totalReferrals = (referrer.totalReferrals || 0) + 1;
      await referrer.save();
    }

    // Create a Wallet for the User
    const wallet = new Wallet({
      userId: savedUser._id,
      availableBalance: 0,
      pendingBalance: 0,
      withdrawnBalance: 0,
      ledgerEntries: []
    });
    await wallet.save();

    // Generate JWT
    const token = generateToken(savedUser._id.toString(), savedUser.email, savedUser.roles);

    // Clean up temporary OTP verification state
    await redis.del(`verified:${phone}`);
    await redis.del(`verified:${email}`);

    // Trigger Welcome Email & In-App / Franchise Notifications
    NotificationHelper.notifyNewUserRegistration(savedUser, territory).catch((err) => {
      console.error('Failed to dispatch registration notifications:', err);
    });

    // Dispatch DLT Registration Success SMS
    if (savedUser.phone) {
      SmsService.sendCustomerRegistrationSuccess(savedUser.phone, savedUser.name).catch((err) => {
        console.error('Failed to dispatch registration success SMS:', err);
      });
    }

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        _id: savedUser._id,
        masterCustomerId: savedUser.masterCustomerId,
        name: savedUser.name,
        email: savedUser.email,
        phone: savedUser.phone,
        mobile: savedUser.mobile,
        roles: savedUser.roles,
        status: savedUser.status,
        isVerified: savedUser.isVerified,
        profileImage: savedUser.profileImage,
        territory: savedUser.territory,
        assignedFranchise: savedUser.assignedFranchise,
        sellerProfile: savedUser.sellerProfile,
        entrepreneurProfile: savedUser.entrepreneurProfile,
        referralCode: savedUser.referralCode,
        roleReferenceIds: savedUser.roleReferenceIds
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
};

const parseUserAgent = (ua?: string) => {
  if (!ua) return { browser: 'Unknown Browser', device: 'Unknown Device' };
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

  let device = 'Desktop';
  if (ua.includes('Mobi') || ua.includes('Android') || ua.includes('iPhone')) {
    device = ua.includes('iPhone') ? 'iPhone' : ua.includes('Android') ? 'Android Mobile' : 'Mobile';
  } else if (ua.includes('iPad')) {
    device = 'iPad';
  } else if (ua.includes('Windows')) {
    device = 'Windows PC';
  } else if (ua.includes('Macintosh')) {
    device = 'Mac';
  } else if (ua.includes('Linux')) {
    device = 'Linux Desktop';
  }
  return { browser, device };
};

const logLoginAudit = async (userId: any, req: Request, status: 'success' | 'failed') => {
  try {
    const ua = req.headers['user-agent'] as string;
    const { browser, device } = parseUserAgent(ua);
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '';
    await LoginAudit.create({
      userId,
      ipAddress,
      device,
      browser,
      loginTime: new Date(),
      status
    });
  } catch (err) {
    console.error('Failed to create login audit:', err);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    console.log('LOGIN BODY:', req.body);

    if (!email || !password) {
      res.status(400).json({
        message: 'Email and password are required',
      });
      return;
    }

    const cleanInput = (email || '').toString().trim();
    const orConditions: any[] = [];
    if (cleanInput.includes('@')) {
      const lower = cleanInput.toLowerCase();
      orConditions.push({ email: lower });
      orConditions.push({ email: { $regex: new RegExp(`^${cleanInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    } else {
      const digits = cleanInput.replace(/\D/g, '').slice(-10);
      orConditions.push({ phone: cleanInput }, { mobile: cleanInput });
      if (digits && digits.length === 10) {
        orConditions.push(
          { phone: digits },
          { mobile: digits },
          { phone: `+91${digits}` },
          { mobile: `+91${digits}` }
        );
      }
    }

    let user: any = await User.findOne({ $or: orConditions }).select('+passwordHash');

    // If not found in User, check Vendor / Wholesaler / Manufacturer to get linked userId
    if (!user) {
      const vDoc: any = await Vendor.findOne({ $or: orConditions });
      if (vDoc?.userId) user = await User.findById(vDoc.userId).select('+passwordHash');
    }
    if (!user) {
      const wsDoc: any = await Wholesaler.findOne({ $or: orConditions });
      if (wsDoc?.userId) user = await User.findById(wsDoc.userId).select('+passwordHash');
    }
    if (!user) {
      const mfDoc: any = await Manufacturer.findOne({ $or: orConditions });
      if (mfDoc?.userId) user = await User.findById(mfDoc.userId).select('+passwordHash');
    }

    if (!user) {
      res.status(400).json({
        message: 'Invalid email or password',
      });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({
        message: 'Password not set for this account',
      });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      await logLoginAudit(user._id, req, 'failed');
      res.status(400).json({
        message: 'Invalid email or password',
      });
      return;
    }

    if (user.status && user.status.toLowerCase() !== 'active') {
      await logLoginAudit(user._id, req, 'failed');
      res.status(403).json({
        message: 'Your account is not active',
      });
      return;
    }

    await logLoginAudit(user._id, req, 'success');

    const token = generateToken(
      user._id.toString(),
      user.email,
      user.roles || []
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        _id: user._id,
        masterCustomerId: user.masterCustomerId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        roles: user.roles || [],
        role: user.roles?.[0] || '',
        status: user.status,
        isVerified: user.isVerified,
        profileImage: user.profileImage,
        territory: user.territory,
        assignedFranchise: user.assignedFranchise,
        sellerProfile: user.sellerProfile,
        entrepreneurProfile: user.entrepreneurProfile,
        referralCode: user.referralCode,
        roleReferenceIds: user.roleReferenceIds,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);

    res.status(500).json({
      message: 'Server error during login',
      error: error.message,
    });
  }
};


export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }

    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        roles: user.roles,
        status: user.status,
        isVerified: user.isVerified,
        isProfileIncomplete: !user.phone || !user.phone.trim(),
        profileImage: user.profileImage,
        territory: user.territory,
        assignedFranchise: user.assignedFranchise,
        sellerProfile: user.sellerProfile,
        entrepreneurProfile: user.entrepreneurProfile,
        referralCode: user.referralCode
      }
    });
  } catch (error: any) {
    console.error('getMe error:', error);
    res.status(500).json({ message: 'Server error retrieving profile', error: error.message });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Old and new passwords are required' });
      return;
    }
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ message: 'Incorrect old password' });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error during password update', error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phone, otp, newPassword, password } = req.body;
    const finalPassword = newPassword || password;
    const cleanEmail = email ? email.toString().trim().toLowerCase() : '';
    const cleanPhone = phone ? phone.toString().trim() : '';
    const key = cleanEmail || cleanPhone;

    if (!key) {
      res.status(400).json({ success: false, message: 'Email or phone number is required' });
      return;
    }

    if (!finalPassword || typeof finalPassword !== 'string' || finalPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
      return;
    }

    const redis = getRedisClient();

    // Check if verified in Redis across all possible variants
    const possibleVerifiedKeys = [
      `verified:${key}`,
      cleanEmail ? `verified:${cleanEmail}` : '',
      cleanPhone ? `verified:${cleanPhone}` : '',
      email ? `verified:${email.toString().trim()}` : '',
      phone ? `verified:${phone.toString().trim()}` : '',
    ].filter(Boolean);

    let isVerified = false;
    for (const vk of possibleVerifiedKeys) {
      const val = await redis.get(vk);
      if (val === 'true') {
        isVerified = true;
        break;
      }
    }

    // If verified flag is not found, also verify OTP directly if provided
    if (!isVerified) {
      if (otp) {
        const cleanOtp = otp.toString().trim();
        const possibleOtpKeys = [
          `otp:${key}`,
          cleanEmail ? `otp:${cleanEmail}` : '',
          cleanPhone ? `otp:${cleanPhone}` : '',
          email ? `otp:${email.toString().trim()}` : '',
          phone ? `otp:${phone.toString().trim()}` : '',
        ].filter(Boolean);

        for (const ok of possibleOtpKeys) {
          const savedOtp = await redis.get(ok);
          if (savedOtp && savedOtp.toString().trim() === cleanOtp) {
            isVerified = true;
            await redis.del(ok);
            break;
          }
        }
      }

      if (!isVerified) {
        res.status(400).json({ success: false, message: 'OTP verification expired or invalid. Please verify OTP again.' });
        return;
      }
    }

    // Find user by email or phone (case-insensitive for email)
    const orConditions: any[] = [];
    if (cleanEmail && cleanEmail.includes('@')) {
      orConditions.push({ email: cleanEmail });
      orConditions.push({ email: { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    } else if (cleanEmail && !cleanEmail.includes('@')) {
      // Input in email field was actually a mobile/phone number
      const digits = cleanEmail.replace(/\D/g, '');
      const last10 = digits.slice(-10);
      orConditions.push({ phone: cleanEmail }, { mobile: cleanEmail });
      if (last10 && last10.length === 10) {
        orConditions.push(
          { phone: last10 },
          { mobile: last10 },
          { phone: `+91${last10}` },
          { mobile: `+91${last10}` }
        );
      }
    }
    if (cleanPhone) {
      const last10 = cleanPhone.replace(/\D/g, '').slice(-10);
      orConditions.push({ phone: cleanPhone }, { mobile: cleanPhone });
      if (last10 && last10.length === 10) {
        orConditions.push(
          { phone: last10 },
          { mobile: last10 },
          { phone: `+91${last10}` },
          { mobile: `+91${last10}` }
        );
      }
    }

    const user = await User.findOne({ $or: orConditions });
    if (!user) {
      res.status(404).json({ success: false, message: 'No account found with this email or phone number' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // Update password directly using updateOne to avoid full schema re-validation errors
    await User.updateOne(
      { _id: user._id },
      { $set: { passwordHash: hashedPassword } }
    );

    // Clean up verified flags
    for (const vk of possibleVerifiedKeys) {
      try {
        await redis.del(vk);
      } catch { }
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error resetting password', error: error.message });
  }
};

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential, referralCode } = req.body;
    if (!credential) {
      res.status(400).json({ message: 'Google credential token is required' });
      return;
    }

    let payload: any = null;

    // Verify or decode Google JWT ID Token
    try {
      const decoded = jwt.decode(credential) as any;
      if (decoded && decoded.email) {
        payload = decoded;
      }
    } catch { }

    if (!payload || !payload.email) {
      try {
        const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
        if (verifyRes.ok) {
          payload = await verifyRes.json();
        }
      } catch { }
    }

    if (!payload || !payload.email) {
      try {
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${credential}` }
        });
        if (userInfoRes.ok) {
          payload = await userInfoRes.json();
        }
      } catch { }
    }

    if (!payload || !payload.email) {
      res.status(400).json({ message: 'Failed to verify Google credential' });
      return;
    }

    const email = payload.email.toLowerCase().trim();
    const name = payload.name || payload.given_name || email.split('@')[0];
    const picture = payload.picture || '';

    let user = await User.findOne({ email });

    if (!user) {
      const userReferralCode = await generateReferralCode(name);
      const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const requestedRole = (req.body.role || '').toString().toLowerCase();
      const initialRole: RoleType = (requestedRole.includes('business') || requestedRole === 'business_partner')
        ? 'business_partner'
        : 'customer';

      user = new User({
        name,
        email,
        passwordHash: hashedPassword,
        roles: [initialRole],
        status: 'Active',
        isVerified: true,
        profileImage: picture,
        referralCode: userReferralCode
      });

      if (referralCode && referralCode.trim()) {
        const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
        if (referrer) {
          (user as any).referredBy = referrer._id;
          (user as any).referredByCode = referrer.referralCode;

          try {
            const refDoc = new Referral({
              referrerUserId: referrer._id,
              referredUserId: user._id,
              referralCode: referrer.referralCode,
              status: 'registered',
              rewardAmount: 50
            });
            await refDoc.save();
          } catch (refErr) {
            console.warn('Failed to save Google signup referral record:', refErr);
          }
        }
      }

      await user.save();

      const wallet = new Wallet({ userId: user._id, availableBalance: 0, ledgerEntries: [] });
      await wallet.save();

      // Trigger Welcome Email & In-App / Franchise Notifications for new user
      NotificationHelper.notifyNewUserRegistration(user, user.territory).catch((err) => {
        console.error('Failed to dispatch Google registration notifications:', err);
      });
    }

    const token = generateToken((user._id as any).toString(), user.email, user.roles);
    const isProfileIncomplete = !user.phone || !user.phone.trim();

    res.status(200).json({
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        mobile: user.mobile || "",
        roles: user.roles,
        status: user.status,
        isVerified: user.isVerified,
        isProfileIncomplete,
        profileImage: user.profileImage,
        referralCode: user.referralCode
      }
    });
  } catch (error: any) {
    console.error('Google Auth error:', error);
    res.status(500).json({ message: 'Google Authentication failed', error: error.message });
  }
};

export const sendVendorLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawInput = (req.body.email || req.body.phone || req.body.username || '').toString().trim();
    if (!rawInput) {
      res.status(400).json({ success: false, message: 'Please enter your registered email address or phone number.' });
      return;
    }

    const cleanInput = rawInput.toLowerCase();
    const isEmail = cleanInput.includes('@');

    // Build flexible query conditions for User & Vendor lookup
    const orConditions: any[] = [];
    if (isEmail) {
      orConditions.push({ email: cleanInput });
      orConditions.push({ email: { $regex: new RegExp(`^${cleanInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    } else {
      const digits = rawInput.replace(/\D/g, '').slice(-10);
      orConditions.push({ phone: rawInput }, { mobile: rawInput });
      if (digits && digits.length === 10) {
        orConditions.push(
          { phone: digits },
          { mobile: digits },
          { phone: `+91${digits}` },
          { mobile: `+91${digits}` }
        );
      }
    }

    // 1. Check if user exists in User collection
    let user = await User.findOne({ $or: orConditions });

    // 2. If user not found directly, check Vendor, Wholesaler, Manufacturer, or BusinessApplication collections
    if (!user) {
      const linkedVendorDoc = await Vendor.findOne({ $or: orConditions });
      if (linkedVendorDoc && linkedVendorDoc.userId) {
        user = await User.findById(linkedVendorDoc.userId);
      }
    }
    if (!user) {
      const wsDoc = await Wholesaler.findOne({ $or: orConditions });
      if (wsDoc && wsDoc.userId) {
        user = await User.findById(wsDoc.userId);
      }
    }
    if (!user) {
      const mfDoc = await Manufacturer.findOne({ $or: orConditions });
      if (mfDoc && mfDoc.userId) {
        user = await User.findById(mfDoc.userId);
      }
    }
    if (!user) {
      const appDoc = await BusinessApplication.findOne({ $or: orConditions });
      if (appDoc && appDoc.userId) {
        user = await User.findById(appDoc.userId);
      }
    }

    if (!user) {
      res.status(404).json({
        success: false,
        isRegistered: false,
        message: 'Account not found. Please verify the email or phone number entered, or register as a vendor first.'
      });
      return;
    }

    // 3. Check if user is a vendor or has seller capability
    const userRoles = Array.isArray(user.roles)
      ? user.roles.map(r => String(r).toLowerCase().trim())
      : ((user as any).role ? [String((user as any).role).toLowerCase().trim()] : []);

    const permittedRoles = [
      'vendor',
      'wholesaler',
      'manufacturer',
      'admin',
      'food_partner',
      'food_staff',
      'service_provider',
      'seller',
      'merchant',
      'business_partner',
      'store_owner',
      'retailer',
      'franchise',
      'state_franchise',
      'district_franchise',
      'mandal_franchise',
      'entrepreneur'
    ];

    let hasVendorRole = userRoles.some(r => permittedRoles.includes(r));

    // If not explicitly in user.roles, check if they have a Vendor document or approved application
    if (!hasVendorRole) {
      const existingVendor = await Vendor.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
      const existingWs = await Wholesaler.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
      const existingMf = await Manufacturer.findOne({ $or: [{ userId: user._id }, { email: user.email }] });
      const existingApp = await BusinessApplication.findOne({ $or: [{ userId: user._id }, { email: user.email }] });

      if (existingVendor || existingWs || existingMf || (existingApp && (existingApp.kycStatus === 'verified' || (existingApp as any).status === 'approved')) || user.sellerProfile) {
        hasVendorRole = true;
        // Auto-heal: add 'vendor' role to user
        if (!user.roles.includes('vendor')) {
          user.roles.push('vendor');
          await user.save().catch(() => null);
        }
      }
    }

    if (!hasVendorRole) {
      res.status(403).json({
        success: false,
        isRegistered: true,
        hasVendorRole: false,
        message: 'Your account is registered as a customer, but not approved as a vendor yet. Please apply in Earn with ApexBee.'
      });
      return;
    }

    // 4. Generate 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const redis = getRedisClient();
    const targetEmail = (user.email || (isEmail ? cleanInput : '')).trim().toLowerCase();
    const targetPhone = user.phone || user.mobile || (!isEmail ? rawInput : '');

    // Save OTP under all relevant keys for seamless verification
    const keysToSave = [
      `vendor_otp:${cleanInput}`,
      `vendor_otp:${user._id.toString()}`
    ];
    if (targetEmail) {
      keysToSave.push(`vendor_otp:${targetEmail}`);
      keysToSave.push(`otp:${targetEmail}`);
    }
    if (targetPhone) {
      keysToSave.push(`vendor_otp:${targetPhone}`);
      keysToSave.push(`otp:${targetPhone}`);
      const d10 = targetPhone.replace(/\D/g, '').slice(-10);
      if (d10) {
        keysToSave.push(`vendor_otp:${d10}`);
        keysToSave.push(`otp:${d10}`);
      }
    }

    for (const key of keysToSave) {
      await redis.set(key, generatedOtp, 'EX', 600); // 10 minutes
    }

    console.log(`[VENDOR LOGIN OTP] Generated OTP for ${targetEmail || targetPhone}: ${generatedOtp}`);

    // 5. Send OTP via Email (and SMS if phone available)
    if (targetEmail && targetEmail.includes('@')) {
      EmailService.sendVendorLoginOtp(targetEmail, generatedOtp, user.name).catch((err) => {
        console.error('[VENDOR LOGIN OTP] Email dispatch error:', err);
      });
    }

    if (targetPhone) {
      SmsService.sendLoginOtp(targetPhone, generatedOtp).catch((err) => {
        console.error('[VENDOR LOGIN OTP] SMS dispatch error:', err);
      });
    }

    const recipientText = targetEmail ? targetEmail : `+91 ${targetPhone.slice(-10)}`;

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${recipientText}.`,
      recipient: recipientText,
      devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined
    });
  } catch (error: any) {
    console.error('Send Vendor Login OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP verification code', error: error.message });
  }
};

export const verifyVendorLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawInput = (req.body.email || req.body.phone || req.body.username || '').toString().trim();
    const otp = (req.body.otp || '').toString().trim();

    if (!rawInput || !otp) {
      res.status(400).json({ success: false, message: 'Email/phone and 6-digit OTP code are required.' });
      return;
    }

    const cleanInput = rawInput.toLowerCase();
    const isEmail = cleanInput.includes('@');

    // Build lookup condition for User
    const orConditions: any[] = [];
    if (isEmail) {
      orConditions.push({ email: cleanInput });
      orConditions.push({ email: { $regex: new RegExp(`^${cleanInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    } else {
      const digits = rawInput.replace(/\D/g, '').slice(-10);
      orConditions.push({ phone: rawInput }, { mobile: rawInput });
      if (digits && digits.length === 10) {
        orConditions.push(
          { phone: digits },
          { mobile: digits },
          { phone: `+91${digits}` },
          { mobile: `+91${digits}` }
        );
      }
    }

    let user = await User.findOne({ $or: orConditions });

    if (!user) {
      const vendorDoc = await Vendor.findOne({ $or: orConditions });
      if (vendorDoc?.userId) user = await User.findById(vendorDoc.userId);
    }
    if (!user) {
      const wsDoc = await Wholesaler.findOne({ $or: orConditions });
      if (wsDoc?.userId) user = await User.findById(wsDoc.userId);
    }
    if (!user) {
      const mfDoc = await Manufacturer.findOne({ $or: orConditions });
      if (mfDoc?.userId) user = await User.findById(mfDoc.userId);
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    const redis = getRedisClient();

    // Check multiple potential keys for stored OTP
    const possibleKeys = [
      `vendor_otp:${cleanInput}`,
      `vendor_otp:${user._id.toString()}`,
      `otp:${cleanInput}`
    ];
    if (user.email) {
      possibleKeys.push(`vendor_otp:${user.email.toLowerCase()}`);
      possibleKeys.push(`otp:${user.email.toLowerCase()}`);
    }
    if (user.phone) {
      possibleKeys.push(`vendor_otp:${user.phone}`);
      possibleKeys.push(`otp:${user.phone}`);
      const d10 = user.phone.replace(/\D/g, '').slice(-10);
      if (d10) {
        possibleKeys.push(`vendor_otp:${d10}`);
        possibleKeys.push(`otp:${d10}`);
      }
    }

    let isOtpValid = false;

    for (const key of possibleKeys) {
      const saved = await redis.get(key);
      if (saved && saved.toString().trim() === otp) {
        isOtpValid = true;
        break;
      }
    }

    // Master bypass in non-production mode
    if (!isOtpValid && process.env.NODE_ENV !== 'production' && otp === '123456') {
      isOtpValid = true;
    }

    if (!isOtpValid) {
      res.status(400).json({ success: false, message: 'Invalid or expired OTP code. Please check and try again.' });
      return;
    }

    // Clear matched OTP keys
    for (const key of possibleKeys) {
      await redis.del(key).catch(() => null);
    }

    // Auto-heal vendor role if missing
    if (!Array.isArray(user.roles)) {
      user.roles = ['vendor'];
      await user.save().catch(() => null);
    } else if (!user.roles.includes('vendor') && !user.roles.includes('wholesaler') && !user.roles.includes('manufacturer') && !user.roles.includes('admin')) {
      user.roles.push('vendor');
      await user.save().catch(() => null);
    }

    const token = generateToken((user._id as any).toString(), user.email, user.roles);

    // Login Audit
    try {
      await LoginAudit.create({
        userId: user._id,
        email: user.email,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'vendor-portal',
        status: 'success'
      });
    } catch { /* silent */ }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || user.mobile || "",
        roles: user.roles,
        sellerProfile: user.sellerProfile
      }
    });
  } catch (error: any) {
    console.error('Verify Vendor OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
  }
};
