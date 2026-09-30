import { Request, Response } from 'express';
import mongoose from 'mongoose';
import getRedisClient from '../config/redis';
import Category from '../models/Category';
import { StateMaster } from '../models/StateMaster';
import { DistrictMaster } from '../models/DistrictMaster';
import { MandalMaster } from '../models/MandalMaster';
import AcademyInterestLead from '../models/AcademyInterestLead';
import AcademyLeadActivity from '../models/AcademyLeadActivity';
import AnalyticsEvent from '../models/AnalyticsEvent';
import Counter from '../models/Counter';
import { NotificationService } from '../modules/notifications/services/notificationService';
import { User } from '../models/User';

// Helper to normalize phone number to standard last 10 digits
export const normalizePhone = (mobile: string): string => {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  return digits.slice(-10);
};

// Check if static OTP is allowed based on env
export const allowStaticOtp = (): boolean => {
  return process.env.NODE_ENV !== 'production';
};

// Generate concurrency-safe unique lead ID
export const generateLeadId = async (): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { id: 'academy_lead' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const padSeq = String(counter.seq).padStart(6, '0');
  return `ACA-2026-${padSeq}`;
};

export const getAcademyConfig = async (_req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        comingSoon: true,
        leadCaptureEnabled: true,
        purchaseEnabled: false,
        subcategories: [
          {
            name: 'Become an Entrepreneur',
            slug: 'become-an-entrepreneur',
          },
          {
            name: 'Skill Development',
            slug: 'skill-development',
          },
        ],
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAcademyInterests = async (_req: Request, res: Response) => {
  try {
    const entrepreneur = [
      { value: 'start_apexbee_business', label: 'Start an ApexBee Business' },
      { value: 'open_local_store', label: 'Open a Local Store' },
      { value: 'become_vendor', label: 'Become an ApexBee Vendor' },
      { value: 'franchise_partner', label: 'Become a Franchise Partner' },
      { value: 'delivery_partner', label: 'Become a Delivery Partner' },
      { value: 'service_business', label: 'Start a Service Business' },
      { value: 'wholesaler', label: 'Become a Wholesaler' },
      { value: 'business_training', label: 'Business Management Training' },
      { value: 'digital_marketing_training', label: 'Digital Marketing Training' },
      { value: 'pos_store_training', label: 'POS and Store Management Training' },
      { value: 'sales_customer_service', label: 'Sales and Customer Service Training' },
      { value: 'financial_business_planning', label: 'Financial and Business Planning' },
    ];

    const skill = [
      { value: 'digital_marketing', label: 'Digital Marketing' },
      { value: 'graphic_design', label: 'Graphic Design' },
      { value: 'web_development', label: 'Web Development' },
      { value: 'app_development', label: 'App Development' },
      { value: 'retail_pos_operations', label: 'Retail and POS Operations' },
      { value: 'sales_customer_service', label: 'Sales and Customer Service' },
      { value: 'beauty_salon', label: 'Beauty and Salon Skills' },
      { value: 'appliance_technician', label: 'Home Appliance Technician Training' },
      { value: 'cleaning_housekeeping', label: 'Cleaning and Housekeeping Skills' },
      { value: 'food_business', label: 'Food Business Training' },
      { value: 'tailoring_fashion', label: 'Tailoring and Fashion Skills' },
      { value: 'laundry_garment_care', label: 'Laundry and Garment Care Skills' },
      { value: 'agriculture_farming', label: 'Agriculture and Farming Skills' },
      { value: 'entrepreneurship', label: 'Entrepreneurship Development' },
      { value: 'delivery_logistics', label: 'Delivery and Logistics Skills' },
    ];

    res.status(200).json({ success: true, entrepreneur, skill });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const sendAcademyOtp = async (req: Request, res: Response) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const normalized = normalizePhone(mobile);
    if (normalized.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const redis = getRedisClient();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // 1. IP & Mobile Rate limits / Cooldowns
    const cooldownKey = `academy:cooldown:${normalized}`;
    const rateLimitIpKey = `rl:academy_otp:ip:${ip}`;
    const rateLimitMobileKey = `rl:academy_otp:mobile:${normalized}`;

    const cooldown = await redis.get(cooldownKey);
    if (cooldown) {
      return res.status(429).json({ success: false, message: 'Resend cooldown active. Please wait 60 seconds.' });
    }

    const ipLimit = await redis.get(rateLimitIpKey);
    if (ipLimit && Number(ipLimit) >= 5) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests from this IP. Please try again later.' });
    }

    const mobileLimit = await redis.get(rateLimitMobileKey);
    if (mobileLimit && Number(mobileLimit) >= 5) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests for this mobile number. Please try again later.' });
    }

    // 2. Generate random 6-digit code and token
    const verificationToken = new mongoose.Types.ObjectId().toString();
    const otpCode = String(100000 + Math.floor(Math.random() * 900000));

    // 3. Save to Redis (5 minutes expiry)
    const redisKey = `academy:otp:${normalized}:${verificationToken}`;
    await redis.set(redisKey, JSON.stringify({ code: otpCode, attempts: 0 }), 'EX', 300);

    // Set cooldown & rate limits
    await redis.set(cooldownKey, 'true', 'EX', 60);

    const ipPipeline = redis.multi();
    ipPipeline.incr(rateLimitIpKey);
    if (!ipLimit) ipPipeline.expire(rateLimitIpKey, 60);
    await ipPipeline.exec();

    const mobilePipeline = redis.multi();
    mobilePipeline.incr(rateLimitMobileKey);
    if (!mobileLimit) mobilePipeline.expire(rateLimitMobileKey, 60);
    await mobilePipeline.exec();

    console.log(`[Academy OTP] Token: ${verificationToken}, OTP: ${otpCode} sent to ${normalized}`);
    res.status(200).json({ success: true, verificationToken, message: 'OTP sent successfully' });
  } catch (error: any) {
    console.error('[Academy sendAcademyOtp] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
  }
};

export const verifyAcademyOtp = async (req: Request, res: Response) => {
  try {
    const { mobile, verificationToken, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
    }

    const normalized = normalizePhone(mobile);
    const redis = getRedisClient();
    if (!verificationToken) {
      return res.status(400).json({ success: false, message: 'verificationToken is required' });
    }

    const redisKey = `academy:otp:${normalized}:${verificationToken}`;

    const value = await redis.get(redisKey);
    if (!value) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid token' });
    }

    const parsed = JSON.parse(value);
    parsed.attempts++;

    if (parsed.attempts > 3) {
      await redis.del(redisKey);
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    if (otp === parsed.code) {
      // Success: Save verified status for 10 minutes, remove OTP session
      const verifiedKey = `academy:verified:${normalized}`;
      await redis.set(verifiedKey, 'true', 'EX', 600);
      await redis.del(redisKey);
      res.status(200).json({ success: true, message: 'OTP verified successfully' });
    } else {
      await redis.set(redisKey, JSON.stringify(parsed), 'EX', 300);
      res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }
  } catch (error: any) {
    console.error('[Academy verifyAcademyOtp] Error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
  }
};

export const createAcademyLead = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const authUser = (req as any).user;
    const userId = authUser ? authUser.id || authUser._id : undefined;

    // Filter administrative fields from public requests
    const {
      fullName,
      mobile,
      verificationToken,
      email,
      interestType,
      selectedInterests,
      stateId,
      districtId,
      mandalId,
      city,
      pincode,
      preferredLanguage,
      preferredContactMethod,
      occupation,
      qualification,
      employmentStatus,
      businessExperience,
      investmentRange,
      ownBusinessLocation,
      preferredBusinessLocation,
      expectedStartTimeline,
      learningMode,
      experienceLevel,
      preferredSchedule,
      certificationRequired,
      jobAssistanceRequired,
      source,
      campaignSource,
      campaignMedium,
      campaignName,
      consentAccepted,
      consentVersion,
    } = req.body;

    // Validations
    if (!fullName || !mobile || !interestType || !selectedInterests || selectedInterests.length === 0 || !consentAccepted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(422).json({ success: false, message: 'Validation failed: Required fields missing.' });
    }

    if (interestType !== 'become_entrepreneur' && interestType !== 'skill_development') {
      await session.abortTransaction();
      session.endSession();
      return res.status(422).json({ success: false, message: 'Validation failed: Invalid interest type.' });
    }

    const normalized = normalizePhone(mobile);

    // OTP verification check
    const redis = getRedisClient();
    const verifiedKey = `academy:verified:${normalized}`;
    let isVerified = false;

    // Prefill verification bypass if logged-in user phone matches normalized mobile
    if (authUser && normalizePhone(authUser.phone) === normalized) {
      isVerified = true;
    } else {
      const isVerifiedToken = await redis.get(verifiedKey);
      isVerified = isVerifiedToken === 'true';
    }

    if (!isVerified) {
      await session.abortTransaction();
      session.endSession();
      return res.status(422).json({ success: false, message: 'Validation failed: Mobile number verification is pending.' });
    }

    // Clean verification token
    await redis.del(verifiedKey);

    // Duplicate Lead Protection (24-hour window checks)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingLead = await AcademyInterestLead.findOne({
      normalizedMobile: normalized,
      interestType,
      createdAt: { $gte: oneDayAgo },
    }).session(session);

    if (existingLead) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        duplicate: true,
        data: {
          leadId: existingLead.leadId,
          status: existingLead.status,
          message: 'Your interest has been registered successfully.',
        },
      });
    }

    // Resolve ObjectId vs Custom Text
    const finalStateId = mongoose.Types.ObjectId.isValid(stateId) ? stateId : undefined;
    const finalDistrictId = mongoose.Types.ObjectId.isValid(districtId) ? districtId : undefined;
    const finalMandalId = mongoose.Types.ObjectId.isValid(mandalId) ? mandalId : undefined;

    const customState = !finalStateId ? stateId : undefined;
    const customDistrict = !finalDistrictId ? districtId : undefined;
    const customMandal = !finalMandalId ? mandalId : undefined;

    // Verify locations reference exists if they are valid ObjectIds
    if (finalStateId) {
      const stateExists = await StateMaster.findById(finalStateId).session(session);
      if (!stateExists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(422).json({ success: false, message: 'Validation failed: Invalid state reference.' });
      }
    }

    if (finalDistrictId) {
      const distExists = await DistrictMaster.findById(finalDistrictId).session(session);
      if (!distExists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(422).json({ success: false, message: 'Validation failed: Invalid district reference.' });
      }
    }

    if (finalMandalId) {
      const mandalExists = await MandalMaster.findById(finalMandalId).session(session);
      if (!mandalExists) {
        await session.abortTransaction();
        session.endSession();
        return res.status(422).json({ success: false, message: 'Validation failed: Invalid mandal reference.' });
      }
    }

    // Generate atomic unique leadId
    const leadId = await generateLeadId();

    const lead = new AcademyInterestLead({
      leadId,
      userId,
      fullName,
      mobile,
      normalizedMobile: normalized,
      mobileVerified: true,
      email,
      interestType,
      selectedInterests,
      stateId: finalStateId,
      districtId: finalDistrictId,
      mandalId: finalMandalId,
      customState,
      customDistrict,
      customMandal,
      city,
      pincode,
      preferredLanguage,
      preferredContactMethod,
      occupation,
      qualification,
      employmentStatus,
      businessExperience,
      investmentRange,
      ownBusinessLocation,
      preferredBusinessLocation,
      expectedStartTimeline,
      learningMode,
      experienceLevel,
      preferredSchedule,
      certificationRequired,
      jobAssistanceRequired,
      source: source || 'academy_landing',
      campaignSource,
      campaignMedium,
      campaignName,
      status: 'new',
      consentAccepted,
      consentAcceptedAt: new Date(),
      consentVersion: consentVersion || '1.0',
    });

    await lead.save({ session });

    // Audit Lead Activity log
    const activity = new AcademyLeadActivity({
      leadId: lead._id,
      action: 'created',
      performedBy: userId || lead._id, // if guest, perform by self-id
      metadata: { source: source || 'academy_landing' },
    });

    await activity.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Trigger Notification asynchronous
    try {
      const districtName = districtId ? (await DistrictMaster.findById(districtId))?.name : 'Unknown';
      
      // Dispatch in-app notice for admin
      const admins = await User.find({ roles: { $in: ['admin', 'superadmin'] } });
      for (const admin of admins) {
        await NotificationService.sendNotification(
          'academy.admin_lead_received',
          {
            interestType: interestType === 'become_entrepreneur' ? 'Become an Entrepreneur' : 'Skill Development',
            district: districtName || 'Unknown',
          },
          admin._id
        );
      }

      // If user is logged-in, send recipient notification
      if (userId) {
        await NotificationService.sendNotification(
          'academy.interest_submitted',
          { leadId },
          userId
        );
      }
    } catch (notifErr) {
      console.warn('[Academy Lead Notif] Error dispatching notifications (non-fatal):', notifErr);
    }

    res.status(201).json({
      success: true,
      data: {
        leadId,
        status: 'new',
        message: 'Your interest has been registered successfully.',
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    console.error('[Academy createAcademyLead] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyAcademyLeads = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    const leads = await AcademyInterestLead.find({ userId: authUser.id || authUser._id })
      .populate('stateId', 'name')
      .populate('districtId', 'name')
      .populate('mandalId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: leads });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const collectAcademyAnalytics = async (req: Request, res: Response) => {
  try {
    const { eventName, anonymousSessionId, metadata } = req.body;
    const authUser = (req as any).user;
    const userId = authUser ? authUser.id || authUser._id : undefined;

    const allowedEvents = [
      'academy_viewed',
      'academy_subcategory_viewed',
      'academy_interest_selected',
      'academy_form_started',
      'academy_otp_requested',
      'academy_otp_verified',
      'academy_form_submitted',
      'academy_submission_failed',
    ];

    if (!eventName || !allowedEvents.includes(eventName)) {
      return res.status(400).json({ success: false, message: 'Invalid or disallowed analytics event name.' });
    }

    // Strip sensitive fields
    const sanitizedMetadata: Record<string, any> = {};
    if (metadata && typeof metadata === 'object') {
      const sensitiveKeys = ['mobile', 'email', 'fullName', 'otp', 'code', 'adminNotes', 'notes', 'qualification', 'businessExperience'];
      Object.keys(metadata).forEach(k => {
        if (!sensitiveKeys.includes(k)) {
          sanitizedMetadata[k] = metadata[k];
        }
      });
    }

    // Add source and UTM parsing safely
    if (req.headers['user-agent']) {
      sanitizedMetadata.userAgent = req.headers['user-agent'];
    }

    const event = new AnalyticsEvent({
      namespace: 'academy',
      eventName,
      userId,
      anonymousSessionId,
      metadata: sanitizedMetadata,
    });

    await event.save();
    res.status(200).json({ success: true, message: 'Event logged successfully' });
  } catch (error: any) {
    console.error('[Academy collectAcademyAnalytics] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
