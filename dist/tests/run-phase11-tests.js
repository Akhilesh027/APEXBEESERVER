"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const assert_1 = __importDefault(require("assert"));
function runPhase11Tests() {
    console.log('Starting Phase 11 k6 Script Suite Verification...');
    const loadTestDir = path_1.default.join(__dirname, 'load');
    const files = fs_1.default.readdirSync(loadTestDir);
    console.log(`Found ${files.length} load testing scripts in directory.`);
    for (const file of files) {
        if (!file.endsWith('.js'))
            continue;
        console.log(`\nValidating script: ${file}...`);
        const filePath = path_1.default.join(loadTestDir, file);
        const content = fs_1.default.readFileSync(filePath, 'utf8');
        // Basic structural checks on k6 JavaScript scripts
        assert_1.default.ok(content.includes('export const options'), `Script ${file} must export options configuration`);
        assert_1.default.ok(content.includes('thresholds:'), `Script ${file} must define performance targets/thresholds`);
        assert_1.default.ok(content.includes('export default function'), `Script ${file} must export a default function scenario`);
        console.log(`Script ${file} structure: VALID`);
    }
    console.log('\n=======================================');
    console.log('ALL PHASE 11 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);
}
runPhase11Tests();
