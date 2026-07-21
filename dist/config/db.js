"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const ServiceProviderKyc_1 = require("../models/ServiceProviderKyc");
const ServiceProvider_1 = require("../models/ServiceProvider");
const env_1 = require("./env");
const migrateServiceProviders = async () => {
    try {
        const providers = await ServiceProvider_1.ServiceProvider.find({ providerCode: { $exists: false } });
        let updatedCount = 0;
        for (const sp of providers) {
            if (!sp.providerCode) {
                let code = '';
                let exists = true;
                while (exists) {
                    code = 'SP-' + Math.floor(100000 + Math.random() * 900000);
                    const dupe = await ServiceProvider_1.ServiceProvider.findOne({ providerCode: code });
                    if (!dupe)
                        exists = false;
                }
                sp.providerCode = code;
                await sp.save();
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`Successfully migrated and added providerCode to ${updatedCount} ServiceProvider records.`);
        }
        else {
            console.log('All ServiceProvider records have a providerCode.');
        }
    }
    catch (error) {
        console.error('Error migrating ServiceProviders:', error);
    }
};
const migrateServiceProviderKycs = async () => {
    try {
        const kycs = await ServiceProviderKyc_1.ServiceProviderKyc.find({
            $or: [
                { documents: { $exists: false } },
                { documents: { $size: 0 } }
            ]
        });
        let updatedCount = 0;
        for (const kyc of kycs) {
            const originalAadhaarFront = kyc.aadhaarFront;
            const originalAadhaarBack = kyc.aadhaarBack;
            const originalPanCard = kyc.panCard;
            const originalBankProof = kyc.bankProof;
            const originalGstCertificate = kyc.gstCertificate;
            const originalBusinessRegistration = kyc.businessRegistration;
            const originalDocsJson = JSON.stringify(kyc.documents || []);
            (0, ServiceProviderKyc_1.syncKycFields)(kyc);
            const hasChanged = kyc.aadhaarFront !== originalAadhaarFront ||
                kyc.aadhaarBack !== originalAadhaarBack ||
                kyc.panCard !== originalPanCard ||
                kyc.bankProof !== originalBankProof ||
                kyc.gstCertificate !== originalGstCertificate ||
                kyc.businessRegistration !== originalBusinessRegistration ||
                JSON.stringify(kyc.documents || []) !== originalDocsJson;
            if (hasChanged) {
                await kyc.save();
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`Successfully migrated and synced ${updatedCount} ServiceProviderKyc records.`);
        }
        else {
            console.log('All ServiceProviderKyc records are already in sync.');
        }
    }
    catch (error) {
        console.error('Error migrating ServiceProviderKycs:', error);
    }
};
const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@apexmarket.in';
        const existingAdmin = await User_1.User.findOne({ email: adminEmail });
        if (!existingAdmin) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash('admin123', salt);
            const adminUser = new User_1.User({
                name: 'Super Admin',
                email: adminEmail,
                passwordHash,
                phone: '9999999999',
                mobile: '9999999999',
                roles: ['admin', 'customer'],
                status: 'active',
                isVerified: true
            });
            await adminUser.save();
            console.log('Super Admin user seeded successfully! (admin@apexmarket.in / admin123)');
        }
        else {
            console.log('Super Admin user exists or already seeded.');
        }
    }
    catch (error) {
        console.error('Error seeding admin user:', error);
    }
};
const connectDB = async () => {
    const mongoURI = env_1.env.MONGODB_URI;
    const match = mongoURI.match(/\/([^/?]+)(\?|$)/);
    const dbName = match ? match[1] : 'default';
    console.log(`[Database] NODE_ENV: ${env_1.env.NODE_ENV}`);
    console.log(`[Database] Attempting connection to DB: ${dbName}`);
    // Prevent non-prod environments from using prod databases
    if (env_1.env.NODE_ENV !== 'production') {
        const isProdDb = dbName.toLowerCase().includes('prod') ||
            mongoURI.toLowerCase().includes('production') ||
            mongoURI.toLowerCase().includes('prod-');
        if (isProdDb && process.env.ALLOW_PROD_DB_IN_DEV !== 'true') {
            console.error(`[SECURITY ERROR] Attempted to connect to production database "${dbName}" in non-production mode (${env_1.env.NODE_ENV}). Connection aborted.`);
            process.exit(1);
        }
    }
    try {
        console.log('Connecting to MongoDB Atlas...');
        await mongoose_1.default.connect(mongoURI, {
            serverSelectionTimeoutMS: 15000,
            maxPoolSize: env_1.env.MONGODB_MAX_POOL_SIZE,
            minPoolSize: env_1.env.MONGODB_MIN_POOL_SIZE,
            maxConnecting: env_1.env.MONGODB_MAX_CONNECTING,
            waitQueueTimeoutMS: env_1.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
        });
        console.log(`MongoDB Atlas connected successfully to database "${dbName}"!`);
        if (process.env.NODE_APP_INSTANCE === undefined || process.env.NODE_APP_INSTANCE === '0') {
            await seedAdmin();
            await migrateServiceProviders();
            await migrateServiceProviderKycs();
        }
        else {
            console.log(`[Database] Skipping admin/service provider seeding/migrations on clustered instance ${process.env.NODE_APP_INSTANCE}`);
        }
    }
    catch (error) {
        console.error('MongoDB Atlas connection failed:', error);
        console.error('Server stopped to prevent using wrong/local database.');
        process.exit(1);
    }
};
exports.connectDB = connectDB;
