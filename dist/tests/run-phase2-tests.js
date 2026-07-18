"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const assert_1 = __importDefault(require("assert"));
const env_1 = require("../config/env");
const redis_1 = require("../config/redis");
function runPhase2Tests() {
    console.log('Starting Phase 2 Redis Production Safety Tests...');
    // Save original env values
    const originalNodeEnv = env_1.env.NODE_ENV;
    const originalMemoryMock = process.env.ALLOW_REDIS_MEMORY_MOCK;
    try {
        // ----------------------------------------------------
        // TEST 1: Staging or production environments disallow mock memory fallbacks
        // ----------------------------------------------------
        console.log('1. Testing staging/production environment constraints...');
        // Simulate production environment
        env_1.env.NODE_ENV = 'production';
        process.env.ALLOW_REDIS_MEMORY_MOCK = 'true'; // even if true, production overrides and blocks it
        // Attempting to retrieve client when connection is not ready should throw
        assert_1.default.throws(() => {
            (0, redis_1.getRedisClient)();
        }, /In-memory fallback is prohibited in staging and production/);
        console.log('Staging/Production constraints verified: PASS');
        // ----------------------------------------------------
        // TEST 2: ALLOW_REDIS_MEMORY_MOCK configuration bounds
        // ----------------------------------------------------
        console.log('\n2. Testing memory mock configuration flags...');
        // Restore dev/test env, but set ALLOW_REDIS_MEMORY_MOCK to false
        env_1.env.NODE_ENV = 'test';
        process.env.ALLOW_REDIS_MEMORY_MOCK = 'false';
        assert_1.default.throws(() => {
            (0, redis_1.getRedisClient)();
        }, /Redis connection is mandatory/);
        // Verify ALLOW_REDIS_MEMORY_MOCK = true succeeds in test environment
        process.env.ALLOW_REDIS_MEMORY_MOCK = 'true';
        const client = (0, redis_1.getRedisClient)();
        assert_1.default.ok(client, 'Mock store must be instantiated');
        console.log('Memory mock configurations verified: PASS');
        // Restore original values
        env_1.env.NODE_ENV = originalNodeEnv;
        if (originalMemoryMock === undefined) {
            delete process.env.ALLOW_REDIS_MEMORY_MOCK;
        }
        else {
            process.env.ALLOW_REDIS_MEMORY_MOCK = originalMemoryMock;
        }
        console.log('\n=======================================');
        console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        // Restore original values on error
        env_1.env.NODE_ENV = originalNodeEnv;
        if (originalMemoryMock === undefined) {
            delete process.env.ALLOW_REDIS_MEMORY_MOCK;
        }
        else {
            process.env.ALLOW_REDIS_MEMORY_MOCK = originalMemoryMock;
        }
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase2Tests();
