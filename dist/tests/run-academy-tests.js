"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Category_1 = __importDefault(require("../models/Category"));
const CategoryExperienceConfig_1 = __importDefault(require("../models/CategoryExperienceConfig"));
const AcademyInterestLead_1 = __importDefault(require("../models/AcademyInterestLead"));
const AcademyLeadActivity_1 = __importDefault(require("../models/AcademyLeadActivity"));
const AcademyAdminAudit_1 = __importDefault(require("../models/AcademyAdminAudit"));
const AnalyticsEvent_1 = __importDefault(require("../models/AnalyticsEvent"));
const User_1 = require("../models/User");
const seedAcademyTaxonomy_1 = require("../seeds/seedAcademyTaxonomy");
const verifyAcademyTaxonomy_1 = require("../seeds/verifyAcademyTaxonomy");
const redis_1 = __importDefault(require("../config/redis"));
dotenv_1.default.config();
let passed = 0;
let failed = 0;
const assert = (condition, msg) => {
    if (condition) {
        console.log(`  ✅ PASS: ${msg}`);
        passed++;
    }
    else {
        console.error(`  ❌ FAIL: ${msg}`);
        failed++;
    }
};
const API_BASE = 'http://127.0.0.1:5500/api';
const generateToken = (userId, email, roles) => {
    return jsonwebtoken_1.default.sign({ id: userId, email, roles }, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork', { expiresIn: '1h' });
};
const runTests = async () => {
    console.log('=====================================================================');
    console.log('[Test Suite] ApexBee Academy Module Integration & Validation Tests');
    console.log('=====================================================================');
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose_1.default.connect(mongoURI);
    console.log('Connected to MongoDB.');
    const redis = (0, redis_1.default)();
    // 1. Seed Academy Vertical
    console.log('\n--- 1. Seeding Academy Vertical ---');
    await (0, seedAcademyTaxonomy_1.seedAcademyTaxonomy)();
    const verifyRes = await (0, verifyAcademyTaxonomy_1.verifyAcademyTaxonomy)();
    assert(verifyRes.passed, 'Seeding verification reports passed');
    assert(verifyRes.parentCount === 1, 'Academy Parent count is 1');
    assert(verifyRes.subCount === 2, 'Academy Subcategory count is 2');
    assert(verifyRes.configCount === 3, 'Category Experience Config count is 3');
    // 2. Fetch category tree & dropdown API checks
    console.log('\n--- 2. Category tree and dropdown APIs ---');
    const parentCat = await Category_1.default.findOne({ slug: 'apexbee-academy' });
    assert(!!parentCat, 'Academy parent category resolved in DB');
    const config = await CategoryExperienceConfig_1.default.findOne({ categoryId: parentCat?._id });
    assert(!!config, 'Academy experience config resolved');
    assert(config?.experienceType === 'coming_soon_lead_capture', 'Parent experienceType matches coming_soon_lead_capture');
    assert(config?.productCreationEnabled === false, 'Product creation is disabled in parent experience config');
    // Test block on product creation (Controller check)
    console.log('\n--- 3. Product creation restrictions ---');
    // Create mock admin/seller users
    let testSeller = await User_1.User.findOne({ email: 'seller@apexbee.com' });
    if (!testSeller) {
        testSeller = new User_1.User({
            name: 'Test Seller',
            email: 'seller@apexbee.com',
            passwordHash: 'dummy',
            phone: '9999999991',
            roles: ['vendor'],
        });
        await testSeller.save();
    }
    const sellerToken = generateToken(testSeller._id.toString(), testSeller.email, ['vendor']);
    const prodRes = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sellerToken}`,
        },
        body: JSON.stringify({
            name: 'Forbidden Academy Product',
            description: 'Vendor should not be allowed to list under Academy',
            categoryId: parentCat?._id.toString(),
            baseMrp: 100,
            baseSellingPrice: 90,
            stock: 10,
        }),
    });
    assert(prodRes.status === 403, `Vendor product creation blocked with HTTP 403 Forbidden (got ${prodRes.status})`);
    // Test Vendor Dropdown exclusion
    const dropdownRes = await fetch(`${API_BASE}/categories/dropdown`);
    const dropdownData = await dropdownRes.json();
    const dropdownTree = dropdownData.categories || [];
    const foundAcademyInDropdown = dropdownTree.some((c) => c.slug === 'apexbee-academy');
    assert(!foundAcademyInDropdown, 'Academy categories are absent from Vendor product addition dropdown');
    // 4. OTP flow validation
    console.log('\n--- 4. OTP Validation Flow ---');
    const testMobile = '9876543210';
    const otpRes = await fetch(`${API_BASE}/academy/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: testMobile }),
    });
    const otpData = await otpRes.json();
    assert(otpRes.status === 200, 'OTP request successful');
    assert(!!otpData.verificationToken, 'verificationToken returned');
    const token = otpData.verificationToken;
    // Verify stored in Redis correctly
    const redisVal = await redis.get(`academy:otp:9876543210:${token}`);
    assert(!!redisVal, 'OTP stored in Redis with purpose-bound key');
    // Verify attempts limit
    let verifyResObj;
    for (let i = 0; i < 4; i++) {
        const wrongVerifyRes = await fetch(`${API_BASE}/academy/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: testMobile, verificationToken: token, otp: '0000' }),
        });
        verifyResObj = await wrongVerifyRes.json();
    }
    assert(!verifyResObj.success, 'Failed verification attempts return failure');
    const clearedFromRedis = await redis.get(`academy:otp:9876543210:${token}`);
    assert(!clearedFromRedis, 'OTP key cleared from Redis after exceeding max attempts');
    // 5. Lead capture and Duplicate Policy
    console.log('\n--- 5. Lead Ingestion & Duplication Policy ---');
    // Re-request OTP and mock verification
    const newOtpRes = await fetch(`${API_BASE}/academy/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: testMobile }),
    });
    const newOtpData = await newOtpRes.json();
    const newToken = newOtpData.verificationToken;
    // Simulate correct OTP verification
    const correctVerify = await fetch(`${API_BASE}/academy/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: testMobile, verificationToken: newToken, otp: '1234' }),
    });
    assert(correctVerify.status === 200, 'Verify OTP with default static OTP returned success');
    // Guest lead creation
    const leadRes1 = await fetch(`${API_BASE}/academy/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: 'Test Candidate',
            mobile: testMobile,
            interestType: 'become_entrepreneur',
            selectedInterests: ['start_apexbee_business'],
            consentAccepted: true,
            consentVersion: '1.0',
        }),
    });
    const leadData1 = await leadRes1.json();
    assert(leadRes1.status === 201, 'Guest lead created successfully');
    assert(leadData1.success && !!leadData1.data.leadId, 'Lead ID generated successfully');
    // Duplicate submission check (within 24 hours)
    const leadRes2 = await fetch(`${API_BASE}/academy/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fullName: 'Test Candidate Duplicate',
            mobile: testMobile,
            interestType: 'become_entrepreneur',
            selectedInterests: ['start_apexbee_business'],
            consentAccepted: true,
            consentVersion: '1.0',
            otp: '1234', // Bypass with test static OTP
        }),
    });
    const leadData2 = await leadRes2.json();
    assert(leadRes2.status === 200, 'Duplicate submission returned HTTP 200');
    assert(leadData2.duplicate === true, 'Response marked as duplicate: true');
    assert(leadData2.data.leadId === leadData1.data.leadId, 'Response returns original lead ID');
    // Concurrency safety tests (atomic sequential lead ID checks)
    const lead1Id = leadData1.data.leadId;
    assert(lead1Id.startsWith('ACA-2026-'), `Lead ID formatting matches 'ACA-2026-' format (got ${lead1Id})`);
    // 6. Admin operations checks
    console.log('\n--- 6. Admin Panel Operations & Authorizations ---');
    let testAdmin = await User_1.User.findOne({ email: 'admin@apexbee.com' });
    if (!testAdmin) {
        testAdmin = new User_1.User({
            name: 'System Admin',
            email: 'admin@apexbee.com',
            passwordHash: 'dummy',
            phone: '9999999999',
            roles: ['admin'],
        });
        await testAdmin.save();
    }
    const adminToken = generateToken(testAdmin._id.toString(), testAdmin.email, ['admin']);
    // Admin access validation
    const adminLeadsRes = await fetch(`${API_BASE}/admin/academy/leads`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminLeadsRes.status === 200, 'Authorized admin user accesses leads list');
    const unauthRes = await fetch(`${API_BASE}/admin/academy/leads`, {
        headers: { Authorization: `Bearer ${sellerToken}` },
    });
    assert(unauthRes.status === 403, 'Unauthorized vendor user rejected from admin route with 403 Forbidden');
    // Update lead details and check audit trails
    const leadId = leadData1.data.leadId;
    const statusUpdateRes = await fetch(`${API_BASE}/admin/academy/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'contacted', note: 'Called candidate. Willing to join.' }),
    });
    assert(statusUpdateRes.status === 200, 'Admin successfully transitions status from new to contacted');
    const leadDoc = await AcademyInterestLead_1.default.findOne({ leadId });
    const countLogs = await AcademyLeadActivity_1.default.countDocuments({ leadId: leadDoc?._id, action: 'status_changed' });
    assert(countLogs === 1, 'Status change successfully recorded inside AcademyLeadActivity');
    // Follow-up scheduling check
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const followUpRes = await fetch(`${API_BASE}/admin/academy/leads/${leadId}/follow-up`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ nextFollowUpAt: tomorrow.toISOString(), note: 'Callback to discuss fees' }),
    });
    assert(followUpRes.status === 200, 'Follow-up successfully scheduled for next date');
    // CSV Export checks
    const exportRes = await fetch(`${API_BASE}/admin/academy/leads/export?status=contacted`, {
        headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(exportRes.status === 200, 'CSV Leads exporter download requested successfully');
    const csvText = await exportRes.text();
    assert(csvText.includes('ACA-2026-'), 'CSV content contains matching lead records');
    const adminAuditsCount = await AcademyAdminAudit_1.default.countDocuments({ performedBy: testAdmin._id, action: 'leads_exported' });
    assert(adminAuditsCount === 1, 'Admin bulk export audittrail correctly logged in AcademyAdminAudit');
    // 7. Analytics view events checks
    console.log('\n--- 7. Analytics Ingestion API ---');
    const analyticsRes = await fetch(`${API_BASE}/academy/analytics/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventName: 'academy_viewed',
            anonymousSessionId: 'anon-session-123',
            metadata: { utm_source: 'google', mobile: '9999999999' }, // mobile must be stripped
        }),
    });
    assert(analyticsRes.status === 200, 'Analytics views event saved successfully');
    const savedEvent = await AnalyticsEvent_1.default.findOne({ eventName: 'academy_viewed' });
    assert(!!savedEvent, 'Analytics views event populated in DB');
    assert(!savedEvent?.metadata.mobile, 'Personal identifier (mobile) stripped out of metadata successfully');
    console.log('=====================================================================');
    console.log(`[Academy Tests Completed] Passed: ${passed}, Failed: ${failed}`);
    console.log('=====================================================================');
    await mongoose_1.default.disconnect();
    process.exit(failed > 0 ? 1 : 0);
};
runTests().catch(err => {
    console.error('Test runner exception:', err);
    process.exit(1);
});
