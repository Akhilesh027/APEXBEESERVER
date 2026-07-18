"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const SystemConfig_1 = __importDefault(require("../models/SystemConfig"));
class ConfigService {
    static cache = new Map();
    static TTL = 5000; // 5 seconds cache TTL
    static async getFlag(key, defaultValue = false) {
        const cached = this.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }
        try {
            const config = await SystemConfig_1.default.findOne({ key });
            const value = config ? Boolean(config.value) : defaultValue;
            this.cache.set(key, { value, expiry: Date.now() + this.TTL });
            return value;
        }
        catch (err) {
            console.error(`[ConfigService] Error fetching key "${key}":`, err);
            return defaultValue;
        }
    }
    static async setFlag(key, value) {
        await SystemConfig_1.default.findOneAndUpdate({ key }, {
            key,
            displayName: key,
            value,
            dataType: 'boolean',
            description: `Dynamic feature flag: ${key}`
        }, { upsert: true, new: true });
        // Invalidate local cache item immediately
        this.cache.delete(key);
    }
}
exports.ConfigService = ConfigService;
