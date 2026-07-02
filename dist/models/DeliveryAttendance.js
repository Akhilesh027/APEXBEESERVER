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
exports.DeliveryAttendance = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CoordsSchema = new mongoose_1.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
}, { _id: false });
const BreakSchema = new mongoose_1.Schema({
    start: { type: Date, required: true },
    end: { type: Date },
    reason: { type: String, default: '' }
}, { _id: false });
const DeliveryAttendanceSchema = new mongoose_1.Schema({
    partnerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'DeliveryPartner', required: true, index: true },
    date: { type: String, required: true, index: true },
    checkInTime: { type: Date },
    checkOutTime: { type: Date },
    breaks: { type: [BreakSchema], default: [] },
    status: { type: String, enum: ['CheckedIn', 'OnBreak', 'CheckedOut'], default: 'CheckedOut', required: true },
    startLocation: { type: CoordsSchema },
    endLocation: { type: CoordsSchema }
}, { timestamps: true });
exports.DeliveryAttendance = mongoose_1.default.model('DeliveryAttendance', DeliveryAttendanceSchema);
