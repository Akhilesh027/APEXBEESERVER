"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const assert_1 = __importDefault(require("assert"));
const correlation_1 = require("../middleware/correlation");
async function runR9Tests() {
    console.log('Running Release R9 Monitoring and Incident Controls Tests...');
    // Set environment variable to force JSON structured logging
    process.env.STRUCTURED_LOGGING = 'true';
    let loggedOutput = '';
    // Intercept console.log
    const originalLog = console.log;
    console.log = (msg) => {
        loggedOutput += msg + '\n';
    };
    let warnedOutput = '';
    // Intercept console.warn
    const originalWarn = console.warn;
    console.warn = (msg) => {
        warnedOutput += msg + '\n';
    };
    try {
        // Mock express Request, Response, Next
        const mockReq = {
            headers: {
                'x-request-id': 'test-correlation-id',
                'idempotency-key': 'test-idem-key',
            },
            method: 'GET',
            originalUrl: '/api/products',
            body: {},
        };
        const listeners = {};
        const mockRes = {
            setHeader: () => { },
            on: (event, callback) => {
                listeners[event] = callback;
            },
            statusCode: 200,
        };
        let nextCalled = false;
        const mockNext = () => {
            nextCalled = true;
        };
        // 1. Run Middleware
        (0, correlation_1.correlationMiddleware)(mockReq, mockRes, mockNext);
        assert_1.default.ok(nextCalled, 'Next middleware must be called');
        assert_1.default.ok(mockReq.log, 'Logger must be injected');
        // Verify incoming request log is structured JSON
        const parsedLog = JSON.parse(loggedOutput.trim());
        assert_1.default.strictEqual(parsedLog.level, 'INFO');
        assert_1.default.strictEqual(parsedLog.requestId, 'test-correlation-id');
        assert_1.default.strictEqual(parsedLog.idempotencyKey, 'test-idem-key');
        assert_1.default.ok(parsedLog.message.includes('Incoming request'), 'Message must include request info');
        console.log = originalLog;
        console.log('Structured JSON format verified: PASS');
        // 2. Test performance alert threshold triggers
        // Artificially trigger the response finish event
        // To trigger the performance alert, we need to mock a delay. Since the startTime was captured inside the middleware,
        // we can artificially back-date the startTime in a mock test context or verify the alert by firing after a timeout.
        // Let's modify req.startTime internally or wait 1600ms
        console.log('Simulating a slow request execution (waiting 1.6 seconds)...');
        await new Promise((resolve) => setTimeout(resolve, 1600));
        // Call response finish listener
        listeners['finish']?.();
        // Verify that the warned output has the slow alert log
        assert_1.default.ok(warnedOutput.includes('[PERFORMANCE ALERT]'), 'Slow request alert must trigger');
        const parsedAlert = JSON.parse(warnedOutput.trim());
        assert_1.default.strictEqual(parsedAlert.level, 'WARN');
        assert_1.default.ok(parsedAlert.message.includes('Slow request detected'), 'Alert message must be structured');
        console.warn = originalWarn;
        console.log('Performance regression alert verification: PASS');
        console.log('\n=======================================');
        console.log('ALL RELEASE R9 TESTS PASSED! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runR9Tests();
