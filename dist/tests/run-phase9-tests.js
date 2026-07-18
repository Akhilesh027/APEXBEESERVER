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
const ConfigService_1 = require("../services/ConfigService");
const SystemConfig_1 = __importDefault(require("../models/SystemConfig"));
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runPhase9Tests() {
    console.log('Starting Phase 9 Metrics & Feature Flag Verification Tests...');
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    try {
        // 1. Clear existing test config
        await SystemConfig_1.default.deleteMany({ key: /^TEST_FLAG/ });
        // 2. Set feature flag
        console.log('1. Testing setting feature flags...');
        await ConfigService_1.ConfigService.setFlag('TEST_FLAG_A', true);
        const dbRecord = await SystemConfig_1.default.findOne({ key: 'TEST_FLAG_A' });
        assert_1.default.ok(dbRecord, 'Flag must be persisted in SystemConfig');
        assert_1.default.strictEqual(dbRecord.value, true, 'Persisted flag value must be true');
        console.log('Flag persistence: PASS');
        // 3. Get feature flag (uncached)
        console.log('2. Testing getting feature flags...');
        const flagVal = await ConfigService_1.ConfigService.getFlag('TEST_FLAG_A');
        assert_1.default.strictEqual(flagVal, true, 'ConfigService.getFlag must return true');
        console.log('Flag retrieval: PASS');
        // 4. Test cache TTL
        console.log('3. Testing cache invalidation & updates...');
        // Directly update value in database (bypassing ConfigService to verify caching)
        await SystemConfig_1.default.updateOne({ key: 'TEST_FLAG_A' }, { $set: { value: false } });
        const cachedVal = await ConfigService_1.ConfigService.getFlag('TEST_FLAG_A');
        assert_1.default.strictEqual(cachedVal, true, 'ConfigService must return cached true value immediately after DB update');
        console.log('Cache retention: PASS');
        // Update via ConfigService (which invalidates cache)
        await ConfigService_1.ConfigService.setFlag('TEST_FLAG_A', false);
        const updatedVal = await ConfigService_1.ConfigService.getFlag('TEST_FLAG_A');
        assert_1.default.strictEqual(updatedVal, false, 'ConfigService must return updated false value after cache invalidation');
        console.log('Cache invalidation: PASS');
        console.log('\n=======================================');
        console.log('ALL PHASE 9 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase9Tests();
