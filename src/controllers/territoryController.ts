import { Request, Response } from "express";
import mongoose from "mongoose";
import { Territory } from "../models/Territory";
import { Franchise } from "../models/Franchise";
import { StateMaster } from "../models/StateMaster";
import { DistrictMaster } from "../models/DistrictMaster";
import { MandalMaster } from "../models/MandalMaster";

export const getTerritories = async (req: Request, res: Response) => {
  try {
    const territories = await Territory.find()
      .populate("parentId", "name level state district mandal pincode")
      .populate(
        "franchiseId",
        "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal"
      )
      .sort({
        state: 1,
        district: 1,
        mandal: 1,
        pincode: 1,
      });

    res.json({
      success: true,
      territories,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createTerritory = async (req: Request, res: Response) => {
  try {
    const {
      level,
      state,
      district,
      mandal,
      pincode,
      status,
      density,
      targetCoverage,
      franchiseId,
    } = req.body;

    if (!level || !state) {
      return res.status(400).json({
        success: false,
        message: "Level and state are required",
      });
    }

    if (!["State", "District", "Mandal", "Pincode"].includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory level",
      });
    }

    let parent: any = null;
    let name = state.trim();

    if (level === "District") {
      if (!district) {
        return res.status(400).json({
          success: false,
          message: "District is required",
        });
      }

      parent = await Territory.findOne({
        level: "State",
        state: state.trim(),
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent state not found. Create state first.",
        });
      }

      name = district.trim();
    }

    if (level === "Mandal") {
      if (!district || !mandal) {
        return res.status(400).json({
          success: false,
          message: "District and mandal are required",
        });
      }

      parent = await Territory.findOne({
        level: "District",
        state: state.trim(),
        district: district.trim(),
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent district not found. Create district first.",
        });
      }

      name = mandal.trim();
    }

    if (level === "Pincode") {
      if (!district || !mandal || !pincode) {
        return res.status(400).json({
          success: false,
          message: "District, mandal and pincode are required",
        });
      }

      parent = await Territory.findOne({
        level: "Mandal",
        state: state.trim(),
        district: district.trim(),
        mandal: mandal.trim(),
      });

      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent mandal not found. Create mandal first.",
        });
      }

      name = String(pincode).trim();
    }

    let franchise = null;

    if (franchiseId) {
      if (!mongoose.Types.ObjectId.isValid(franchiseId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid franchiseId",
        });
      }

      franchise = await Franchise.findById(franchiseId);

      if (!franchise) {
        return res.status(404).json({
          success: false,
          message: "Franchise member not found",
        });
      }
    }

    const territory = await Territory.create({
      level,
      name,
      state: state.trim(),
      district: level !== "State" ? district.trim() : "",
      mandal: level === "Mandal" || level === "Pincode" ? mandal.trim() : "",
      pincode: level === "Pincode" ? String(pincode).trim() : "",
      parentId: parent?._id || null,
      franchiseId: franchiseId || null,
      status: status || "Active",
      density: density || "Medium",
      targetCoverage: targetCoverage || "100%",
    });

    if (franchiseId) {
      await Franchise.findByIdAndUpdate(franchiseId, {
        $addToSet: {
          assignedTerritories: territory._id,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: "Territory created successfully",
      territory,
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Territory already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateTerritory = async (req: Request, res: Response) => {
  try {
    const territoryId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(territoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory id",
      });
    }

    const existingTerritory = await Territory.findById(territoryId);

    if (!existingTerritory) {
      return res.status(404).json({
        success: false,
        message: "Territory not found",
      });
    }

    const {
      status,
      density,
      targetCoverage,
      franchiseId,
    } = req.body;

    const oldFranchiseId = existingTerritory.franchiseId
      ? String(existingTerritory.franchiseId)
      : null;

    let newFranchiseId = oldFranchiseId;

    if (franchiseId !== undefined) {
      if (franchiseId === "" || franchiseId === null) {
        newFranchiseId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(franchiseId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid franchiseId",
          });
        }

        const franchiseExists = await Franchise.findById(franchiseId);

        if (!franchiseExists) {
          return res.status(404).json({
            success: false,
            message: "Franchise member not found",
          });
        }

        newFranchiseId = franchiseId;
      }
    }

    existingTerritory.status = status || existingTerritory.status;
    existingTerritory.density = density || existingTerritory.density;
    existingTerritory.targetCoverage =
      targetCoverage || existingTerritory.targetCoverage;
    existingTerritory.franchiseId = newFranchiseId as any;

    await existingTerritory.save();

    if (oldFranchiseId && oldFranchiseId !== newFranchiseId) {
      await Franchise.findByIdAndUpdate(oldFranchiseId, {
        $pull: {
          assignedTerritories: existingTerritory._id,
        },
      });
    }

    if (newFranchiseId) {
      await Franchise.findByIdAndUpdate(newFranchiseId, {
        $addToSet: {
          assignedTerritories: existingTerritory._id,
        },
      });
    }

    const updatedTerritory = await Territory.findById(territoryId)
      .populate("parentId", "name level state district mandal pincode")
      .populate(
        "franchiseId",
        "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal"
      );

    res.json({
      success: true,
      message: "Territory updated successfully",
      territory: updatedTerritory,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const assignTerritory = async (req: Request, res: Response) => {
  try {
    const territoryId = req.params.id;
    const { franchiseId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(territoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory id",
      });
    }

    if (!franchiseId) {
      return res.status(400).json({
        success: false,
        message: "franchiseId is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(franchiseId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid franchiseId",
      });
    }

    const territory = await Territory.findById(territoryId);

    if (!territory) {
      return res.status(404).json({
        success: false,
        message: "Territory not found",
      });
    }

    const franchise = await Franchise.findById(franchiseId);

    if (!franchise) {
      return res.status(404).json({
        success: false,
        message: "Franchise member not found",
      });
    }

    const oldFranchiseId = territory.franchiseId
      ? String(territory.franchiseId)
      : null;

    if (oldFranchiseId && oldFranchiseId !== String(franchiseId)) {
      await Franchise.findByIdAndUpdate(oldFranchiseId, {
        $pull: {
          assignedTerritories: territory._id,
        },
      });
    }

    territory.franchiseId = franchise._id as any;
    await territory.save();

    await Franchise.findByIdAndUpdate(franchiseId, {
      $addToSet: {
        assignedTerritories: territory._id,
      },
    });

    const updatedTerritory = await Territory.findById(territoryId)
      .populate("parentId", "name level state district mandal pincode")
      .populate(
        "franchiseId",
        "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal"
      );

    res.json({
      success: true,
      message: "Franchise assigned to territory successfully",
      territory: updatedTerritory,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeTerritoryAssignment = async (
  req: Request,
  res: Response
) => {
  try {
    const territoryId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(territoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory id",
      });
    }

    const territory = await Territory.findById(territoryId);

    if (!territory) {
      return res.status(404).json({
        success: false,
        message: "Territory not found",
      });
    }

    const oldFranchiseId = territory.franchiseId
      ? String(territory.franchiseId)
      : null;

    if (oldFranchiseId) {
      await Franchise.findByIdAndUpdate(oldFranchiseId, {
        $pull: {
          assignedTerritories: territory._id,
        },
      });
    }

    territory.franchiseId = null as any;
    await territory.save();

    res.json({
      success: true,
      message: "Territory assignment removed successfully",
      territory,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteTerritory = async (req: Request, res: Response) => {
  try {
    const territoryId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(territoryId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory id",
      });
    }

    const childCount = await Territory.countDocuments({
      parentId: territoryId,
    });

    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete territory. Delete child territories first.",
      });
    }

    const territory = await Territory.findByIdAndDelete(territoryId);

    if (!territory) {
      return res.status(404).json({
        success: false,
        message: "Territory not found",
      });
    }

    if (territory.franchiseId) {
      await Franchise.findByIdAndUpdate(territory.franchiseId, {
        $pull: {
          assignedTerritories: territory._id,
        },
      });
    }

    res.json({
      success: true,
      message: "Territory deleted successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTerritoryTree = async (req: Request, res: Response) => {
  try {
    const territories = await Territory.find()
      .populate(
        "franchiseId",
        "businessName ownerName email mobile franchiseCode franchiseLevel"
      )
      .lean();

    const states = territories.filter((t: any) => t.level === "State");

    const tree = states.map((state: any) => ({
      ...state,
      districts: territories
        .filter((d: any) => String(d.parentId) === String(state._id))
        .map((district: any) => ({
          ...district,
          mandals: territories
            .filter((m: any) => String(m.parentId) === String(district._id))
            .map((mandal: any) => ({
              ...mandal,
              pincodes: territories.filter(
                (p: any) => String(p.parentId) === String(mandal._id)
              ),
            })),
        })),
    }));

    res.json({
      success: true,
      tree,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getStates = async (req: Request, res: Response) => {
  try {
    const states = await StateMaster.find({ status: "active" }).sort({ name: 1 });
    res.json({ success: true, count: states.length, states });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDistricts = async (req: Request, res: Response) => {
  try {
    const { stateId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(stateId)) {
      return res.status(400).json({ success: false, message: "Invalid stateId format" });
    }
    const districts = await DistrictMaster.find({ stateId, status: "active" }).sort({ name: 1 });
    res.json({ success: true, count: districts.length, districts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMandals = async (req: Request, res: Response) => {
  try {
    const { districtId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(districtId)) {
      return res.status(400).json({ success: false, message: "Invalid districtId format" });
    }
    const mandals = await MandalMaster.find({ districtId, status: "active" }).sort({ name: 1 });
    res.json({ success: true, count: mandals.length, mandals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};