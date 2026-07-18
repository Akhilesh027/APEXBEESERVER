import Redis from 'ioredis';
import { env } from './env';

let redisClient: any = null;

const isRedisEnabled = env.ENABLE_REDIS_OTP || env.ENABLE_REDIS_RATE_LIMIT || env.ENABLE_SOCKET_REDIS;

const isStagingOrProd = ['staging', 'production'].includes(env.NODE_ENV);

if (isRedisEnabled) {
  try {
    redisClient = new Redis(env.REDIS_URI || 'redis://127.0.0.1:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          if (isStagingOrProd) {
            console.error('[REDIS] Max retries reached. Redis is mandatory in staging and production.');
            return null; // Stop retrying
          }
          console.warn('[REDIS] Max retries reached. Falling back to Mock Memory Store.');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      }
    });

    redisClient.on('error', (err: any) => {
      console.warn('[REDIS CLIENT ERROR]', err.message);
    });
  } catch (err: any) {
    if (isStagingOrProd) {
      console.error('[REDIS INIT ERROR] Redis is mandatory in staging and production:', err.message);
      throw err;
    }
    console.warn('[REDIS INIT ERROR] Falling back to Mock Memory Store:', err.message);
  }
}

// Fallback Mock store matching basic ioredis API
class MockRedisStore {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ex?: string, seconds?: number): Promise<'OK'> {
    this.store.set(key, value);
    if (ex === 'EX' && seconds) {
      setTimeout(() => {
        this.store.delete(key);
      }, seconds * 1000);
    }
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key) ? 1 : 0;
    return deleted;
  }

  async incr(key: string): Promise<number> {
    const val = Number(this.store.get(key) || 0) + 1;
    this.store.set(key, String(val));
    return val;
  }

  async expire(key: string, seconds: number): Promise<number> {
    setTimeout(() => {
      this.store.delete(key);
    }, seconds * 1000);
    return 1;
  }

  multi() {
    const parent = this;
    const queue: (() => Promise<any>)[] = [];
    return {
      incr(key: string) {
        queue.push(async () => parent.incr(key));
        return this;
      },
      expire(key: string, seconds: number) {
        queue.push(async () => parent.expire(key, seconds));
        return this;
      },
      async exec(): Promise<any[]> {
        const results = [];
        for (const fn of queue) {
          results.push(await fn());
        }
        return results;
      }
    };
  }
}

let fallbackStore: any = null;

export const getRedisClient = () => {
  if (redisClient) {
    if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
      return redisClient;
    }
  }

  // Disallow local fallback in production or staging
  if (['staging', 'production'].includes(env.NODE_ENV)) {
    throw new Error('Redis client is unavailable. In-memory fallback is prohibited in staging and production.');
  }

  // Only allow mock when NODE_ENV is test or dev and ALLOW_REDIS_MEMORY_MOCK is true
  if ((env.NODE_ENV === 'test' || env.NODE_ENV === 'development') && process.env.ALLOW_REDIS_MEMORY_MOCK === 'true') {
    if (!fallbackStore) {
      fallbackStore = new MockRedisStore();
    }
    return fallbackStore;
  }

  throw new Error('Redis connection is mandatory. Memory fallback is disabled.');
};

export const checkRedisConnected = (): boolean => {
  return redisClient && redisClient.status === 'ready';
};

export default getRedisClient;
