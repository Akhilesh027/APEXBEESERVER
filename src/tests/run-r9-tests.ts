import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import assert from 'assert';
import { correlationMiddleware, CorrelatedRequest } from '../middleware/correlation';

async function runR9Tests() {
  console.log('Running Release R9 Monitoring and Incident Controls Tests...');

  // Set environment variable to force JSON structured logging
  process.env.STRUCTURED_LOGGING = 'true';

  let loggedOutput = '';
  // Intercept console.log
  const originalLog = console.log;
  console.log = (msg: string) => {
    loggedOutput += msg + '\n';
  };

  let warnedOutput = '';
  // Intercept console.warn
  const originalWarn = console.warn;
  console.warn = (msg: string) => {
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
    } as unknown as CorrelatedRequest;

    const listeners: Record<string, () => void> = {};
    const mockRes = {
      setHeader: () => {},
      on: (event: string, callback: () => void) => {
        listeners[event] = callback;
      },
      statusCode: 200,
    } as any;

    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    // 1. Run Middleware
    correlationMiddleware(mockReq, mockRes, mockNext);

    assert.ok(nextCalled, 'Next middleware must be called');
    assert.ok(mockReq.log, 'Logger must be injected');

    // Verify incoming request log is structured JSON
    const parsedLog = JSON.parse(loggedOutput.trim());
    assert.strictEqual(parsedLog.level, 'INFO');
    assert.strictEqual(parsedLog.requestId, 'test-correlation-id');
    assert.strictEqual(parsedLog.idempotencyKey, 'test-idem-key');
    assert.ok(parsedLog.message.includes('Incoming request'), 'Message must include request info');

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
    assert.ok(warnedOutput.includes('[PERFORMANCE ALERT]'), 'Slow request alert must trigger');
    const parsedAlert = JSON.parse(warnedOutput.trim());
    assert.strictEqual(parsedAlert.level, 'WARN');
    assert.ok(parsedAlert.message.includes('Slow request detected'), 'Alert message must be structured');

    console.warn = originalWarn;
    console.log('Performance regression alert verification: PASS');

    console.log('\n=======================================');
    console.log('ALL RELEASE R9 TESTS PASSED! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runR9Tests();
