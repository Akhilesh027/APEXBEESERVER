import { Request, Response } from "express";
import mongoose from "mongoose";
import { CommissionRule } from "../models/CommissionRule";

export const getCommissionRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = await CommissionRule.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: rules.length,
      rules,
    });
  } catch (error: any) {
    console.error("Get commission rules error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving commission rules",
      error: error.message,
    });
  }
};

export const createCommissionRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      businessType,
      entrepreneurPercent,
      mandalPercent,
      districtPercent,
      statePercent,
      companyPercent,
    } = req.body;

    if (!businessType) {
      res.status(400).json({ success: false, message: "businessType is required" });
      return;
    }

    const rule = await CommissionRule.findOneAndUpdate(
      { businessType: String(businessType).toLowerCase().trim() },
      {
        businessType: String(businessType).toLowerCase().trim(),
        entrepreneurPercent: Number(entrepreneurPercent || 0),
        mandalPercent: Number(mandalPercent || 0),
        districtPercent: Number(districtPercent || 0),
        statePercent: Number(statePercent || 0),
        companyPercent: Number(companyPercent || 0),
        active: true,
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      success: true,
      message: "Commission rule created/updated successfully",
      rule,
    });
  } catch (error: any) {
    console.error("Create commission rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error creating commission rule",
      error: error.message,
    });
  }
};

export const updateCommissionRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: "Invalid rule ID format" });
      return;
    }

    const rule = await CommissionRule.findById(id);
    if (!rule) {
      res.status(404).json({ success: false, message: "Commission rule not found" });
      return;
    }

    const {
      entrepreneurPercent,
      mandalPercent,
      districtPercent,
      statePercent,
      companyPercent,
      active,
    } = req.body;

    if (entrepreneurPercent !== undefined) rule.entrepreneurPercent = Number(entrepreneurPercent);
    if (mandalPercent !== undefined) rule.mandalPercent = Number(mandalPercent);
    if (districtPercent !== undefined) rule.districtPercent = Number(districtPercent);
    if (statePercent !== undefined) rule.statePercent = Number(statePercent);
    if (companyPercent !== undefined) rule.companyPercent = Number(companyPercent);
    if (active !== undefined) rule.active = Boolean(active);

    const savedRule = await rule.save();
    res.status(200).json({
      success: true,
      message: "Commission rule updated successfully",
      rule: savedRule,
    });
  } catch (error: any) {
    console.error("Update commission rule error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating commission rule",
      error: error.message,
    });
  }
};
