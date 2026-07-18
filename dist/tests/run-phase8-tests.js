"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const assert_1 = __importDefault(require("assert"));
function runPhase8Tests() {
    console.log('Starting Phase 8 Deployment Config Verification Tests...');
    // 1. Verify fallback behaviour of connection pool variables
    console.log('1. Checking connection pool environment mapping fallback...');
    const originalMax = process.env.MONGO_MAX_POOL_SIZE;
    const originalMin = process.env.MONGO_MIN_POOL_SIZE;
    delete process.env.MONGO_MAX_POOL_SIZE;
    delete process.env.MONGO_MIN_POOL_SIZE;
    // Re-require / verify env config
    const freshEnv = require('../config/env').env;
    assert_1.default.strictEqual(freshEnv.MONGO_MAX_POOL_SIZE, 100, 'Default MONGO_MAX_POOL_SIZE must be 100');
    assert_1.default.strictEqual(freshEnv.MONGO_MIN_POOL_SIZE, 10, 'Default MONGO_MIN_POOL_SIZE must be 10');
    console.log('Default fallback values: PASS');
    // Restore env
    if (originalMax !== undefined)
        process.env.MONGO_MAX_POOL_SIZE = originalMax;
    if (originalMin !== undefined)
        process.env.MONGO_MIN_POOL_SIZE = originalMin;
    console.log('\n=======================================');
    console.log('ALL PHASE 8 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);
}
runPhase8Tests();
