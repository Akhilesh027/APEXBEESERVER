import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env file
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const getBooleanFlag = (val: string | undefined, defaultVal = false): boolean => {
  if (val === undefined) return defaultVal;
  return val.toLowerCase() === 'true' || val === '1';
};

const requiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`[CONFIG ERROR] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value.trim();
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PROCESS_TYPE: process.env.PROCESS_TYPE || 'combined', // 'api', 'worker', 'combined'
  PORT: Number(process.env.PORT) || 5500,
  MONGODB_URI: requiredEnv('MONGODB_URI'),
  JWT_SECRET: requiredEnv('JWT_SECRET'),
  REDIS_URI: process.env.REDIS_URI || 'redis://127.0.0.1:6379',
  
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || '',
    API_KEY: process.env.CLOUDINARY_API_KEY || '',
    API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  },

  // Feature Flags
  ENABLE_ATOMIC_CHECKOUT: getBooleanFlag(process.env.ENABLE_ATOMIC_CHECKOUT, false),
  ENABLE_REDIS_OTP: getBooleanFlag(process.env.ENABLE_REDIS_OTP, false),
  ENABLE_REDIS_RATE_LIMIT: getBooleanFlag(process.env.ENABLE_REDIS_RATE_LIMIT, false),
  ENABLE_NEW_WALLET_LEDGER: getBooleanFlag(process.env.ENABLE_NEW_WALLET_LEDGER, false),
  ENABLE_BULLMQ_WORKERS: getBooleanFlag(process.env.ENABLE_BULLMQ_WORKERS, false),
  ENABLE_SOCKET_REDIS: getBooleanFlag(process.env.ENABLE_SOCKET_REDIS, false),
  MONGO_MAX_POOL_SIZE: Number(process.env.MONGO_MAX_POOL_SIZE) || 100,
  MONGO_MIN_POOL_SIZE: Number(process.env.MONGO_MIN_POOL_SIZE) || 10,
};

export default env;
