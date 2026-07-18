import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import assert from 'assert';
import { env } from '../config/env';
import { getRedisClient, checkRedisConnected } from '../config/redis';

function runPhase2Tests() {
  console.log('Starting Phase 2 Redis Production Safety Tests...');

  // Save original env values
  const originalNodeEnv = env.NODE_ENV;
  const originalMemoryMock = process.env.ALLOW_REDIS_MEMORY_MOCK;

  try {
    // ----------------------------------------------------
    // TEST 1: Staging or production environments disallow mock memory fallbacks
    // ----------------------------------------------------
    console.log('1. Testing staging/production environment constraints...');
    
    // Simulate production environment
    (env as any).NODE_ENV = 'production';
    process.env.ALLOW_REDIS_MEMORY_MOCK = 'true'; // even if true, production overrides and blocks it
    
    // Attempting to retrieve client when connection is not ready should throw
    assert.throws(
      () => {
        getRedisClient();
      },
      /In-memory fallback is prohibited in staging and production/
    );

    console.log('Staging/Production constraints verified: PASS');

    // ----------------------------------------------------
    // TEST 2: ALLOW_REDIS_MEMORY_MOCK configuration bounds
    // ----------------------------------------------------
    console.log('\n2. Testing memory mock configuration flags...');
    
    // Restore dev/test env, but set ALLOW_REDIS_MEMORY_MOCK to false
    (env as any).NODE_ENV = 'test';
    process.env.ALLOW_REDIS_MEMORY_MOCK = 'false';

    assert.throws(
      () => {
        getRedisClient();
      },
      /Redis connection is mandatory/
    );

    // Verify ALLOW_REDIS_MEMORY_MOCK = true succeeds in test environment
    process.env.ALLOW_REDIS_MEMORY_MOCK = 'true';
    const client = getRedisClient();
    assert.ok(client, 'Mock store must be instantiated');

    console.log('Memory mock configurations verified: PASS');

    // Restore original values
    (env as any).NODE_ENV = originalNodeEnv;
    if (originalMemoryMock === undefined) {
      delete process.env.ALLOW_REDIS_MEMORY_MOCK;
    } else {
      process.env.ALLOW_REDIS_MEMORY_MOCK = originalMemoryMock;
    }

    console.log('\n=======================================');
    console.log('ALL PHASE 2 TESTS PASSED SUCCESSFULLY! (100%)');
    console.log('=======================================');
    process.exit(0);

  } catch (err: any) {
    // Restore original values on error
    (env as any).NODE_ENV = originalNodeEnv;
    if (originalMemoryMock === undefined) {
      delete process.env.ALLOW_REDIS_MEMORY_MOCK;
    } else {
      process.env.ALLOW_REDIS_MEMORY_MOCK = originalMemoryMock;
    }

    console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
    console.error(err);
    process.exit(1);
  }
}

runPhase2Tests();
