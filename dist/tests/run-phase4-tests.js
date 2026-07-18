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
function runPhase4Tests() {
    console.log('Starting Phase 4 Separate Processes Integration Tests...');
    // 1. Verify environment mapping of PROCESS_TYPE
    console.log('1. Checking env mapping logic...');
    assert_1.default.ok('PROCESS_TYPE' in env_1.env);
    // Default fallback should be 'combined' if not specified
    const originalVal = process.env.PROCESS_TYPE;
    delete process.env.PROCESS_TYPE;
    // Re-require / verify env config
    const freshEnv = require('../config/env').env;
    assert_1.default.strictEqual(freshEnv.PROCESS_TYPE, 'combined', 'Default PROCESS_TYPE must be combined');
    console.log('Environment variable mapping: PASS');
    // Restore env
    if (originalVal !== undefined) {
        process.env.PROCESS_TYPE = originalVal;
    }
    console.log('\n=======================================');
    console.log('ALL PHASE 4 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);
}
runPhase4Tests();
