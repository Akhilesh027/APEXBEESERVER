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
exports.Territory = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TerritorySchema = new mongoose_1.Schema({
    level: {
        type: String,
        enum: ["State", "District", "Mandal", "Pincode"],
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
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
    pincode: {
        type: String,
        default: "",
        index: true,
    },
    parentId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Territory",
        default: null,
        index: true,
    },
    managerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true,
    },
    franchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: ["Active", "Inactive"],
        default: "Active",
    },
    density: {
        type: String,
        enum: ["High", "Medium", "Low"],
        default: "Medium",
    },
    targetCoverage: {
        type: String,
        default: "100%",
    },
}, {
    timestamps: true,
});
// Prevent duplicate territories
TerritorySchema.index({
    level: 1,
    state: 1,
    district: 1,
    mandal: 1,
    pincode: 1,
}, {
    unique: true,
});
exports.Territory = mongoose_1.default.model("Territory", TerritorySchema);
