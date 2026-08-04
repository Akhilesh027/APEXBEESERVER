"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectAcademyAnalytics = exports.getMyAcademyLeads = exports.createAcademyLead = exports.verifyAcademyOtp = exports.sendAcademyOtp = exports.getAcademyInterests = exports.getAcademyConfig = exports.generateLeadId = exports.allowStaticOtp = exports.normalizePhone = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const redis_1 = __importDefault(require("../config/redis"));
const StateMaster_1 = require("../models/StateMaster");
const DistrictMaster_1 = require("../models/DistrictMaster");
const MandalMaster_1 = require("../models/MandalMaster");
const AcademyInterestLead_1 = __importDefault(require("../models/AcademyInterestLead"));
const AcademyLeadActivity_1 = __importDefault(require("../models/AcademyLeadActivity"));
const AnalyticsEvent_1 = __importDefault(require("../models/AnalyticsEvent"));
const Counter_1 = __importDefault(require("../models/Counter"));
const notificationService_1 = require("../modules/notifications/services/notificationService");
const User_1 = require("../models/User");
// Helper to normalize phone number to standard last 10 digits
const normalizePhone = (mobile) => {
    if (!mobile)
        return '';
    const digits = mobile.replace(/\D/g, '');
    return digits.slice(-10);
};
exports.normalizePhone = normalizePhone;
// Check if static OTP is allowed based on env
const allowStaticOtp = () => {
    return process.env.NODE_ENV !== 'production';
};
exports.allowStaticOtp = allowStaticOtp;
// Generate concurrency-safe unique lead ID
const generateLeadId = async () => {
    const counter = await Counter_1.default.findOneAndUpdate({ id: 'academy_lead' }, { $inc: { seq: 1 } }, { upsert: true, new: true });
    const padSeq = String(counter.seq).padStart(6, '0');
    return `ACA-2026-${padSeq}`;
};
exports.generateLeadId = generateLeadId;
const getAcademyConfig = async (_req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyConfig = getAcademyConfig;
const getAcademyInterests = async (_req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getAcademyInterests = getAcademyInterests;
const sendAcademyOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) {
            return res.status(400).json({ success: false, message: 'Mobile number is required' });
        }
        const normalized = (0, exports.normalizePhone)(mobile);
        if (normalized.length !== 10) {
            return res.status(400).json({ success: false, message: 'Invalid mobile number' });
        }
        const redis = (0, redis_1.default)();
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
        // 2. Generate random 4-digit code and token
        const verificationToken = new mongoose_1.default.Types.ObjectId().toString();
        let otpCode = '1234';
        if (!(0, exports.allowStaticOtp)()) {
            otpCode = String(1000 + Math.floor(Math.random() * 9000));
        }
        // 3. Save to Redis (5 minutes expiry)
        const redisKey = `academy:otp:${normalized}:${verificationToken}`;
        await redis.set(redisKey, JSON.stringify({ code: otpCode, attempts: 0 }), 'EX', 300);
        // Set cooldown & rate limits
        await redis.set(cooldownKey, 'true', 'EX', 60);
        const ipPipeline = redis.multi();
        ipPipeline.incr(rateLimitIpKey);
        if (!ipLimit)
            ipPipeline.expire(rateLimitIpKey, 60);
        await ipPipeline.exec();
        const mobilePipeline = redis.multi();
        mobilePipeline.incr(rateLimitMobileKey);
        if (!mobileLimit)
            mobilePipeline.expire(rateLimitMobileKey, 60);
        await mobilePipeline.exec();
        console.log(`[Academy OTP] Token: ${verificationToken}, OTP: ${otpCode} sent to ${normalized}`);
        res.status(200).json({ success: true, verificationToken, message: 'OTP sent successfully' });
    }
    catch (error) {
        console.error('[Academy sendAcademyOtp] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to send OTP', error: error.message });
    }
};
exports.sendAcademyOtp = sendAcademyOtp;
const verifyAcademyOtp = async (req, res) => {
    try {
        const { mobile, verificationToken, otp } = req.body;
        if (!mobile || !otp) {
            return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
        }
        const normalized = (0, exports.normalizePhone)(mobile);
        const redis = (0, redis_1.default)();
        // Static bypass for development / tests
        if ((0, exports.allowStaticOtp)() && otp === '1234') {
            const verifiedKey = `academy:verified:${normalized}`;
            await redis.set(verifiedKey, 'true', 'EX', 600);
            return res.status(200).json({ success: true, message: 'OTP verified successfully' });
        }
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
        }
        else {
            await redis.set(redisKey, JSON.stringify(parsed), 'EX', 300);
            res.status(400).json({ success: false, message: 'Invalid OTP code' });
        }
    }
    catch (error) {
        console.error('[Academy verifyAcademyOtp] Error:', error);
        res.status(500).json({ success: false, message: 'Failed to verify OTP', error: error.message });
    }
};
exports.verifyAcademyOtp = verifyAcademyOtp;
const createAcademyLead = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const authUser = req.user;
        const userId = authUser ? authUser.id || authUser._id : undefined;
        // Filter administrative fields from public requests
        const { fullName, mobile, verificationToken, email, interestType, selectedInterests, stateId, districtId, mandalId, city, pincode, preferredLanguage, preferredContactMethod, occupation, qualification, employmentStatus, businessExperience, investmentRange, ownBusinessLocation, preferredBusinessLocation, expectedStartTimeline, learningMode, experienceLevel, preferredSchedule, certificationRequired, jobAssistanceRequired, source, campaignSource, campaignMedium, campaignName, consentAccepted, consentVersion, } = req.body;
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
        const normalized = (0, exports.normalizePhone)(mobile);
        // OTP verification check
        const redis = (0, redis_1.default)();
        const verifiedKey = `academy:verified:${normalized}`;
        let isVerified = false;
        // Prefill verification bypass if logged-in user phone matches normalized mobile
        if (authUser && (0, exports.normalizePhone)(authUser.phone) === normalized) {
            isVerified = true;
        }
        else {
            const isVerifiedToken = await redis.get(verifiedKey);
            isVerified = isVerifiedToken === 'true';
        }
        // Static bypass for development / tests
        if (!isVerified && (0, exports.allowStaticOtp)() && req.body.otp === '1234') {
            isVerified = true;
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
        const existingLead = await AcademyInterestLead_1.default.findOne({
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
        const finalStateId = mongoose_1.default.Types.ObjectId.isValid(stateId) ? stateId : undefined;
        const finalDistrictId = mongoose_1.default.Types.ObjectId.isValid(districtId) ? districtId : undefined;
        const finalMandalId = mongoose_1.default.Types.ObjectId.isValid(mandalId) ? mandalId : undefined;
        const customState = !finalStateId ? stateId : undefined;
        const customDistrict = !finalDistrictId ? districtId : undefined;
        const customMandal = !finalMandalId ? mandalId : undefined;
        // Verify locations reference exists if they are valid ObjectIds
        if (finalStateId) {
            const stateExists = await StateMaster_1.StateMaster.findById(finalStateId).session(session);
            if (!stateExists) {
                await session.abortTransaction();
                session.endSession();
                return res.status(422).json({ success: false, message: 'Validation failed: Invalid state reference.' });
            }
        }
        if (finalDistrictId) {
            const distExists = await DistrictMaster_1.DistrictMaster.findById(finalDistrictId).session(session);
            if (!distExists) {
                await session.abortTransaction();
                session.endSession();
                return res.status(422).json({ success: false, message: 'Validation failed: Invalid district reference.' });
            }
        }
        if (finalMandalId) {
            const mandalExists = await MandalMaster_1.MandalMaster.findById(finalMandalId).session(session);
            if (!mandalExists) {
                await session.abortTransaction();
                session.endSession();
                return res.status(422).json({ success: false, message: 'Validation failed: Invalid mandal reference.' });
            }
        }
        // Generate atomic unique leadId
        const leadId = await (0, exports.generateLeadId)();
        const lead = new AcademyInterestLead_1.default({
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
        const activity = new AcademyLeadActivity_1.default({
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
            const districtName = districtId ? (await DistrictMaster_1.DistrictMaster.findById(districtId))?.name : 'Unknown';
            // Dispatch in-app notice for admin
            const admins = await User_1.User.find({ roles: { $in: ['admin', 'superadmin'] } });
            for (const admin of admins) {
                await notificationService_1.NotificationService.sendNotification('academy.admin_lead_received', {
                    interestType: interestType === 'become_entrepreneur' ? 'Become an Entrepreneur' : 'Skill Development',
                    district: districtName || 'Unknown',
                }, admin._id);
            }
            // If user is logged-in, send recipient notification
            if (userId) {
                await notificationService_1.NotificationService.sendNotification('academy.interest_submitted', { leadId }, userId);
            }
        }
        catch (notifErr) {
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
    }
    catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('[Academy createAcademyLead] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.createAcademyLead = createAcademyLead;
const getMyAcademyLeads = async (req, res) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const leads = await AcademyInterestLead_1.default.find({ userId: authUser.id || authUser._id })
            .populate('stateId', 'name')
            .populate('districtId', 'name')
            .populate('mandalId', 'name')
            .sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: leads });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.getMyAcademyLeads = getMyAcademyLeads;
const collectAcademyAnalytics = async (req, res) => {
    try {
        const { eventName, anonymousSessionId, metadata } = req.body;
        const authUser = req.user;
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
        const sanitizedMetadata = {};
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
        const event = new AnalyticsEvent_1.default({
            namespace: 'academy',
            eventName,
            userId,
            anonymousSessionId,
            metadata: sanitizedMetadata,
        });
        await event.save();
        res.status(200).json({ success: true, message: 'Event logged successfully' });
    }
    catch (error) {
        console.error('[Academy collectAcademyAnalytics] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.collectAcademyAnalytics = collectAcademyAnalytics;
