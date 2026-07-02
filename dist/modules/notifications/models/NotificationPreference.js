"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationPreference = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const NotificationPreferenceSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    channels: {
        inApp: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false }
    },
    categories: {
        orders: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        business: { type: Boolean, default: true },
        inventory: { type: Boolean, default: true },
        franchise: { type: Boolean, default: true },
        marketing: { type: Boolean, default: false },
        system: { type: Boolean, default: true }
    },
    quietHours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: '22:00' },
        end: { type: String, default: '07:00' },
        timezone: { type: String, default: 'Asia/Kolkata' }
    }
}, { timestamps: true });
exports.NotificationPreference = mongoose_1.default.model('NotificationPreference', NotificationPreferenceSchema);
exports.default = exports.NotificationPreference;
