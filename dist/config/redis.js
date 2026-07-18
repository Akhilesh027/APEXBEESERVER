"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRedisConnected = exports.getRedisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
let redisClient = null;
const isRedisEnabled = env_1.env.ENABLE_REDIS_OTP || env_1.env.ENABLE_REDIS_RATE_LIMIT || env_1.env.ENABLE_SOCKET_REDIS;
const isStagingOrProd = ['staging', 'production'].includes(env_1.env.NODE_ENV);
if (isRedisEnabled) {
    try {
        redisClient = new ioredis_1.default(env_1.env.REDIS_URI || 'redis://127.0.0.1:6379', {
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
        redisClient.on('error', (err) => {
            console.warn('[REDIS CLIENT ERROR]', err.message);
        });
    }
    catch (err) {
        if (isStagingOrProd) {
            console.error('[REDIS INIT ERROR] Redis is mandatory in staging and production:', err.message);
            throw err;
        }
        console.warn('[REDIS INIT ERROR] Falling back to Mock Memory Store:', err.message);
    }
}
// Fallback Mock store matching basic ioredis API
class MockRedisStore {
    store = new Map();
    async get(key) {
        return this.store.get(key) || null;
    }
    async set(key, value, ex, seconds) {
        this.store.set(key, value);
        if (ex === 'EX' && seconds) {
            setTimeout(() => {
                this.store.delete(key);
            }, seconds * 1000);
        }
        return 'OK';
    }
    async del(key) {
        const deleted = this.store.delete(key) ? 1 : 0;
        return deleted;
    }
    async incr(key) {
        const val = Number(this.store.get(key) || 0) + 1;
        this.store.set(key, String(val));
        return val;
    }
    async expire(key, seconds) {
        setTimeout(() => {
            this.store.delete(key);
        }, seconds * 1000);
        return 1;
    }
    multi() {
        const parent = this;
        const queue = [];
        return {
            incr(key) {
                queue.push(async () => parent.incr(key));
                return this;
            },
            expire(key, seconds) {
                queue.push(async () => parent.expire(key, seconds));
                return this;
            },
            async exec() {
                const results = [];
                for (const fn of queue) {
                    results.push(await fn());
                }
                return results;
            }
        };
    }
}
let fallbackStore = null;
const getRedisClient = () => {
    if (redisClient) {
        if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
            return redisClient;
        }
    }
    // Disallow local fallback in production or staging
    if (['staging', 'production'].includes(env_1.env.NODE_ENV)) {
        throw new Error('Redis client is unavailable. In-memory fallback is prohibited in staging and production.');
    }
    // Only allow mock when NODE_ENV is test or dev and ALLOW_REDIS_MEMORY_MOCK is true
    if ((env_1.env.NODE_ENV === 'test' || env_1.env.NODE_ENV === 'development') && process.env.ALLOW_REDIS_MEMORY_MOCK === 'true') {
        if (!fallbackStore) {
            fallbackStore = new MockRedisStore();
        }
        return fallbackStore;
    }
    throw new Error('Redis connection is mandatory. Memory fallback is disabled.');
};
exports.getRedisClient = getRedisClient;
const checkRedisConnected = () => {
    return redisClient && redisClient.status === 'ready';
};
exports.checkRedisConnected = checkRedisConnected;
exports.default = exports.getRedisClient;
