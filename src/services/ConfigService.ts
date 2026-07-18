import mongoose from 'mongoose';
import SystemConfig from '../models/SystemConfig';

export class ConfigService {
  private static cache: Map<string, { value: any; expiry: number }> = new Map();
  private static TTL = 5000; // 5 seconds cache TTL

  static async getFlag(key: string, defaultValue: boolean = false): Promise<boolean> {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }

    try {
      const config = await SystemConfig.findOne({ key });
      const value = config ? Boolean(config.value) : defaultValue;
      this.cache.set(key, { value, expiry: Date.now() + this.TTL });
      return value;
    } catch (err) {
      console.error(`[ConfigService] Error fetching key "${key}":`, err);
      return defaultValue;
    }
  }

  static async setFlag(key: string, value: boolean): Promise<void> {
    await SystemConfig.findOneAndUpdate(
      { key },
      {
        key,
        displayName: key,
        value,
        dataType: 'boolean',
        description: `Dynamic feature flag: ${key}`
      },
      { upsert: true, new: true }
    );
    // Invalidate local cache item immediately
    this.cache.delete(key);
  }
}
