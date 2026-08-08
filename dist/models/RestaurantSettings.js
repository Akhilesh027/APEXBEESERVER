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
exports.RestaurantSettings = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RestaurantSettingsSchema = new mongoose_1.Schema({
    restaurantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'RestaurantProfile', required: true, unique: true, index: true },
    storeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    defaultPreparationMinutes: { type: Number, default: 20 },
    acceptingOrders: { type: Boolean, default: true },
    autoAcceptOrders: { type: Boolean, default: false },
    codEnabled: { type: Boolean, default: true },
    pickupEnabled: { type: Boolean, default: true },
    deliveryEnabled: { type: Boolean, default: true },
    minimumOrderValue: { type: Number, default: 100 },
    packagingChargeMode: {
        type: String,
        enum: ['PER_ITEM', 'PER_ORDER', 'NONE'],
        default: 'PER_ORDER',
    },
    defaultPackagingCharge: { type: Number, default: 15 },
    busyModeExtraMinutes: { type: Number, default: 15 },
    maxConcurrentOrders: { type: Number, default: 50 },
    pauseOrdersWhenCapacityReached: { type: Boolean, default: false },
    scheduledOrdersEnabled: { type: Boolean, default: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    orderNotificationSound: { type: Boolean, default: true },
}, { timestamps: true });
exports.RestaurantSettings = mongoose_1.default.model('RestaurantSettings', RestaurantSettingsSchema);
exports.default = exports.RestaurantSettings;
