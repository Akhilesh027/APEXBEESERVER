"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusinessRelationshipById = exports.getBusinessRelationships = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const BusinessRelationship_1 = require("../models/BusinessRelationship");
const Franchise_1 = require("../models/Franchise");
const Entrepreneur_1 = require("../models/Entrepreneur");
const Vendor_1 = require("../models/Vendor");
const Manufacturer_1 = require("../models/Manufacturer");
const Wholesaler_1 = require("../models/Wholesaler");
const ServiceProvider_1 = require("../models/ServiceProvider");
const CourseProvider_1 = require("../models/CourseProvider");
const DeliveryPartner_1 = require("../models/DeliveryPartner");
const getBusinessRelationships = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const query = {};
        const roles = req.user.roles || [];
        // Filter by role unless Admin
        if (!roles.includes("admin")) {
            const isFranchise = roles.some(r => r.includes("franchise"));
            const isEntrepreneur = roles.includes("entrepreneur");
            if (isFranchise) {
                const franchise = await Franchise_1.Franchise.findOne({ userId: req.user.id });
                if (franchise) {
                    if (franchise.franchiseLevel === "state") {
                        query.stateFranchiseId = franchise._id;
                    }
                    else if (franchise.franchiseLevel === "district") {
                        query.districtFranchiseId = franchise._id;
                    }
                    else if (franchise.franchiseLevel === "mandal") {
                        query.mandalFranchiseId = franchise._id;
                    }
                }
                else {
                    // Empty result fallback if role is franchise but profile does not exist yet
                    query._id = new mongoose_1.default.Types.ObjectId();
                }
            }
            else if (isEntrepreneur) {
                const ent = await Entrepreneur_1.Entrepreneur.findOne({ userId: req.user.id });
                if (ent) {
                    query.entrepreneurId = ent._id;
                }
                else {
                    // Empty result fallback
                    query._id = new mongoose_1.default.Types.ObjectId();
                }
            }
            else {
                // Fallback for normal users/customers: show only their own relationships
                query.userId = req.user.id;
            }
        }
        const rels = await BusinessRelationship_1.BusinessRelationship.find(query)
            .populate("userId", "name email phone mobile")
            .populate("entrepreneurId", "name mobile email entrepreneurCode")
            .populate("stateFranchiseId", "businessName ownerName franchiseCode")
            .populate("districtFranchiseId", "businessName ownerName franchiseCode")
            .populate("mandalFranchiseId", "businessName ownerName franchiseCode")
            .populate("stateId", "name code")
            .populate("districtId", "name")
            .populate("mandalId", "name")
            .sort({ createdAt: -1 });
        const populatedRels = await Promise.all(rels.map(async (rel) => {
            const relObj = rel.toObject();
            let business = null;
            try {
                if (rel.businessType === "vendor") {
                    business = await Vendor_1.Vendor.findById(rel.businessId).select("businessName ownerName mobile email status");
                }
                else if (rel.businessType === "manufacturer") {
                    business = await Manufacturer_1.Manufacturer.findById(rel.businessId).select("businessName ownerName mobile email status");
                }
                else if (rel.businessType === "wholesaler") {
                    business = await Wholesaler_1.Wholesaler.findById(rel.businessId).select("businessName ownerName mobile email status");
                }
                else if (rel.businessType === "service_provider") {
                    business = await ServiceProvider_1.ServiceProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
                }
                else if (rel.businessType === "course_provider") {
                    business = await CourseProvider_1.CourseProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
                }
                else if (rel.businessType === "delivery_partner") {
                    business = await DeliveryPartner_1.DeliveryPartner.findById(rel.businessId).select("name mobile email status");
                }
            }
            catch (err) {
                console.error("Error populating dynamic business details:", err);
            }
            relObj.businessDetails = business;
            return relObj;
        }));
        res.status(200).json({
            success: true,
            count: populatedRels.length,
            data: populatedRels,
        });
    }
    catch (error) {
        console.error("Get business relationships error:", error);
        res.status(500).json({
            success: false,
            message: "Server error retrieving business relationships",
            error: error.message,
        });
    }
};
exports.getBusinessRelationships = getBusinessRelationships;
const getBusinessRelationshipById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ success: false, message: "Invalid relationship ID format" });
            return;
        }
        const rel = await BusinessRelationship_1.BusinessRelationship.findById(id)
            .populate("userId", "name email phone mobile")
            .populate("entrepreneurId", "name mobile email entrepreneurCode")
            .populate("stateFranchiseId", "businessName ownerName franchiseCode")
            .populate("districtFranchiseId", "businessName ownerName franchiseCode")
            .populate("mandalFranchiseId", "businessName ownerName franchiseCode")
            .populate("stateId", "name code")
            .populate("districtId", "name")
            .populate("mandalId", "name");
        if (!rel) {
            res.status(404).json({ success: false, message: "Business relationship not found" });
            return;
        }
        const relObj = rel.toObject();
        let business = null;
        try {
            if (rel.businessType === "vendor") {
                business = await Vendor_1.Vendor.findById(rel.businessId).select("businessName ownerName mobile email status");
            }
            else if (rel.businessType === "manufacturer") {
                business = await Manufacturer_1.Manufacturer.findById(rel.businessId).select("businessName ownerName mobile email status");
            }
            else if (rel.businessType === "wholesaler") {
                business = await Wholesaler_1.Wholesaler.findById(rel.businessId).select("businessName ownerName mobile email status");
            }
            else if (rel.businessType === "service_provider") {
                business = await ServiceProvider_1.ServiceProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
            }
            else if (rel.businessType === "course_provider") {
                business = await CourseProvider_1.CourseProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
            }
            else if (rel.businessType === "delivery_partner") {
                business = await DeliveryPartner_1.DeliveryPartner.findById(rel.businessId).select("name mobile email status");
            }
        }
        catch (err) {
            console.error("Error populating dynamic business details:", err);
        }
        relObj.businessDetails = business;
        res.status(200).json({
            success: true,
            data: relObj,
        });
    }
    catch (error) {
        console.error("Get business relationship by id error:", error);
        res.status(500).json({
            success: false,
            message: "Server error retrieving business relationship",
            error: error.message,
        });
    }
};
exports.getBusinessRelationshipById = getBusinessRelationshipById;
