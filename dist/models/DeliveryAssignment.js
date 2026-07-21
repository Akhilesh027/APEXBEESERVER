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
exports.DeliveryAssignment = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DeliveryAssignmentSchema = new mongoose_1.Schema({
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', required: true },
    deliveryPartnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    partnerSnapshot: {
        name: { type: String, required: true },
        phoneMasked: { type: String, required: true },
        photoUrl: { type: String },
    },
    assignedAt: { type: Date, required: true, default: Date.now },
    acceptedAt: { type: Date },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    deliveryOtpHash: { type: String },
    otpExpiresAt: { type: Date },
    currentLocation: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number] },
    },
    estimatedArrivalTime: { type: Date },
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, default: 'Pending' },
    failedReason: { type: String },
    codCollection: {
        expected: { type: Number, default: 0 },
        collected: { type: Number, default: 0 },
    },
    notes: { type: String },
    completedAt: { type: Date },
}, { timestamps: true });
DeliveryAssignmentSchema.index({ orderId: 1 });
DeliveryAssignmentSchema.index({ deliveryPartnerId: 1 });
if (DeliveryAssignmentSchema.index) {
    DeliveryAssignmentSchema.index({ currentLocation: '2dsphere' });
}
exports.DeliveryAssignment = mongoose_1.default.model('DeliveryAssignment', DeliveryAssignmentSchema);
exports.default = exports.DeliveryAssignment;
