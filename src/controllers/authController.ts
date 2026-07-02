import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, RoleType } from '../models/User';
import { Wallet } from '../models/Wallet';
import { Referral } from '../models/Referral';
import { LoginAudit } from '../models/LoginAudit';
import { AuthRequest } from '../middleware/auth';

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

// Temporary in-memory OTP stores
const otpStore = new Map<string, string>();
const verifiedUsers = new Map<string, boolean>();

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, email } = req.body;
    const key = phone || email;
    if (!key) {
      res.status(400).json({ message: 'Phone or email is required' });
      return;
    }

    // Always use '1234' for temporary OTP system
    otpStore.set(key, '1234');
    
    console.log(`OTP "1234" sent to: ${key}`);
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

    const savedOtp = otpStore.get(key);
    if (otp === '1234' || savedOtp === otp) {
      verifiedUsers.set(key, true);
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
    const isOtpVerified = verifiedUsers.get(phone) || verifiedUsers.get(email) || (otp === '1234');
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

    const generatedReferralCode = await generateReferralCode(name);

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
    verifiedUsers.delete(phone);
    verifiedUsers.delete(email);

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        _id: savedUser._id,
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
        referralCode: savedUser.referralCode
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

    if (user.status && user.status !== 'active') {
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

