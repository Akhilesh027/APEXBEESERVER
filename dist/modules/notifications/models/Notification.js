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
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const NotificationSchema = new mongoose_1.Schema({
    recipientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientType: {
        type: String,
        required: true,
        enum: ['User', 'Franchise', 'Vendor', 'Wholesaler', 'Manufacturer', 'ServiceProvider', 'DeliveryPartner'],
        default: 'User'
    },
    eventCode: { type: String, required: true, index: true },
    status: {
        type: String,
        required: true,
        enum: ['unread', 'read', 'archived', 'deleted'],
        default: 'unread',
        index: true
    },
    entityType: {
        type: String,
        enum: ['order', 'product', 'vendor', 'application', 'wallet', 'subscription', 'ticket', 'lead'],
        index: true
    },
    entityId: { type: mongoose_1.Schema.Types.ObjectId, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    deepLink: { type: String, default: '' },
    actions: [
        {
            label: { type: String, required: true },
            type: { type: String, enum: ['primary', 'secondary', 'danger'], default: 'primary' },
            url: { type: String, default: '' },
            api: { type: String, default: '' },
            method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' }
        }
    ],
    deliveryTimeline: [
        {
            status: { type: String, enum: ['created', 'sent', 'delivered', 'failed', 'read'], required: true },
            channel: { type: String, enum: ['inApp', 'email', 'sms', 'push', 'whatsapp'], required: true },
            timestamp: { type: Date, default: Date.now },
            errorDetails: { type: String, default: '' }
        }
    ],
    isBroadcast: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, index: true }
}, { timestamps: true });
// TTL index to automatically remove notifications after they expire
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
exports.default = exports.Notification;
