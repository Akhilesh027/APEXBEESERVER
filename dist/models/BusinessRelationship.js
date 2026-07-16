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
exports.BusinessRelationship = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const BusinessRelationshipSchema = new mongoose_1.Schema({
    businessType: {
        type: String,
        enum: ["vendor", "manufacturer", "wholesaler", "service_provider", "course_provider", "delivery_partner"],
        required: true,
        index: true,
    },
    businessId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    entrepreneurId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Entrepreneur",
        default: null,
        index: true,
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
    stateId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "StateMaster",
        default: null,
        index: true,
    },
    districtId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "DistrictMaster",
        default: null,
        index: true,
    },
    mandalId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "MandalMaster",
        default: null,
        index: true,
    },
    status: {
        type: String,
        default: "active",
        index: true,
    },
    notes: {
        type: String,
        default: ""
    },
}, {
    timestamps: true,
});
exports.BusinessRelationship = mongoose_1.default.model("BusinessRelationship", BusinessRelationshipSchema);
