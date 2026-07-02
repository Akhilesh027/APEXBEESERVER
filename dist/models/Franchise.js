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
exports.Franchise = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const FranchiseSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
        index: true,
    },
    franchiseCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    franchiseLevel: {
        type: String,
        enum: ["state", "district", "mandal"],
        required: true,
        index: true,
    },
    businessName: {
        type: String,
        required: true,
        trim: true,
    },
    ownerName: {
        type: String,
        required: true,
        trim: true,
    },
    mobile: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    profilePhoto: {
        type: String,
        default: "",
    },
    state: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    district: {
        type: String,
        default: "",
        trim: true,
        index: true,
    },
    mandal: {
        type: String,
        default: "",
        trim: true,
        index: true,
    },
    village: {
        type: String,
        default: "",
        trim: true,
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
    pincode: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    address: {
        type: String,
        required: true,
        trim: true,
    },
    latitude: {
        type: Number,
        default: null,
    },
    longitude: {
        type: Number,
        default: null,
    },
    parentFranchiseId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Franchise",
        default: null,
        index: true,
    },
    assignedTerritories: {
        type: [
            {
                type: mongoose_1.Schema.Types.ObjectId,
                ref: "Territory",
            },
        ],
        default: [],
    },
    totalVendors: {
        type: Number,
        default: 0,
    },
    totalManufacturers: {
        type: Number,
        default: 0,
    },
    totalWholesalers: {
        type: Number,
        default: 0,
    },
    totalServiceProviders: {
        type: Number,
        default: 0,
    },
    totalCourseProviders: {
        type: Number,
        default: 0,
    },
    totalEntrepreneurs: {
        type: Number,
        default: 0,
    },
    bankDetails: {
        accountHolderName: {
            type: String,
            default: "",
        },
        accountNumber: {
            type: String,
            default: "",
        },
        ifsc: {
            type: String,
            default: "",
        },
        bankName: {
            type: String,
            default: "",
        },
        upiId: {
            type: String,
            default: "",
        },
    },
    kycStatus: {
        type: String,
        enum: ["Not Submitted", "Pending Verification", "Approved", "Rejected"],
        default: "Pending Verification",
        index: true,
    },
    status: {
        type: String,
        enum: ["active", "inactive", "pending_verification"],
        default: "pending_verification",
        index: true,
    },
    approvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
FranchiseSchema.index({ franchiseLevel: 1, state: 1 });
FranchiseSchema.index({ franchiseLevel: 1, state: 1, district: 1 });
FranchiseSchema.index({ franchiseLevel: 1, state: 1, district: 1, mandal: 1 });
FranchiseSchema.index({ assignedTerritories: 1 });
FranchiseSchema.pre("validate", function (next) {
    if (this.franchiseLevel === "district" && !this.district) {
        return next(new Error("District is required for district franchise"));
    }
    if (this.franchiseLevel === "mandal" && (!this.district || !this.mandal)) {
        return next(new Error("District and mandal are required for mandal franchise"));
    }
    next();
});
FranchiseSchema.pre("save", async function (next) {
    if (!this.franchiseCode) {
        try {
            const count = await mongoose_1.default.model("Franchise").countDocuments({
                franchiseLevel: this.franchiseLevel,
            });
            const numStr = String(count + 1).padStart(4, "0");
            const prefix = this.franchiseLevel === "state"
                ? "FRA-STATE-"
                : this.franchiseLevel === "district"
                    ? "FRA-DIST-"
                    : "FRA-MANDAL-";
            this.franchiseCode = `${prefix}${numStr}`;
        }
        catch (err) {
            return next(err);
        }
    }
    next();
});
exports.Franchise = mongoose_1.default.model("Franchise", FranchiseSchema);
