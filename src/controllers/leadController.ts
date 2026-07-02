import { Response } from "express";
import mongoose from "mongoose";
import { AuthRequest } from "../middleware/auth";
import { Lead } from "../models/Lead";
import { Entrepreneur } from "../models/Entrepreneur";
import { StateMaster } from "../models/StateMaster";
import { DistrictMaster } from "../models/DistrictMaster";
import { MandalMaster } from "../models/MandalMaster";

export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { name, mobile, email, source, state, district, mandal, notes } = req.body;

    if (!name || !mobile) {
      res.status(400).json({ success: false, message: "Lead name and mobile are required" });
      return;
    }

    // Resolve / Auto-upsert Masters from text fields if provided
    let stateId = null;
    let districtId = null;
    let mandalId = null;

    if (state) {
      let stateRecord = await StateMaster.findOne({ name: { $regex: new RegExp(`^${state}$`, "i") } });
      if (!stateRecord) {
        stateRecord = await StateMaster.create({
          name: state,
          code: state.split(" ").map((w: string) => w[0]).join("").toUpperCase().substring(0, 3) || "ST",
          status: "active",
        });
      }
      stateId = stateRecord._id;

      if (district) {
        let districtRecord = await DistrictMaster.findOne({
          stateId: stateRecord._id,
          name: { $regex: new RegExp(`^${district}$`, "i") },
        });
        if (!districtRecord) {
          districtRecord = await DistrictMaster.create({
            stateId: stateRecord._id,
            name: district,
            status: "active",
          });
        }
        districtId = districtRecord._id;

        if (mandal) {
          let mandalRecord = await MandalMaster.findOne({
            stateId: stateRecord._id,
            districtId: districtRecord._id,
            name: { $regex: new RegExp(`^${mandal}$`, "i") },
          });
          if (!mandalRecord) {
            mandalRecord = await MandalMaster.create({
              stateId: stateRecord._id,
              districtId: districtRecord._id,
              name: mandal,
              status: "active",
            });
          }
          mandalId = mandalRecord._id;
        }
      }
    }

    // Resolve Entrepreneur mapping (if creator is an entrepreneur)
    let entrepreneurId = null;
    const isEntrepreneur = req.user.roles?.includes("entrepreneur");
    if (isEntrepreneur) {
      const ent = await Entrepreneur.findOne({ userId: req.user.id });
      if (ent) {
        entrepreneurId = ent._id;
      }
    }

    const lead = await Lead.create({
      name,
      mobile,
      email,
      source: source || "Manual",
      entrepreneurId,
      stateId,
      districtId,
      mandalId,
      notes: notes || "",
      status: "New",
    });

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      lead,
    });
  } catch (error: any) {
    console.error("Create lead error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating lead",
      error: error.message,
    });
  }
};

export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const query: any = {};
    const roles = req.user.roles || [];

    if (!roles.includes("admin")) {
      const isEntrepreneur = roles.includes("entrepreneur");
      if (isEntrepreneur) {
        const ent = await Entrepreneur.findOne({ userId: req.user.id });
        if (ent) {
          query.entrepreneurId = ent._id;
        } else {
          query._id = new mongoose.Types.ObjectId(); // Fallback empty
        }
      }
    }

    const leads = await Lead.find(query)
      .populate("entrepreneurId", "name mobile email entrepreneurCode")
      .populate("stateId", "name code")
      .populate("districtId", "name")
      .populate("mandalId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leads.length,
      leads,
    });
  } catch (error: any) {
    console.error("Get leads error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving leads",
      error: error.message,
    });
  }
};

export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid lead ID format" });
      return;
    }

    const lead = await Lead.findById(id);
    if (!lead) {
      res.status(404).json({ success: false, message: "Lead not found" });
      return;
    }

    const { status, notes, convertedTo, convertedBusinessId } = req.body;

    if (status !== undefined) {
      lead.status = status;
      if (status === "Converted") {
        if (convertedTo) lead.convertedTo = convertedTo;
        if (convertedBusinessId) lead.convertedBusinessId = convertedBusinessId;
      }
    }

    if (notes !== undefined) lead.notes = notes;

    const savedLead = await lead.save();
    res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: savedLead,
    });
  } catch (error: any) {
    console.error("Update lead error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating lead",
      error: error.message,
    });
  }
};
