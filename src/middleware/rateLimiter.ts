import { Request, Response, NextFunction } from 'express';
import getRedisClient from '../config/redis';
import { env } from '../config/env';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  useUserContext?: boolean;
}

/**
 * Redis-backed rate limiter middleware creator
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // If rate limiting is disabled globally, skip check
    if (!env.ENABLE_REDIS_RATE_LIMIT) {
      return next();
    }

    try {
      const redis = getRedisClient();
      let limitKey = '';

      const user = (req as any).user;
      if (options.useUserContext && user) {
        const userId = user.id || user._id;
        limitKey = `rl:${options.keyPrefix}:user:${userId}`;
      } else {
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
    } catch (err: any) {
      console.warn('[RATE LIMITER ERROR] Proceeding without rate limit constraints:', err.message);
      return next();
    }
  };
};

// 1. IP rate limiter: 60 requests per minute
export const ipRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyPrefix: 'ip_general',
});

// 2. User rate limiter: 200 requests per minute
export const userRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  keyPrefix: 'user_general',
  useUserContext: true,
});

// 3. Critical endpoints rate limiter: 5 requests per minute
export const criticalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  keyPrefix: 'critical',
});

export default {
  ipRateLimiter,
  userRateLimiter,
  criticalRateLimiter,
};
