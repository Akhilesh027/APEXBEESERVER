"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProviders = exports.getDashboardData = exports.resubmitKyc = exports.updateDocument = exports.uploadKycDoc = exports.getKyc = exports.updateProfile = exports.getProfile = void 0;
const ServiceProvider_1 = require("../models/ServiceProvider");
const ServiceProviderKyc_1 = require("../models/ServiceProviderKyc");
const User_1 = require("../models/User");
const Wallet_1 = require("../models/Wallet");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
const cloudinary_1 = require("../config/cloudinary");
const fs_1 = __importDefault(require("fs"));
// Helper to calculate Profile & KYC completion percentages
const calculateCompletion = (profile, kyc) => {
    let profileScore = 0;
    let addressScore = 0;
    let bankScore = 0;
    let kycScore = 0;
    // 1. Profile Info (40% total - 8 fields, 5% each)
    const profileFields = [
        'businessName', 'ownerName', 'profilePhoto', 'email', 'mobile',
        'serviceCategory', 'experience', 'description'
    ];
    profileFields.forEach(field => {
        const val = profile[field];
        if (Array.isArray(val) ? val.length > 0 : Boolean(val)) {
            profileScore += 5;
        }
    });
    // 2. Address (20% total - 5 fields, 4% each)
    const addressFields = ['state', 'district', 'mandal', 'address', 'pincode'];
    addressFields.forEach(field => {
        if (profile[field]) {
            addressScore += 4;
        }
    });
    // 3. Bank Details (20% total - 4 fields, 5% each)
    if (profile.bankDetails) {
        const bankFields = ['accountHolderName', 'accountNumber', 'ifsc', 'bankName'];
        bankFields.forEach(field => {
            if (profile.bankDetails[field]) {
                bankScore += 5;
            }
        });
    }
    // 4. Documents & Verification Status (20% total - 10% docs uploaded, 10% Approved status)
    let docCount = 0;
    const docs = profile.documents || {};
    if (docs.aadhaarFront || (kyc && kyc.aadhaarFront))
        docCount++;
    if (docs.panCard || (kyc && kyc.panCard))
        docCount++;
    if (docs.bankProof || (kyc && kyc.bankProof))
        docCount++;
    kycScore += docCount * 3.33;
    if (kyc && kyc.verificationStatus === 'Approved') {
        kycScore += 10;
    }
    kycScore = Math.min(20, Math.round(kycScore));
    const totalCompletion = profileScore + addressScore + bankScore + kycScore;
    return {
        total: totalCompletion,
        profile: profileScore,
        address: addressScore,
        bank: bankScore,
        kyc: kycScore
    };
};
// GET /api/service-provider/profile
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        let profile = await ServiceProvider_1.ServiceProvider.findOne({ userId: req.user.id });
        if (!profile) {
            // Find corresponding User
            const user = await User_1.User.findById(req.user.id);
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            // Initialize default Service Provider profile
            const providerCode = 'SP-' + Math.floor(100000 + Math.random() * 900000);
            profile = new ServiceProvider_1.ServiceProvider({
                userId: user._id,
                providerCode,
                businessName: user.sellerProfile?.businessName || (user.name + ' Services'),
                ownerName: user.name,
                email: user.email,
                mobile: user.phone,
                address: user.sellerProfile?.addressText || 'Please Update',
                pincode: '000000',
                status: 'pending_verification'
            });
            await profile.save();
        }
        // Sync documents from ServiceProviderKyc if available
        const kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        if (kyc && profile) {
            const spDocs = profile.documents || {};
            let updated = false;
            const docFields = [
                'aadhaarFront', 'aadhaarBack', 'panCard', 'gstCertificate', 'businessLicense', 'bankProof', 'profilePhoto'
            ];
            docFields.forEach(field => {
                const kycField = field === 'businessLicense' ? 'businessRegistration' : field;
                const kycVal = kyc[kycField];
                if (kycVal && spDocs[field] !== kycVal) {
                    spDocs[field] = kycVal;
                    updated = true;
                }
            });
            if (updated) {
                profile.documents = spDocs;
                await profile.save();
            }
        }
        res.status(200).json({ success: true, profile });
    }
    catch (error) {
        console.error('Get service provider profile error:', error);
        res.status(500).json({ message: 'Server error retrieving profile', error: error.message });
    }
};
exports.getProfile = getProfile;
// PUT /api/service-provider/profile
const updateProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const updates = req.body;
        const profile = await ServiceProvider_1.ServiceProvider.findOne({ userId: req.user.id });
        if (!profile) {
            res.status(404).json({ message: 'Service Provider profile not found' });
            return;
        }
        // List of allowed fields
        const directFields = [
            'businessName', 'ownerName', 'profilePhoto', 'email', 'mobile',
            'alternateMobile', 'serviceCategory', 'serviceSubCategory', 'experience',
            'description', 'state', 'district', 'mandal', 'village', 'address',
            'pincode', 'latitude', 'longitude', 'documents', 'services'
        ];
        directFields.forEach(field => {
            if (updates[field] !== undefined) {
                if (field === 'documents') {
                    profile.documents = {
                        ...profile.documents,
                        ...updates.documents
                    };
                }
                else {
                    profile[field] = updates[field];
                }
            }
        });
        // Auto-sync unique active service categories to profile search tags
        if (updates.services) {
            const uniqueCats = Array.from(new Set(updates.services
                .filter((s) => s.active && s.category)
                .map((s) => s.category)));
            if (uniqueCats.length > 0) {
                profile.serviceCategory = uniqueCats;
            }
        }
        if (updates.bankDetails) {
            profile.bankDetails = {
                ...profile.bankDetails,
                ...updates.bankDetails
            };
        }
        const saved = await profile.save();
        // Sync back to ServiceProviderKyc
        if (updates.documents) {
            const kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
            if (kyc) {
                if (updates.documents.aadhaarFront !== undefined)
                    kyc.aadhaarFront = updates.documents.aadhaarFront;
                if (updates.documents.aadhaarBack !== undefined)
                    kyc.aadhaarBack = updates.documents.aadhaarBack;
                if (updates.documents.panCard !== undefined)
                    kyc.panCard = updates.documents.panCard;
                if (updates.documents.gstCertificate !== undefined)
                    kyc.gstCertificate = updates.documents.gstCertificate;
                if (updates.documents.businessLicense !== undefined)
                    kyc.businessRegistration = updates.documents.businessLicense;
                if (updates.documents.bankProof !== undefined)
                    kyc.bankProof = updates.documents.bankProof;
                if (updates.documents.profilePhoto !== undefined)
                    kyc.profilePhoto = updates.documents.profilePhoto;
                await kyc.save();
            }
        }
        // Trigger profile updated notification
        notificationEmitter_1.notificationEmitter.emitNotification('service_provider.profile_updated', {
            entityType: 'vendor',
            entityId: saved._id
        }, [{ userId: req.user.id, role: 'service_provider' }]);
        res.status(200).json({ success: true, message: 'Profile updated successfully', profile: saved });
    }
    catch (error) {
        console.error('Update service provider profile error:', error);
        res.status(500).json({ message: 'Server error updating profile', error: error.message });
    }
};
exports.updateProfile = updateProfile;
// GET /api/service-provider/kyc
const getKyc = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        let kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        if (!kyc) {
            kyc = new ServiceProviderKyc_1.ServiceProviderKyc({
                providerId: req.user.id,
                aadhaarFront: '',
                aadhaarBack: '',
                panCard: '',
                bankProof: '',
                professionalCertificate: '',
                gstCertificate: '',
                businessRegistration: '',
                profilePhoto: '',
                verificationStatus: 'Not Submitted'
            });
            await kyc.save();
        }
        res.status(200).json({ success: true, kyc });
    }
    catch (error) {
        console.error('Get KYC error:', error);
        res.status(500).json({ message: 'Server error retrieving KYC info', error: error.message });
    }
};
exports.getKyc = getKyc;
// POST /api/service-provider/kyc/upload
const uploadKycDoc = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { documentType } = req.body;
        let fileUrl = req.body.url;
        // Handle standard Multer file upload if available
        if (req.file) {
            try {
                const fileBuffer = fs_1.default.readFileSync(req.file.path);
                const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee-kyc');
                if (cloudinaryUrl) {
                    fs_1.default.unlinkSync(req.file.path);
                    fileUrl = cloudinaryUrl;
                }
                else {
                    fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
                }
            }
            catch (err) {
                fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }
        }
        if (!documentType) {
            res.status(400).json({ message: 'documentType is required' });
            return;
        }
        if (!fileUrl) {
            res.status(400).json({ message: 'No file uploaded or file URL provided' });
            return;
        }
        let kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        if (!kyc) {
            kyc = new ServiceProviderKyc_1.ServiceProviderKyc({
                providerId: req.user.id,
                aadhaarFront: '',
                aadhaarBack: '',
                panCard: '',
                bankProof: '',
                verificationStatus: 'Not Submitted'
            });
        }
        // Set the specific uploaded document property
        kyc[documentType] = fileUrl;
        // Determine if it should transition to Pending Verification
        const requiredDocs = ['aadhaarFront', 'aadhaarBack', 'panCard', 'bankProof'];
        const hasAllRequired = requiredDocs.every(docKey => Boolean(kyc[docKey]));
        if (hasAllRequired) {
            kyc.verificationStatus = 'Pending Verification';
            kyc.submittedAt = new Date();
            // Trigger notification for KYC submitted
            notificationEmitter_1.notificationEmitter.emitNotification('service_provider.kyc_updated', {
                entityType: 'vendor',
                entityId: kyc._id
            }, [{ userId: req.user.id, role: 'service_provider' }]);
        }
        await kyc.save();
        // Sync to ServiceProvider profile documents
        const profile = await ServiceProvider_1.ServiceProvider.findOne({ userId: req.user.id });
        if (profile) {
            const docs = profile.documents || {};
            docs[documentType] = fileUrl;
            profile.documents = docs;
            await profile.save();
        }
        res.status(200).json({ success: true, message: 'Document uploaded successfully', kyc });
    }
    catch (error) {
        console.error('Upload KYC doc error:', error);
        res.status(500).json({ message: 'Server error uploading KYC document', error: error.message });
    }
};
exports.uploadKycDoc = uploadKycDoc;
// PUT /api/service-provider/document/:type
const updateDocument = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const { type } = req.params;
        let fileUrl = req.body.url;
        if (req.file) {
            try {
                const fileBuffer = fs_1.default.readFileSync(req.file.path);
                const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee-kyc');
                if (cloudinaryUrl) {
                    fs_1.default.unlinkSync(req.file.path);
                    fileUrl = cloudinaryUrl;
                }
                else {
                    fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
                }
            }
            catch (err) {
                fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }
        }
        if (!fileUrl) {
            res.status(400).json({ message: 'No file uploaded or file URL provided' });
            return;
        }
        let kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        if (!kyc) {
            kyc = new ServiceProviderKyc_1.ServiceProviderKyc({
                providerId: req.user.id,
                verificationStatus: 'Not Submitted'
            });
        }
        // Set the specific uploaded document property
        kyc[type] = fileUrl;
        // Determine if it should transition to Pending Verification
        const requiredDocs = ['aadhaarFront', 'aadhaarBack', 'panCard', 'bankProof'];
        const hasAllRequired = requiredDocs.every(docKey => Boolean(kyc[docKey]));
        if (hasAllRequired) {
            kyc.verificationStatus = 'Pending Verification';
            kyc.submittedAt = new Date();
            // Trigger notification for KYC submitted
            notificationEmitter_1.notificationEmitter.emitNotification('service_provider.kyc_updated', {
                entityType: 'vendor',
                entityId: kyc._id
            }, [{ userId: req.user.id, role: 'service_provider' }]);
        }
        await kyc.save();
        // Sync to ServiceProvider profile documents
        const profile = await ServiceProvider_1.ServiceProvider.findOne({ userId: req.user.id });
        if (profile) {
            const docs = profile.documents || {};
            docs[type] = fileUrl;
            profile.documents = docs;
            await profile.save();
        }
        res.status(200).json({ success: true, message: 'Document uploaded and synced successfully', kyc });
    }
    catch (error) {
        console.error('Update document error:', error);
        res.status(500).json({ message: 'Server error updating document', error: error.message });
    }
};
exports.updateDocument = updateDocument;
// PUT /api/service-provider/kyc/resubmit
const resubmitKyc = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        if (!kyc) {
            res.status(404).json({ message: 'KYC record not found' });
            return;
        }
        kyc.verificationStatus = 'Pending Verification';
        kyc.remarks = '';
        kyc.submittedAt = new Date();
        await kyc.save();
        res.status(200).json({ success: true, message: 'KYC resubmitted successfully', kyc });
    }
    catch (error) {
        console.error('Resubmit KYC error:', error);
        res.status(500).json({ message: 'Server error resubmitting KYC', error: error.message });
    }
};
exports.resubmitKyc = resubmitKyc;
// GET /api/service-provider/dashboard
const getDashboardData = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const profile = await ServiceProvider_1.ServiceProvider.findOne({ userId: req.user.id });
        const kyc = await ServiceProviderKyc_1.ServiceProviderKyc.findOne({ providerId: req.user.id });
        const wallet = await Wallet_1.Wallet.findOne({ userId: req.user.id });
        // Calculate completions
        const completions = profile
            ? calculateCompletion(profile, kyc)
            : { total: 0, profile: 0, address: 0, bank: 0, kyc: 0 };
        const availableBalance = wallet ? wallet.availableBalance : 0;
        const pendingBalance = wallet ? wallet.pendingBalance : 0;
        res.status(200).json({
            success: true,
            stats: {
                profileCompletion: completions.total,
                kycCompletion: kyc && kyc.verificationStatus === 'Approved' ? 100 : (kyc ? 50 : 0),
                verificationStatus: kyc ? kyc.verificationStatus : 'Not Submitted',
                totalServices: profile && profile.serviceCategory ? profile.serviceCategory.length : 0,
                totalBookings: 0,
                pendingBookings: 0,
                completedJobs: 0,
                walletBalance: availableBalance,
                pendingEarnings: pendingBalance,
                customerRating: 4.8 // Standard default or average rating
            }
        });
    }
    catch (error) {
        console.error('Get service provider dashboard stats error:', error);
        res.status(500).json({ message: 'Server error retrieving dashboard data', error: error.message });
    }
};
exports.getDashboardData = getDashboardData;
// GET /api/service-provider/public/list  — No auth required
const listProviders = async (req, res) => {
    try {
        const totalCount = await ServiceProvider_1.ServiceProvider.countDocuments();
        if (totalCount === 0) {
            await ServiceProvider_1.ServiceProvider.create([
                {
                    userId: "64f1a2b3c4d5e6f7a8b9c0d1",
                    providerCode: "SP-HYD-101",
                    businessName: "Apex Cool Care AC & Appliance Repair",
                    ownerName: "Rajesh Kumar",
                    profilePhoto: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=80&w=400",
                    serviceCategory: ["Appliance Repair"],
                    serviceSubCategory: ["AC Servicing", "Gas Charging", "Refrigerator Repair"],
                    experience: "7+ Years",
                    description: "Certified AC & refrigerator repair specialists. 90 days service warranty with original spare parts replacement.",
                    district: "Hyderabad",
                    mandal: "Jubilee Hills",
                    address: "Road No 36, Jubilee Hills, Hyderabad",
                    pincode: "500033",
                    status: "active",
                    availability: {
                        weeklySchedule: [
                            { day: "Monday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Tuesday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Wednesday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Thursday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Friday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Saturday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Sunday", active: true, start: "09:00 AM", end: "06:00 PM" },
                        ],
                        emergencyActive: true,
                        holidays: [],
                    },
                    services: [
                        { id: "s1", name: "Split AC Servicing & Jet Cleaning", category: "Appliance Repair", type: "On-site", price: 599, discountPrice: 399, duration: "45 mins", active: true, included: ["Jet High Pressure Washing", "Gas Check", "Filter Cleaning"] },
                        { id: "s2", name: "AC Gas Refill (R32 / R410a)", category: "Appliance Repair", type: "On-site", price: 2499, discountPrice: 1999, duration: "60 mins", active: true, included: ["Full Gas Charging", "Leakage Testing"] },
                        { id: "s3", name: "Refrigerator Cooling Repair", category: "Appliance Repair", type: "On-site", price: 499, discountPrice: 349, duration: "30 mins", active: true, included: ["Thermostat Check", "Compressor Inspection"] },
                    ],
                },
                {
                    userId: "64f1a2b3c4d5e6f7a8b9c0d2",
                    providerCode: "SP-HYD-102",
                    businessName: "VoltMasters Electrical Solutions",
                    ownerName: "Suresh Reddy",
                    profilePhoto: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?q=80&w=400",
                    serviceCategory: ["Electrical Work"],
                    serviceSubCategory: ["Wiring", "MCB Repair", "Fan Fitting"],
                    experience: "10+ Years",
                    description: "Licensed master electricians for home wiring, short circuit troubleshooting, MCB replacement, and heavy appliance installation.",
                    district: "Hyderabad",
                    mandal: "Banjara Hills",
                    address: "Road No 12, Banjara Hills, Hyderabad",
                    pincode: "500034",
                    status: "active",
                    availability: {
                        weeklySchedule: [
                            { day: "Monday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Tuesday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Wednesday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Thursday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Friday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Saturday", active: true, start: "08:00 AM", end: "09:00 PM" },
                            { day: "Sunday", active: true, start: "09:00 AM", end: "05:00 PM" },
                        ],
                        emergencyActive: true,
                        holidays: [],
                    },
                    services: [
                        { id: "s4", name: "Short Circuit & MCB Repair", category: "Electrical Work", type: "On-site", price: 399, discountPrice: 249, duration: "30 mins", active: true, included: ["Diagnostic Check", "Fuse Replacement"] },
                        { id: "s5", name: "Ceiling Fan & Light Fitting", category: "Electrical Work", type: "On-site", price: 199, discountPrice: 149, duration: "20 mins", active: true, included: ["Unboxing & Assembly", "Secure Mounting"] },
                        { id: "s6", name: "Complete Room Re-Wiring", category: "Electrical Work", type: "On-site", price: 1499, discountPrice: 1199, duration: "120 mins", active: true, included: ["Concealed Piping", "Heavy Duty Switches"] },
                    ],
                },
                {
                    userId: "64f1a2b3c4d5e6f7a8b9c0d3",
                    providerCode: "SP-HYD-103",
                    businessName: "HydroFix Plumbing & Leak Detection",
                    ownerName: "Venkat Naidu",
                    profilePhoto: "https://images.unsplash.com/photo-1607472586893-edb57cbbea42?q=80&w=400",
                    serviceCategory: ["Plumbing"],
                    serviceSubCategory: ["Tap Leakage", "Drainage", "Geyser Fitting"],
                    experience: "8+ Years",
                    description: "Expert plumbers for tap leak repairs, pipe fitting, flush tank repair, and bathroom sanitary installations.",
                    district: "Hyderabad",
                    mandal: "Madhapur",
                    address: "Hitech City Main Road, Madhapur, Hyderabad",
                    pincode: "500081",
                    status: "active",
                    availability: {
                        weeklySchedule: [
                            { day: "Monday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Tuesday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Wednesday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Thursday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Friday", active: true, start: "09:00 AM", end: "08:00 PM" },
                            { day: "Saturday", active: true, start: "09:00 AM", end: "08:00 PM" },
                        ],
                        emergencyActive: true,
                        holidays: [],
                    },
                    services: [
                        { id: "s7", name: "Tap Leakage & Valve Fitting", category: "Plumbing", type: "On-site", price: 299, discountPrice: 199, duration: "25 mins", active: true, included: ["Washer Replacement", "Sealing Tape Application"] },
                        { id: "s8", name: "Drainage Unblocking & Jet Drain", category: "Plumbing", type: "On-site", price: 699, discountPrice: 499, duration: "45 mins", active: true, included: ["Pressure Jetting", "Blockage Removal"] },
                        { id: "s9", name: "Water Heater Geyser Installation", category: "Plumbing", type: "On-site", price: 499, discountPrice: 349, duration: "40 mins", active: true, included: ["Inlet Outlet Connection", "Safety Valve Test"] },
                    ],
                },
                {
                    userId: "64f1a2b3c4d5e6f7a8b9c0d4",
                    providerCode: "SP-HYD-104",
                    businessName: "CleanZone Deep Home Hygiene",
                    ownerName: "Priya Sharma",
                    profilePhoto: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=400",
                    serviceCategory: ["Home Cleaning"],
                    serviceSubCategory: ["Full House", "Sofa Cleaning", "Kitchen Deep Clean"],
                    experience: "6+ Years",
                    description: "Professional full home deep cleaning, sofa sanitization, kitchen degreasing, and eco-friendly chemical treatment.",
                    district: "Hyderabad",
                    mandal: "Gachibowli",
                    address: "Financial District, Gachibowli, Hyderabad",
                    pincode: "500032",
                    status: "active",
                    availability: {
                        weeklySchedule: [
                            { day: "Monday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Tuesday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Wednesday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Thursday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Friday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Saturday", active: true, start: "08:00 AM", end: "07:00 PM" },
                            { day: "Sunday", active: true, start: "08:00 AM", end: "05:00 PM" },
                        ],
                        emergencyActive: false,
                        holidays: [],
                    },
                    services: [
                        { id: "s10", name: "Full House Deep Cleaning (2 BHK)", category: "Home Cleaning", type: "On-site", price: 3499, discountPrice: 2499, duration: "240 mins", active: true, included: ["Floor Scrubbing", "Window Wiping", "Bathroom Disinfection"] },
                        { id: "s11", name: "Sofa & Upholstery Shampooing", category: "Home Cleaning", type: "On-site", price: 999, discountPrice: 749, duration: "60 mins", active: true, included: ["Foam Extraction", "Stain Removal"] },
                    ],
                },
            ]);
        }
        const { q = '', category = '', district = '', mandal = '', emergency, page = '1', limit = '20' } = req.query;
        const filter = {
            status: { $in: ['active', 'verified'] }
        };
        if (q) {
            filter['$or'] = [
                { businessName: { $regex: q, $options: 'i' } },
                { ownerName: { $regex: q, $options: 'i' } },
                { serviceCategory: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } }
            ];
        }
        if (category) {
            filter['$or'] = [
                { serviceCategory: { $in: [new RegExp(category, 'i')] } },
                { 'services.category': { $regex: category, $options: 'i' } }
            ];
        }
        if (district)
            filter.district = { $regex: district, $options: 'i' };
        if (mandal)
            filter.mandal = { $regex: mandal, $options: 'i' };
        if (emergency === 'true')
            filter['availability.emergencyActive'] = true;
        const skip = (Number(page) - 1) * Number(limit);
        const total = await ServiceProvider_1.ServiceProvider.countDocuments(filter);
        const providers = await ServiceProvider_1.ServiceProvider.find(filter)
            .select('businessName ownerName profilePhoto serviceCategory serviceSubCategory experience description district mandal address pincode availability services status providerCode userId')
            .skip(skip)
            .limit(Number(limit))
            .lean();
        res.json({ success: true, total, page: Number(page), providers });
    }
    catch (error) {
        console.error('listProviders error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.listProviders = listProviders;
