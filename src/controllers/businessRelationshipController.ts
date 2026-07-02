import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { BusinessRelationship } from "../models/BusinessRelationship";
import { Franchise } from "../models/Franchise";
import { Entrepreneur } from "../models/Entrepreneur";
import { Vendor } from "../models/Vendor";
import { Manufacturer } from "../models/Manufacturer";
import { Wholesaler } from "../models/Wholesaler";
import { ServiceProvider } from "../models/ServiceProvider";
import { CourseProvider } from "../models/CourseProvider";
import { DeliveryPartner } from "../models/DeliveryPartner";

export const getBusinessRelationships = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const query: any = {};
    const roles = req.user.roles || [];

    // Filter by role unless Admin
    if (!roles.includes("admin")) {
      const isFranchise = roles.some(r => r.includes("franchise"));
      const isEntrepreneur = roles.includes("entrepreneur");

      if (isFranchise) {
        const franchise = await Franchise.findOne({ userId: req.user.id });
        if (franchise) {
          if (franchise.franchiseLevel === "state") {
            query.stateFranchiseId = franchise._id;
          } else if (franchise.franchiseLevel === "district") {
            query.districtFranchiseId = franchise._id;
          } else if (franchise.franchiseLevel === "mandal") {
            query.mandalFranchiseId = franchise._id;
          }
        } else {
          // Empty result fallback if role is franchise but profile does not exist yet
          query._id = new mongoose.Types.ObjectId();
        }
      } else if (isEntrepreneur) {
        const ent = await Entrepreneur.findOne({ userId: req.user.id });
        if (ent) {
          query.entrepreneurId = ent._id;
        } else {
          // Empty result fallback
          query._id = new mongoose.Types.ObjectId();
        }
      } else {
        // Fallback for normal users/customers: show only their own relationships
        query.userId = req.user.id;
      }
    }

    const rels = await BusinessRelationship.find(query)
      .populate("userId", "name email phone mobile")
      .populate("entrepreneurId", "name mobile email entrepreneurCode")
      .populate("stateFranchiseId", "businessName ownerName franchiseCode")
      .populate("districtFranchiseId", "businessName ownerName franchiseCode")
      .populate("mandalFranchiseId", "businessName ownerName franchiseCode")
      .populate("stateId", "name code")
      .populate("districtId", "name")
      .populate("mandalId", "name")
      .sort({ createdAt: -1 });

    const populatedRels = await Promise.all(
      rels.map(async (rel) => {
        const relObj = rel.toObject() as any;
        let business = null;
        try {
          if (rel.businessType === "vendor") {
            business = await Vendor.findById(rel.businessId).select("businessName ownerName mobile email status");
          } else if (rel.businessType === "manufacturer") {
            business = await Manufacturer.findById(rel.businessId).select("businessName ownerName mobile email status");
          } else if (rel.businessType === "wholesaler") {
            business = await Wholesaler.findById(rel.businessId).select("businessName ownerName mobile email status");
          } else if (rel.businessType === "service_provider") {
            business = await ServiceProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
          } else if (rel.businessType === "course_provider") {
            business = await CourseProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
          } else if (rel.businessType === "delivery_partner") {
            business = await DeliveryPartner.findById(rel.businessId).select("name mobile email status");
          }
        } catch (err) {
          console.error("Error populating dynamic business details:", err);
        }
        relObj.businessDetails = business;
        return relObj;
      })
    );

    res.status(200).json({
      success: true,
      count: populatedRels.length,
      data: populatedRels,
    });
  } catch (error: any) {
    console.error("Get business relationships error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving business relationships",
      error: error.message,
    });
  }
};

export const getBusinessRelationshipById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid relationship ID format" });
      return;
    }

    const rel = await BusinessRelationship.findById(id)
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

    const relObj = rel.toObject() as any;
    let business = null;
    try {
      if (rel.businessType === "vendor") {
        business = await Vendor.findById(rel.businessId).select("businessName ownerName mobile email status");
      } else if (rel.businessType === "manufacturer") {
        business = await Manufacturer.findById(rel.businessId).select("businessName ownerName mobile email status");
      } else if (rel.businessType === "wholesaler") {
        business = await Wholesaler.findById(rel.businessId).select("businessName ownerName mobile email status");
      } else if (rel.businessType === "service_provider") {
        business = await ServiceProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
      } else if (rel.businessType === "course_provider") {
        business = await CourseProvider.findById(rel.businessId).select("businessName ownerName mobile email status");
      } else if (rel.businessType === "delivery_partner") {
        business = await DeliveryPartner.findById(rel.businessId).select("name mobile email status");
      }
    } catch (err) {
      console.error("Error populating dynamic business details:", err);
    }
    relObj.businessDetails = business;

    res.status(200).json({
      success: true,
      data: relObj,
    });
  } catch (error: any) {
    console.error("Get business relationship by id error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving business relationship",
      error: error.message,
    });
  }
};
