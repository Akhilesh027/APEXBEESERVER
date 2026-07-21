import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const TARGET_URL = process.env.TARGET_URL || 'https://server.apexbee.in';
const CONCURRENT_CLIENTS = 100; // Rehearsal size
const RUN_DURATION_MS = 15000; // 15 seconds monitor

interface Metrics {
  attempted: number;
  connected: number;
  authenticated: number;
  errors: number;
  disconnected: number;
  connectionLatencies: number[];
  notificationsReceived: Record<string, number>; // clientId -> count
}

const metrics: Metrics = {
  attempted: 0,
  connected: 0,
  authenticated: 0,
  errors: 0,
  disconnected: 0,
  connectionLatencies: [],
  notificationsReceived: {}
};

const workerCounts: Record<string, number> = {};
const pidCounts: Record<string, number> = {};

async function startSocketLoadTest() {
  const customerTokensPath = path.join(__dirname, 'k6_customer_tokens.json');
  const adminTokensPath = path.join(__dirname, 'k6_admin_tokens.json');

  if (!fs.existsSync(customerTokensPath)) {
    console.error('❌ Staging customer tokens file not found. Run seed_staging_data.ts first.');
    process.exit(1);
  }

  const { tokens: customerTokens } = JSON.parse(fs.readFileSync(customerTokensPath, 'utf8'));
  let adminTokens: string[] = [];
  if (fs.existsSync(adminTokensPath)) {
    adminTokens = JSON.parse(fs.readFileSync(adminTokensPath, 'utf8')).tokens;
  }

  console.log(`Loaded ${customerTokens.length} staging customer tokens.`);
  console.log(`Loaded ${adminTokens.length} admin tokens.`);

  console.log(`\n================================================================`);
  console.log(`STARTING SOCKET.IO CONCURRENCY REHEARSAL`);
  console.log(`Target URL:           ${TARGET_URL}`);
  console.log(`Simulated Clients:    ${CONCURRENT_CLIENTS}`);
  console.log(`================================================================\n`);

  const clients: any[] = [];
  const clientInfo: Record<string, { token: string; userId: string; socket: any; currentWorkerId?: string; currentPid?: number }> = {};
  const startAll = Date.now();

  for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
    const token = customerTokens[i % customerTokens.length];

    // Decode user ID from token
    let userId = `user_${i}`;
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.id) {
        userId = decoded.id;
      }
    } catch (e) { }

    metrics.attempted++;
    const startTime = Date.now();

    const socket = io(TARGET_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: true
    });

    const clientId = `client_${i}`;
    clients.push({ clientId, socket, token, userId });
    metrics.notificationsReceived[clientId] = 0;

    socket.on('connect', () => {
      metrics.connected++;
      socket.emit('auth:init', { token });
    });

    socket.on('auth:success', (data: any) => {
      metrics.authenticated++;
      const latency = Date.now() - startTime;
      metrics.connectionLatencies.push(latency);

      // Record worker information
      const workerId = data.workerId || '0';
      const pid = data.pid || 0;
      workerCounts[workerId] = (workerCounts[workerId] || 0) + 1;
      pidCounts[pid] = (pidCounts[pid] || 0) + 1;

      clientInfo[clientId] = {
        token,
        userId,
        socket,
        currentWorkerId: workerId,
        currentPid: pid
      };
    });

    socket.on('auth:error', (err) => {
      metrics.errors++;
      console.error(`Client ${clientId} Auth Error:`, err);
    });

    socket.on('connect_error', (err) => {
      metrics.errors++;
    });

    socket.on('notification:new', (notification) => {
      metrics.notificationsReceived[clientId] = (metrics.notificationsReceived[clientId] || 0) + 1;
      console.log(`[Socket Load] Client ${clientId} received notification: "${notification.title}" - ${notification.message}`);
    });

    socket.on('disconnect', (reason) => {
      metrics.disconnected++;
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  // Wait for connections to stabilize
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log(`\nStaging connection count metrics verified:`);
  console.log(`Worker distribution:`, workerCounts);
  console.log(`Process IDs distribution:`, pidCounts);

  // ------------------------------------------------------------------------
  // CROSS-WORKER VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- 1. Cross-Worker Event Propagation Rehearsal ---');
  if (adminTokens.length > 0 && clients.length > 1) {
    // Select Client 0 as receiver (Client A)
    const receiverClient = clients[0];
    const receiverClientId = receiverClient.clientId;
    const receiverUserId = receiverClient.userId;
    const receiverInfo = clientInfo[receiverClientId];

    if (receiverInfo) {
      console.log(`Receiver Client: ${receiverClientId} (User ID: ${receiverUserId})`);
      console.log(`  Connected to Worker: ${receiverInfo.currentWorkerId} (PID: ${receiverInfo.currentPid})`);

      const adminToken = adminTokens[0];
      const testTitle = 'Cross-worker Test';
      const testMsg = `Hello from generator at ${new Date().toLocaleTimeString()}`;

      try {
        console.log(`Sending REST request to target /api/notifications/admin/test-direct-emit for User ${receiverUserId}...`);
        const res = await fetch(`${TARGET_URL}/api/notifications/admin/test-direct-emit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            userId: receiverUserId,
            title: testTitle,
            message: testMsg
          })
        });

        if (res.ok) {
          const resBody = await res.json() as any;
          console.log(`REST request succeeded:`, resBody.message);

          // Wait 2s for propagation
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const receivedCount = metrics.notificationsReceived[receiverClientId] || 0;
          if (receivedCount > 0) {
            console.log(`✅ SUCCESS: Client ${receiverClientId} successfully received the cross-worker notification!`);
          } else {
            console.warn(`⚠️ WARNING: Client ${receiverClientId} did NOT receive the notification. Check Redis connection/adapter logs.`);
          }
        } else {
          console.error(`❌ REST request failed with status: ${res.status}`);
        }
      } catch (err: any) {
        console.error(`❌ Error during cross-worker REST emit:`, err.message);
      }
    }
  } else {
    console.log('Skipping cross-worker test: missing admin tokens or not enough clients.');
  }

  // ------------------------------------------------------------------------
  // RECONNECTION DUP-LISTENER VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- 2. Reconnection Listener Integrity Rehearsal ---');
  if (clients.length > 0) {
    const testClient = clients[0];
    const testClientId = testClient.clientId;
    const testUserId = testClient.userId;
    const testSocket = testClient.socket;

    console.log(`Simulating disconnect-reconnect cycle for Client ${testClientId}...`);

    // Track original notification count
    const baseCount = metrics.notificationsReceived[testClientId] || 0;

    // Disconnect
    testSocket.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Connect again
    testSocket.connect();
    // Wait for auth to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log(`Client ${testClientId} reconnected. Emitting check notification...`);

    if (adminTokens.length > 0) {
      const adminToken = adminTokens[0];
      try {
        const res = await fetch(`${TARGET_URL}/api/notifications/admin/test-direct-emit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            userId: testUserId,
            title: 'Reconnection Test',
            message: 'Checking for duplicate listeners'
          })
        });

        if (res.ok) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const afterCount = metrics.notificationsReceived[testClientId] || 0;
          const diff = afterCount - baseCount;

          if (diff === 1) {
            console.log(`✅ SUCCESS: Received exactly ${diff} notification. Reconnection did not introduce duplicate listeners!`);
          } else {
            console.error(`❌ FAILURE: Received ${diff} notifications (expected 1). Reconnection created duplicate event listeners!`);
          }
        }
      } catch (err: any) {
        console.error(`❌ Error in reconnection test emission:`, err.message);
      }
    }
  }

  console.log(`\nMonitoring general socket activity for remaining ${RUN_DURATION_MS / 1000}s...`);
  await new Promise((resolve) => setTimeout(resolve, RUN_DURATION_MS));

  // Disconnect all
  console.log('\nDisconnecting all clients...');
  for (const client of clients) {
    client.socket.disconnect();
  }

  // Calculate statistics
  const latencies = metrics.connectionLatencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log('\n================================================================');
  console.log('SOCKET.IO LOAD TEST REHEARSAL SUMMARY');
  console.log('================================================================');
  console.log(`Connections Attempted:      ${metrics.attempted}`);
  console.log(`Connections Established:    ${metrics.connected}`);
  console.log(`Users Authenticated:        ${metrics.authenticated}`);
  console.log(`Failed / Error Events:       ${metrics.errors}`);
  console.log(`Disconnected Events:        ${metrics.disconnected}`);
  console.log(`Worker 0 Count:             ${workerCounts['0'] || 0}`);
  console.log(`Worker 1 Count:             ${workerCounts['1'] || 0}`);
  console.log(`Connection Latency (p50):    ${p50} ms`);
  console.log(`Connection Latency (p95):    ${p95} ms`);
  console.log('================================================================\n');

  if (metrics.connected === 0 || metrics.authenticated < CONCURRENT_CLIENTS * 0.95) {
    console.log('❌ Socket load client rehearsal failed (authentication rate below 95%).');
    process.exit(1);
  } else {
    console.log('✅ Socket load client rehearsal passed.');
    process.exit(0);
  }
}

startSocketLoadTest().catch((err) => {
  console.error('Fatal error during socket.io load test:', err);
  process.exit(1);
});
