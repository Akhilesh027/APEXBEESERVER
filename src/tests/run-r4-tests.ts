import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import assert from 'assert';
import getRedisClient from '../config/redis';
import { env } from '../config/env';

// Import express app setup
import express from 'express';
import cors from 'cors';
import authRoutes from '../routes/authRoutes';
import { ipRateLimiter, userRateLimiter, criticalRateLimiter } from '../middleware/rateLimiter';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

async function runR4Tests() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Database connected.');

  const redis = getRedisClient();

  try {
    // ----------------------------------------------------
    // TEST 1: Stateless Redis OTP Lifecycle
    // ----------------------------------------------------
    console.log('\n1. Testing Stateless Redis OTP Lifecycle...');
    
    const testKey = `test_user_${Date.now()}@test.com`;

    // Mock Express Request & Response for sendOtp
    let otpSaved = '';
    const mockReqSend = {
      body: { email: testKey }
    } as any;
    const mockResSend = {
      status(code: number) {
        assert.strictEqual(code, 200);
        return this;
      },
      json(data: any) {
        assert.ok(data.success);
      }
    } as any;

    const { sendOtp, verifyOtp } = require('../controllers/authController');
    await sendOtp(mockReqSend, mockResSend);

    // Verify key in Redis
    const redisOtp = await redis.get(`otp:${testKey}`);
    assert.strictEqual(redisOtp, '1234', 'OTP must be saved in Redis as 1234');

    // Verify correct OTP verification sets verified key and deletes OTP key
    const mockReqVerify = {
      body: { email: testKey, otp: '1234' }
    } as any;
    const mockResVerify = {
      status(code: number) {
        assert.strictEqual(code, 200);
        return this;
      },
      json(data: any) {
        assert.ok(data.success);
      }
    } as any;

    await verifyOtp(mockReqVerify, mockResVerify);

    const isVerified = await redis.get(`verified:${testKey}`);
    assert.strictEqual(isVerified, 'true', 'Verification flag must be true in Redis');

    const otpDeleted = await redis.get(`otp:${testKey}`);
    assert.strictEqual(otpDeleted, null, 'OTP key must be deleted upon successful validation');

    console.log('Stateless Redis OTP Lifecycle: PASS');

    // ----------------------------------------------------
    // TEST 2: Redis-backed Route Rate Limiting
    // ----------------------------------------------------
    console.log('\n2. Testing Redis-backed Route Rate Limiting...');

    // Force enable rate limiting for this test execution
    env.ENABLE_REDIS_RATE_LIMIT = true;

    const mockIp = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
    const limiter = criticalRateLimiter;
    const rateLimitPromises: Promise<number>[] = [];

    // Simulate 7 rapid requests to critical path under identical IP context
    for (let i = 0; i < 7; i++) {
      const mockReqLimit = {
        ip: mockIp,
        headers: {},
        socket: {},
      } as any;
      
      let resStatus = 200;
      const mockResLimit = {
        status(code: number) {
          resStatus = code;
          return this;
        },
        json(data: any) {
          return this;
        }
      } as any;

      const next = () => {};

      // Wait between iterations to avoid execution race condition
      await limiter(mockReqLimit, mockResLimit, next);
      rateLimitPromises.push(Promise.resolve(resStatus));
    }

    const statuses = await Promise.all(rateLimitPromises);
    const count429 = statuses.filter(s => s === 429).length;

    console.log(`Rate limiter request statuses:`, statuses);
    assert.strictEqual(count429, 2, 'Exactly 2 requests must be rejected with status 429 (Too Many Requests)');

    console.log('Redis-backed Route Rate Limiting: PASS');

    // Clean up
    await redis.del(`verified:${testKey}`);

    console.log('\n=======================================');
    console.log('ALL RELEASE R4 TESTS PASSED! (100%)');
    console.log('=======================================');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err: any) {
    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
}

runR4Tests();
