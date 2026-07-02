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
exports.TerritoryMapping = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TerritoryMappingSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    businessType: {
        type: String,
        enum: [
            "vendor",
            "service_provider",
            "course_provider",
            "manufacturer",
            "wholesaler",
            "delivery_partner",
        ],
        required: true,
        index: true,
    },
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    state: {
        type: String,
        required: true,
        index: true,
    },
    district: {
        type: String,
        default: "",
        index: true,
    },
    mandal: {
        type: String,
        default: "",
        index: true,
    },
    village: {
        type: String,
        default: "",
    },
    stateFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    districtFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    mandalFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    entrepreneurId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Entrepreneur",
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
        index: true,
    },
    followUpStatus: {
        type: String,
        enum: ["new", "contacted", "in_progress", "converted", "not_interested"],
        default: "new",
        index: true,
    },
    followUpRemarks: {
        type: String,
        default: "",
    },
    lastFollowUpAt: {
        type: Date,
        default: null,
    },
    nextFollowUpAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
TerritoryMappingSchema.index({ businessType: 1, businessId: 1 }, { unique: true });
TerritoryMappingSchema.index({
    stateFranchiseId: 1,
    businessType: 1,
    status: 1,
});
TerritoryMappingSchema.index({
    districtFranchiseId: 1,
    businessType: 1,
    status: 1,
});
TerritoryMappingSchema.index({
    mandalFranchiseId: 1,
    businessType: 1,
    status: 1,
});
TerritoryMappingSchema.index({
    entrepreneurId: 1,
    businessType: 1,
    status: 1,
});
exports.TerritoryMapping = mongoose_1.default.model("TerritoryMapping", TerritoryMappingSchema);
