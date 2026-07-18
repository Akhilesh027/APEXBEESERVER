"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const assert_1 = __importDefault(require("assert"));
const redis_1 = __importDefault(require("../config/redis"));
const env_1 = require("../config/env");
const rateLimiter_1 = require("../middleware/rateLimiter");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runR4Tests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    const redis = (0, redis_1.default)();
    try {
        // ----------------------------------------------------
        // TEST 1: Stateless Redis OTP Lifecycle
        // ----------------------------------------------------
        console.log('\n1. Testing Stateless Redis OTP Lifecycle...');
        const testKey = `test_user_${Date.now()}@test.com`;
        // Mock Express Request & Response for sendOtp
        let otpSaved = '';
        const mockReqSend = {
            body: { email: testKey }
        };
        const mockResSend = {
            status(code) {
                assert_1.default.strictEqual(code, 200);
                return this;
            },
            json(data) {
                assert_1.default.ok(data.success);
            }
        };
        const { sendOtp, verifyOtp } = require('../controllers/authController');
        await sendOtp(mockReqSend, mockResSend);
        // Verify key in Redis
        const redisOtp = await redis.get(`otp:${testKey}`);
        assert_1.default.strictEqual(redisOtp, '1234', 'OTP must be saved in Redis as 1234');
        // Verify correct OTP verification sets verified key and deletes OTP key
        const mockReqVerify = {
            body: { email: testKey, otp: '1234' }
        };
        const mockResVerify = {
            status(code) {
                assert_1.default.strictEqual(code, 200);
                return this;
            },
            json(data) {
                assert_1.default.ok(data.success);
            }
        };
        await verifyOtp(mockReqVerify, mockResVerify);
        const isVerified = await redis.get(`verified:${testKey}`);
        assert_1.default.strictEqual(isVerified, 'true', 'Verification flag must be true in Redis');
        const otpDeleted = await redis.get(`otp:${testKey}`);
        assert_1.default.strictEqual(otpDeleted, null, 'OTP key must be deleted upon successful validation');
        console.log('Stateless Redis OTP Lifecycle: PASS');
        // ----------------------------------------------------
        // TEST 2: Redis-backed Route Rate Limiting
        // ----------------------------------------------------
        console.log('\n2. Testing Redis-backed Route Rate Limiting...');
        // Force enable rate limiting for this test execution
        env_1.env.ENABLE_REDIS_RATE_LIMIT = true;
        const mockIp = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
        const limiter = rateLimiter_1.criticalRateLimiter;
        const rateLimitPromises = [];
        // Simulate 7 rapid requests to critical path under identical IP context
        for (let i = 0; i < 7; i++) {
            const mockReqLimit = {
                ip: mockIp,
                headers: {},
                socket: {},
            };
            let resStatus = 200;
            const mockResLimit = {
                status(code) {
                    resStatus = code;
                    return this;
                },
                json(data) {
                    return this;
                }
            };
            const next = () => { };
            // Wait between iterations to avoid execution race condition
            await limiter(mockReqLimit, mockResLimit, next);
            rateLimitPromises.push(Promise.resolve(resStatus));
        }
        const statuses = await Promise.all(rateLimitPromises);
        const count429 = statuses.filter(s => s === 429).length;
        console.log(`Rate limiter request statuses:`, statuses);
        assert_1.default.strictEqual(count429, 2, 'Exactly 2 requests must be rejected with status 429 (Too Many Requests)');
        console.log('Redis-backed Route Rate Limiting: PASS');
        // Clean up
        await redis.del(`verified:${testKey}`);
        console.log('\n=======================================');
        console.log('ALL RELEASE R4 TESTS PASSED! (100%)');
        console.log('=======================================');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        try {
            await mongoose_1.default.disconnect();
        }
        catch { }
        process.exit(1);
    }
}
runR4Tests();
