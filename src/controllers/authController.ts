import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, RoleType } from '../models/User';
import { Wallet } from '../models/Wallet';
import { Referral } from '../models/Referral';
import { LoginAudit } from '../models/LoginAudit';
import { AuthRequest } from '../middleware/auth';
import { getRedisClient } from '../config/redis';
import { generateMasterCustomerId, generateUniversalReferralCode, generateRoleReferenceId } from '../services/identityService';
import { EmailService } from '../services/emailService';
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
    const key = phone || email;
    if (!key) {
      res.status(400).json({ message: 'Phone or email is required' });
      return;
    }

    const isProd = ['production', 'staging'].includes(process.env.NODE_ENV || '');
    const generatedOtp = isProd
      ? Math.floor(100000 + Math.random() * 900000).toString()
      : '1234';

    const redis = getRedisClient();
    const redisKey = `otp:${key}`;
    await redis.set(redisKey, generatedOtp, 'EX', 300);

    console.log(`OTP generated for: ${key}`);
    res.status(200).json({ success: true, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    res.status(500).json({ message: 'Failed to send OTP', error: error.message });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email, otp } = req.body;
    const key = phone || email;
    if (!key || !otp) {
      res.status(400).json({ message: 'Phone/email and OTP are required' });
      return;
    }

    const redis = getRedisClient();
    const redisKey = `otp:${key}`;
    const savedOtp = await redis.get(redisKey);
    const isDevFallback = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging' && otp === '1234';

    if (savedOtp === otp || isDevFallback) {
      const verifiedKey = `verified:${key}`;
      await redis.set(verifiedKey, 'true', 'EX', 600);
      await redis.del(redisKey);
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
    const isDevFallback = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging' && otp === '1234';
    const isOtpVerified = isVerifiedPhone === 'true' || isVerifiedEmail === 'true' || isDevFallback;
    if (!isOtpVerified) {
      res.status(400).json({ message: 'Phone/email verification is pending. Please verify OTP first.' });
      return;
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { phone }] });
    if (userExists) {
      res.status(400).json({ message: 'User with this email or phone already exists' });
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

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select('+passwordHash');

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

      user = new User({
        name,
        email,
        passwordHash: hashedPassword,
        roles: ['customer'],
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

          const refDoc = new Referral({
            referrerId: referrer._id,
            referredUserId: user._id,
            referralCode: referrer.referralCode,
            status: 'registered',
            reward: 50
          });
          await refDoc.save();
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
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) {
      res.status(400).json({ success: false, message: 'Please enter your email address.' });
      return;
    }

    // 1. Check if user exists with this email
    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({
        success: false,
        isRegistered: false,
        message: 'You are not registered. Please register or apply for a seller account first.'
      });
      return;
    }

    // 2. Check if user has vendor/seller profile or role
    const userRoles = Array.isArray(user.roles) ? user.roles.map(r => String(r).toLowerCase()) : [];
    const permittedRoles = ['vendor', 'wholesaler', 'manufacturer', 'admin', 'food_partner', 'service_provider'];
    const hasVendorRole = userRoles.some(r => permittedRoles.includes(r));

    if (!hasVendorRole) {
      res.status(403).json({
        success: false,
        isRegistered: true,
        hasVendorRole: false,
        message: 'Your account is registered as a customer, but not approved as a vendor yet. Please apply in Earn with ApexBee.'
      });
      return;
    }

    // 3. Generate 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    const redis = getRedisClient();
    const redisKey = `vendor_otp:${email}`;
    await redis.set(redisKey, generatedOtp, 'EX', 600); // 10 minutes

    // 4. Send Email via Hostinger SMTP
    console.log(`[VENDOR LOGIN OTP] Generated OTP for ${email}: ${generatedOtp}`);
    const emailSent = await EmailService.sendVendorLoginOtp(email, generatedOtp, user.name);

    if (!emailSent) {
      console.warn(`[VENDOR LOGIN OTP] Direct SMTP delivery encountered an issue; OTP is active in system: ${generatedOtp}`);
    }

    res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${email}.`,
      devOtp: process.env.NODE_ENV !== 'production' ? generatedOtp : undefined
    });
  } catch (error: any) {
    console.error('Send Vendor Login OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP email', error: error.message });
  }
};

export const verifyVendorLoginOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();

    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
      return;
    }

    const redis = getRedisClient();
    const redisKey = `vendor_otp:${email}`;
    const savedOtp = await redis.get(redisKey);
    const isDevFallback = process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'staging' && otp === '1234';

    if (!savedOtp && !isDevFallback) {
      res.status(400).json({ success: false, message: 'OTP has expired or was not requested. Please request a new OTP.' });
      return;
    }

    if (savedOtp !== otp && !isDevFallback) {
      res.status(400).json({ success: false, message: 'Invalid OTP code. Please check your email and try again.' });
      return;
    }

    // Clear used OTP
    await redis.del(redisKey);

    const user = await User.findOne({ email });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
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
