"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.criticalRateLimiter = exports.userRateLimiter = exports.ipRateLimiter = exports.createRateLimiter = void 0;
const redis_1 = __importDefault(require("../config/redis"));
const env_1 = require("../config/env");
/**
 * Redis-backed rate limiter middleware creator
 */
const createRateLimiter = (options) => {
    return async (req, res, next) => {
        // If rate limiting is disabled globally, skip check
        if (!env_1.env.ENABLE_REDIS_RATE_LIMIT) {
            return next();
        }
        try {
            const redis = (0, redis_1.default)();
            let limitKey = '';
            const user = req.user;
            if (options.useUserContext && user) {
                const userId = user.id || user._id;
                limitKey = `rl:${options.keyPrefix}:user:${userId}`;
            }
            else {
                const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
                limitKey = `rl:${options.keyPrefix}:ip:${String(ip)}`;
            }
            // Check current rate value
            const current = await redis.get(limitKey);
            if (current && Number(current) >= options.max) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests. Please try again later.',
                });
            }
            // Increment atomically
            const pipeline = redis.multi();
            pipeline.incr(limitKey);
            if (!current) {
                pipeline.expire(limitKey, Math.ceil(options.windowMs / 1000));
            }
            await pipeline.exec();
            return next();
        }
        catch (err) {
            console.warn('[RATE LIMITER ERROR] Proceeding without rate limit constraints:', err.message);
            return next();
        }
    };
};
exports.createRateLimiter = createRateLimiter;
// 1. IP rate limiter: 60 requests per minute
exports.ipRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: 'ip_general',
});
// 2. User rate limiter: 200 requests per minute
exports.userRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 200,
    keyPrefix: 'user_general',
    useUserContext: true,
});
// 3. Critical endpoints rate limiter: 5 requests per minute
exports.criticalRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    max: 5,
    keyPrefix: 'critical',
});
exports.default = {
    ipRateLimiter: exports.ipRateLimiter,
    userRateLimiter: exports.userRateLimiter,
    criticalRateLimiter: exports.criticalRateLimiter,
};
