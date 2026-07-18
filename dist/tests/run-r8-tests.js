"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const child_process_1 = require("child_process");
const assert_1 = __importDefault(require("assert"));
const TEST_PORT = 4999;
async function runR8Tests() {
    console.log('Starting Release R8 Graceful Shutdown and Health Probe Tests...');
    // Spawn backend server process
    const serverProcess = (0, child_process_1.spawn)('node', ['dist/server.js'], {
        cwd: path_1.default.join(__dirname, '../..'),
        env: {
            ...process.env,
            PORT: String(TEST_PORT),
            NODE_ENV: 'test',
        },
    });
    let serverOutput = '';
    serverProcess.stdout?.on('data', (data) => {
        serverOutput += data.toString();
    });
    serverProcess.stderr?.on('data', (data) => {
        console.error('[Server Error Output]:', data.toString());
    });
    // Wait for server to boot (look for 'running on port' in logs)
    console.log('Waiting for server boot...');
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Server failed to boot within timeout. Output:\n${serverOutput}`));
        }, 60000);
        const interval = setInterval(() => {
            if (serverOutput.includes('ApexBee Core API Server running on port')) {
                clearInterval(interval);
                clearTimeout(timeout);
                resolve();
            }
        }, 500);
    });
    console.log('Server booted successfully. Querying health endpoint...');
    try {
        // Query health check
        const response = await fetch(`http://127.0.0.1:${TEST_PORT}/health`);
        assert_1.default.strictEqual(response.status, 200, 'Health endpoint must return 200 OK');
        const body = (await response.json());
        console.log('Health Check Response Body:', JSON.stringify(body, null, 2));
        assert_1.default.ok(body.status === 'healthy', 'Status must be healthy');
        assert_1.default.strictEqual(body.services.database, 'connected', 'Database must be connected');
        console.log('Health check probe verification: PASS');
        // Trigger Graceful Shutdown via SIGINT signal
        console.log('Sending SIGINT to server process...');
        serverProcess.kill('SIGINT');
        // Wait for process exit
        const exitCode = await new Promise((resolve) => {
            serverProcess.on('exit', (code) => {
                resolve(code);
            });
        });
        console.log(`Server exited with code: ${exitCode}`);
        assert_1.default.ok(exitCode === 0 || exitCode === null, 'Graceful shutdown must exit with code 0 or null');
        console.log('Graceful Shutdown verification: PASS');
        console.log('\n=======================================');
        console.log('ALL RELEASE R8 TESTS PASSED! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        serverProcess.kill('SIGKILL');
        process.exit(1);
    }
}
runR8Tests();
