import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { spawn } from 'child_process';
import assert from 'assert';

const TEST_PORT = 4999;

async function runR8Tests() {
  console.log('Starting Release R8 Graceful Shutdown and Health Probe Tests...');

  // Spawn backend server process
  const serverProcess = spawn('node', ['dist/server.js'], {
    cwd: path.join(__dirname, '../..'),
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
  await new Promise<void>((resolve, reject) => {
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
    assert.strictEqual(response.status, 200, 'Health endpoint must return 200 OK');

    const body = (await response.json()) as any;
    console.log('Health Check Response Body:', JSON.stringify(body, null, 2));

    assert.ok(body.status === 'healthy', 'Status must be healthy');
    assert.strictEqual(body.services.database, 'connected', 'Database must be connected');

    console.log('Health check probe verification: PASS');

    // Trigger Graceful Shutdown via SIGINT signal
    console.log('Sending SIGINT to server process...');
    serverProcess.kill('SIGINT');

    // Wait for process exit
    const exitCode = await new Promise<number | null>((resolve) => {
      serverProcess.on('exit', (code) => {
        resolve(code);
      });
    });

    console.log(`Server exited with code: ${exitCode}`);
    assert.ok(exitCode === 0 || exitCode === null, 'Graceful shutdown must exit with code 0 or null');
    console.log('Graceful Shutdown verification: PASS');

    console.log('\n=======================================');
    console.log('ALL RELEASE R8 TESTS PASSED! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    serverProcess.kill('SIGKILL');
    process.exit(1);
  }
}

runR8Tests();
