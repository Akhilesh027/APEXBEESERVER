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
            filter.serviceCategory = { $in: [new RegExp(category, 'i')] };
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
