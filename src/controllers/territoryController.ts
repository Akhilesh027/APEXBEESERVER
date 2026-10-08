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
      village,
      pincode,
      codeNumber,
      ftid: customFtid,
      status,
      density,
      targetCoverage,
      franchiseId,
      annualFranchiseFee,
      franchiseFeePerYear,
      advanceBookingType,
      advanceBookingValue,
      minBookingAdvance,
    } = req.body;

    if (!level || !state) {
      return res.status(400).json({
        success: false,
        message: "Level and state are required",
      });
    }

    if (!["State", "District", "Mandal", "Village", "Pincode"].includes(level)) {
      return res.status(400).json({
        success: false,
        message: "Invalid territory level",
      });
    }

    const paddedNumber = String(codeNumber || "1").padStart(3, "0");
    let parent: any = null;
    let parentFtid = "";
    let ftid = customFtid ? String(customFtid).trim().toUpperCase() : "";
    let name = state.trim();

    if (level === "State") {
      name = state.trim();
      if (!ftid) {
        ftid = `APX-SF-${paddedNumber}`;
      }
    }

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
      parentFtid = parent.ftid || "APX-SF-001";
      const sfNum = parentFtid.replace("APX-SF-", "").replace("APX-SF", "");
      if (!ftid) {
        ftid = `APX-SF${sfNum}-DF-${paddedNumber}`;
      }
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
      parentFtid = parent.ftid || "APX-SF001-DF-001";
      // e.g. APX-SF001-DF-001 -> SF001-DF001
      const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
      if (!ftid) {
        ftid = `APX-${parentParts}-MF-${paddedNumber}`;
      }
    }

    if (level === "Village") {
      if (!district || !mandal || (!village && !name)) {
        return res.status(400).json({
          success: false,
          message: "District, mandal and village name are required",
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

      name = (village || name).trim();
      parentFtid = parent.ftid || "APX-SF001-DF001-MF-001";
      const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
      if (!ftid) {
        ftid = `APX-${parentParts}-VF-${paddedNumber}`;
      }
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
      parentFtid = parent.ftid || "APX-SF001-DF001-MF-001";
      const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
      if (!ftid) {
        ftid = `APX-${parentParts}-PIN-${paddedNumber}`;
      }
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

    const fee = Number(annualFranchiseFee ?? franchiseFeePerYear ?? 0);
    const advType = advanceBookingType === "fixed" ? "fixed" : "percentage";
    const advVal = Number(advanceBookingValue ?? (advType === "percentage" ? 20 : 5000));
    const calculatedMinAdv = minBookingAdvance !== undefined && minBookingAdvance !== null
      ? Number(minBookingAdvance)
      : advType === "percentage"
        ? Math.round((fee * advVal) / 100)
        : advVal;

    let finalFtid = ftid;
    let finalCodeNumber = paddedNumber;
    let counter = parseInt(paddedNumber, 10) || 1;

    let existing = await Territory.findOne({ ftid: finalFtid });
    while (existing) {
      counter++;
      finalCodeNumber = String(counter).padStart(3, "0");
      if (level === "State") {
        finalFtid = `APX-SF-${finalCodeNumber}`;
      } else if (level === "District") {
        const sfNum = parentFtid.replace("APX-SF-", "").replace("APX-SF", "");
        finalFtid = `APX-SF${sfNum}-DF-${finalCodeNumber}`;
      } else if (level === "Mandal") {
        const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
        finalFtid = `APX-${parentParts}-MF-${finalCodeNumber}`;
      } else if (level === "Village") {
        const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
        finalFtid = `APX-${parentParts}-VF-${finalCodeNumber}`;
      } else if (level === "Pincode") {
        const parentParts = parentFtid.replace("APX-", "").replace(/-/g, "");
        finalFtid = `APX-${parentParts}-PIN-${finalCodeNumber}`;
      } else {
        finalFtid = `APX-TR-${finalCodeNumber}`;
      }
      existing = await Territory.findOne({ ftid: finalFtid });
    }

    const territory = await Territory.create({
      ftid: finalFtid,
      codeNumber: finalCodeNumber,
      level,
      name,
      state: state.trim(),
      district: level !== "State" ? district.trim() : "",
      mandal: level === "Mandal" || level === "Village" || level === "Pincode" ? mandal.trim() : "",
      village: level === "Village" ? name : "",
      pincode: level === "Pincode" ? String(pincode).trim() : "",
      parentId: parent?._id || null,
      parentFtid,
      franchiseId: franchiseId || null,
      franchiseStatus: franchiseId ? "ACTIVE" : "VACANT",
      currentFranchisee: franchise
        ? {
            franchiseId: franchise._id,
            name: franchise.businessName || franchise.ownerName || "",
            phone: franchise.mobile || "",
            email: franchise.email || "",
            assignedAt: new Date(),
          }
        : undefined,
      status: status || "Active",
      density: density || "Medium",
      targetCoverage: targetCoverage || "100%",
      annualFranchiseFee: fee,
      franchiseFeePerYear: fee,
      advanceBookingType: advType,
      advanceBookingValue: advVal,
      minBookingAdvance: calculatedMinAdv,
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
        message: "Territory or FTID already exists",
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
      ftid,
      codeNumber,
      name,
      state,
      district,
      mandal,
      village,
      pincode,
      status,
      franchiseStatus,
      density,
      targetCoverage,
      franchiseId,
      annualFranchiseFee,
      franchiseFeePerYear,
      advanceBookingType,
      advanceBookingValue,
      minBookingAdvance,
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

    if (ftid !== undefined && ftid !== "") existingTerritory.ftid = String(ftid).trim().toUpperCase();
    if (codeNumber !== undefined && codeNumber !== "") existingTerritory.codeNumber = String(codeNumber).trim().padStart(3, "0");
    if (name !== undefined && name !== "") existingTerritory.name = name.trim();
    if (state !== undefined && state !== "") existingTerritory.state = state.trim();
    if (district !== undefined) existingTerritory.district = district.trim();
    if (mandal !== undefined) existingTerritory.mandal = mandal.trim();
    if (village !== undefined) existingTerritory.village = village.trim();
    if (pincode !== undefined) existingTerritory.pincode = String(pincode).trim();
    if (status !== undefined) existingTerritory.status = status;
    if (franchiseStatus !== undefined) existingTerritory.franchiseStatus = franchiseStatus;
    if (density !== undefined) existingTerritory.density = density;
    if (targetCoverage !== undefined) existingTerritory.targetCoverage = targetCoverage.trim();
    if (annualFranchiseFee !== undefined || franchiseFeePerYear !== undefined) {
      const fee = Number(annualFranchiseFee ?? franchiseFeePerYear ?? 0);
      existingTerritory.annualFranchiseFee = fee;
      existingTerritory.franchiseFeePerYear = fee;
    }
    if (advanceBookingType !== undefined) {
      existingTerritory.advanceBookingType = advanceBookingType === "fixed" ? "fixed" : "percentage";
    }
    if (advanceBookingValue !== undefined) {
      existingTerritory.advanceBookingValue = Number(advanceBookingValue || 0);
    }
    if (minBookingAdvance !== undefined) {
      existingTerritory.minBookingAdvance = Number(minBookingAdvance || 0);
    } else if (advanceBookingType !== undefined || advanceBookingValue !== undefined || annualFranchiseFee !== undefined) {
      const fee = existingTerritory.annualFranchiseFee || 0;
      const advType = existingTerritory.advanceBookingType || "percentage";
      const advVal = existingTerritory.advanceBookingValue || 20;
      existingTerritory.minBookingAdvance = advType === "percentage" ? Math.round((fee * advVal) / 100) : advVal;
    }
    existingTerritory.franchiseId = newFranchiseId as any;

    if (newFranchiseId) {
      existingTerritory.franchiseStatus = "ACTIVE";
      const fDoc = await Franchise.findById(newFranchiseId);
      if (fDoc) {
        existingTerritory.currentFranchisee = {
          franchiseId: fDoc._id,
          name: fDoc.businessName || fDoc.ownerName || "",
          phone: fDoc.mobile || "",
          email: fDoc.email || "",
          assignedAt: new Date(),
        };
      }
    } else if (franchiseId === "" || franchiseId === null) {
      existingTerritory.franchiseStatus = "VACANT";
      existingTerritory.currentFranchisee = undefined;
    }

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
      .populate("parentId", "name level state district mandal village pincode ftid")
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
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Territory or FTID already exists",
      });
    }

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
    territory.franchiseStatus = "ACTIVE";
    territory.currentFranchisee = {
      franchiseId: franchise._id,
      name: franchise.businessName || franchise.ownerName || "",
      phone: franchise.mobile || "",
      email: franchise.email || "",
      assignedAt: new Date(),
    };
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
    territory.franchiseStatus = "VACANT";
    territory.currentFranchisee = undefined;
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

export const getTerritoryAvailability = async (req: Request, res: Response) => {
  try {
    const { level, state, district, mandal, village, pincode } = req.query;

    if (!level || !state) {
      return res.status(400).json({ success: false, message: "Level and state are required" });
    }

    const query: any = {
      level: String(level),
      state: new RegExp(`^${String(state).trim()}$`, "i"),
    };

    if (district) query.district = new RegExp(`^${String(district).trim()}$`, "i");
    if (mandal) query.mandal = new RegExp(`^${String(mandal).trim()}$`, "i");
    if (village) query.village = new RegExp(`^${String(village).trim()}$`, "i");
    if (pincode) query.pincode = String(pincode).trim();

    let territory = await Territory.findOne(query)
      .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel")
      .populate("parentId", "name level ftid");

    // Hierarchical fallback lookup if not found by exact level query
    if (!territory) {
      if (mandal) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district || "").trim()}$`, "i"),
          mandal: new RegExp(`^${String(mandal).trim()}$`, "i"),
        })
        .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel")
        .populate("parentId", "name level ftid");
      }
      if (!territory && district) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
          district: new RegExp(`^${String(district).trim()}$`, "i"),
        })
        .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel")
        .populate("parentId", "name level ftid");
      }
      if (!territory) {
        territory = await Territory.findOne({
          state: new RegExp(`^${String(state).trim()}$`, "i"),
        })
        .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel")
        .populate("parentId", "name level ftid");
      }
    }

    if (!territory) {
      const lvl = String(level);
      const defaultFee = lvl === "State" ? 500000 : lvl === "District" ? 150000 : lvl === "Mandal" ? 25000 : lvl === "Village" ? 5000 : 10000;
      const defaultAdvPct = 20;
      const minAdv = Math.round((defaultFee * defaultAdvPct) / 100);

      return res.json({
        success: true,
        exists: false,
        isAvailable: true,
        franchiseStatus: "VACANT",
        territory: null,
        annualFranchiseFee: defaultFee,
        advanceBookingType: "percentage",
        advanceBookingValue: defaultAdvPct,
        minBookingAdvance: minAdv,
      });
    }

    const isAvailable = territory.franchiseStatus === "VACANT" && !territory.franchiseId;
    const fee = Number(territory.annualFranchiseFee ?? territory.franchiseFeePerYear ?? (territory.level === "State" ? 500000 : territory.level === "District" ? 150000 : 25000));
    const advType = territory.advanceBookingType || "percentage";
    const advVal = Number(territory.advanceBookingValue !== undefined ? territory.advanceBookingValue : 20);
    const minAdv = territory.minBookingAdvance && territory.minBookingAdvance > 0 
      ? territory.minBookingAdvance 
      : advType === "percentage" 
        ? Math.round((fee * advVal) / 100) 
        : advVal;

    return res.json({
      success: true,
      exists: true,
      isAvailable,
      franchiseStatus: territory.franchiseStatus,
      territory,
      annualFranchiseFee: fee,
      advanceBookingType: advType,
      advanceBookingValue: advVal,
      minBookingAdvance: minAdv,
      currentFranchisee: territory.currentFranchisee || (territory.franchiseId ? { name: (territory.franchiseId as any).businessName || (territory.franchiseId as any).ownerName } : null),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTerritoryByPincode = async (req: Request, res: Response) => {
  try {
    const rawPin = req.params.pincode;
    const pincode = String(rawPin || "").trim();

    if (!pincode) {
      return res.status(400).json({ success: false, message: "Pincode is required" });
    }

    // 1. Direct search by level "Pincode" or pincode field
    let territory = await Territory.findOne({
      $or: [
        { pincode },
        { name: pincode, level: "Pincode" },
        { codeNumber: pincode }
      ]
    }).lean();

    // 2. Generic fallback search in Territory
    if (!territory) {
      territory = await Territory.findOne({ pincode }).lean();
    }

    if (territory && territory.state) {
      return res.json({
        success: true,
        territory: {
          state: territory.state,
          district: territory.district || "",
          mandal: territory.mandal || "",
          village: territory.village || "",
          pincode: territory.pincode || pincode,
          name: territory.name,
          ftid: territory.ftid,
        }
      });
    }

    return res.status(404).json({
      success: false,
      message: `No territory mapped for PIN code ${pincode}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};