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
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DeliveryPartner', index: true },
    franchiseId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Franchise', index: true },
    status: {
        type: String,
        enum: [
            'Created',
            'Assigned',
            'Accepted',
            'Reached Pickup',
            'Picked Up',
            'Out For Delivery',
            'Reached Customer',
            'OTP Verified',
            'Delivered',
            'Settlement Released',
            'Failed',
            'Reschedule',
            'Returned',
        ],
        default: 'Created',
        required: true,
    },
    assignedAt: { type: Date },
    acceptedAt: { type: Date },
    completedAt: { type: Date },
    failedReason: { type: String, default: '' },
    notes: { type: String, default: '' },
    codCollection: {
        collected: { type: Number, default: 0 },
        expected: { type: Number, default: 0 },
        submitted: { type: Boolean, default: false },
        verified: { type: Boolean, default: false },
    },
}, { timestamps: true });
exports.DeliveryAssignment = mongoose_1.default.model('DeliveryAssignment', DeliveryAssignmentSchema);
