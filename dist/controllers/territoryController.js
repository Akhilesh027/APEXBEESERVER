"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMandals = exports.getDistricts = exports.getStates = exports.getTerritoryTree = exports.deleteTerritory = exports.removeTerritoryAssignment = exports.assignTerritory = exports.updateTerritory = exports.createTerritory = exports.getTerritories = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Territory_1 = require("../models/Territory");
const Franchise_1 = require("../models/Franchise");
const StateMaster_1 = require("../models/StateMaster");
const DistrictMaster_1 = require("../models/DistrictMaster");
const MandalMaster_1 = require("../models/MandalMaster");
const getTerritories = async (req, res) => {
    try {
        const territories = await Territory_1.Territory.find()
            .populate("parentId", "name level state district mandal pincode")
            .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal")
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getTerritories = getTerritories;
const createTerritory = async (req, res) => {
    try {
        const { level, state, district, mandal, village, pincode, codeNumber, ftid: customFtid, status, density, targetCoverage, franchiseId, } = req.body;
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
        let parent = null;
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
            parent = await Territory_1.Territory.findOne({
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
            parent = await Territory_1.Territory.findOne({
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
            parent = await Territory_1.Territory.findOne({
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
            parent = await Territory_1.Territory.findOne({
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
            if (!mongoose_1.default.Types.ObjectId.isValid(franchiseId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid franchiseId",
                });
            }
            franchise = await Franchise_1.Franchise.findById(franchiseId);
            if (!franchise) {
                return res.status(404).json({
                    success: false,
                    message: "Franchise member not found",
                });
            }
        }
        const territory = await Territory_1.Territory.create({
            ftid,
            codeNumber: paddedNumber,
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
        });
        if (franchiseId) {
            await Franchise_1.Franchise.findByIdAndUpdate(franchiseId, {
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
    }
    catch (error) {
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
exports.createTerritory = createTerritory;
const updateTerritory = async (req, res) => {
    try {
        const territoryId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(territoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid territory id",
            });
        }
        const existingTerritory = await Territory_1.Territory.findById(territoryId);
        if (!existingTerritory) {
            return res.status(404).json({
                success: false,
                message: "Territory not found",
            });
        }
        const { ftid, codeNumber, name, state, district, mandal, village, pincode, status, franchiseStatus, density, targetCoverage, franchiseId, } = req.body;
        const oldFranchiseId = existingTerritory.franchiseId
            ? String(existingTerritory.franchiseId)
            : null;
        let newFranchiseId = oldFranchiseId;
        if (franchiseId !== undefined) {
            if (franchiseId === "" || franchiseId === null) {
                newFranchiseId = null;
            }
            else {
                if (!mongoose_1.default.Types.ObjectId.isValid(franchiseId)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid franchiseId",
                    });
                }
                const franchiseExists = await Franchise_1.Franchise.findById(franchiseId);
                if (!franchiseExists) {
                    return res.status(404).json({
                        success: false,
                        message: "Franchise member not found",
                    });
                }
                newFranchiseId = franchiseId;
            }
        }
        if (ftid !== undefined && ftid !== "")
            existingTerritory.ftid = String(ftid).trim().toUpperCase();
        if (codeNumber !== undefined && codeNumber !== "")
            existingTerritory.codeNumber = String(codeNumber).trim().padStart(3, "0");
        if (name !== undefined && name !== "")
            existingTerritory.name = name.trim();
        if (state !== undefined && state !== "")
            existingTerritory.state = state.trim();
        if (district !== undefined)
            existingTerritory.district = district.trim();
        if (mandal !== undefined)
            existingTerritory.mandal = mandal.trim();
        if (village !== undefined)
            existingTerritory.village = village.trim();
        if (pincode !== undefined)
            existingTerritory.pincode = String(pincode).trim();
        if (status !== undefined)
            existingTerritory.status = status;
        if (franchiseStatus !== undefined)
            existingTerritory.franchiseStatus = franchiseStatus;
        if (density !== undefined)
            existingTerritory.density = density;
        if (targetCoverage !== undefined)
            existingTerritory.targetCoverage = targetCoverage.trim();
        existingTerritory.franchiseId = newFranchiseId;
        if (newFranchiseId) {
            existingTerritory.franchiseStatus = "ACTIVE";
            const fDoc = await Franchise_1.Franchise.findById(newFranchiseId);
            if (fDoc) {
                existingTerritory.currentFranchisee = {
                    franchiseId: fDoc._id,
                    name: fDoc.businessName || fDoc.ownerName || "",
                    phone: fDoc.mobile || "",
                    email: fDoc.email || "",
                    assignedAt: new Date(),
                };
            }
        }
        else if (franchiseId === "" || franchiseId === null) {
            existingTerritory.franchiseStatus = "VACANT";
            existingTerritory.currentFranchisee = undefined;
        }
        await existingTerritory.save();
        if (oldFranchiseId && oldFranchiseId !== newFranchiseId) {
            await Franchise_1.Franchise.findByIdAndUpdate(oldFranchiseId, {
                $pull: {
                    assignedTerritories: existingTerritory._id,
                },
            });
        }
        if (newFranchiseId) {
            await Franchise_1.Franchise.findByIdAndUpdate(newFranchiseId, {
                $addToSet: {
                    assignedTerritories: existingTerritory._id,
                },
            });
        }
        const updatedTerritory = await Territory_1.Territory.findById(territoryId)
            .populate("parentId", "name level state district mandal village pincode ftid")
            .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal");
        res.json({
            success: true,
            message: "Territory updated successfully",
            territory: updatedTerritory,
        });
    }
    catch (error) {
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
exports.updateTerritory = updateTerritory;
const assignTerritory = async (req, res) => {
    try {
        const territoryId = req.params.id;
        const { franchiseId } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(territoryId)) {
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
        if (!mongoose_1.default.Types.ObjectId.isValid(franchiseId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid franchiseId",
            });
        }
        const territory = await Territory_1.Territory.findById(territoryId);
        if (!territory) {
            return res.status(404).json({
                success: false,
                message: "Territory not found",
            });
        }
        const franchise = await Franchise_1.Franchise.findById(franchiseId);
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
            await Franchise_1.Franchise.findByIdAndUpdate(oldFranchiseId, {
                $pull: {
                    assignedTerritories: territory._id,
                },
            });
        }
        territory.franchiseId = franchise._id;
        territory.franchiseStatus = "ACTIVE";
        territory.currentFranchisee = {
            franchiseId: franchise._id,
            name: franchise.businessName || franchise.ownerName || "",
            phone: franchise.mobile || "",
            email: franchise.email || "",
            assignedAt: new Date(),
        };
        await territory.save();
        await Franchise_1.Franchise.findByIdAndUpdate(franchiseId, {
            $addToSet: {
                assignedTerritories: territory._id,
            },
        });
        const updatedTerritory = await Territory_1.Territory.findById(territoryId)
            .populate("parentId", "name level state district mandal pincode")
            .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal");
        res.json({
            success: true,
            message: "Franchise assigned to territory successfully",
            territory: updatedTerritory,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.assignTerritory = assignTerritory;
const removeTerritoryAssignment = async (req, res) => {
    try {
        const territoryId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(territoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid territory id",
            });
        }
        const territory = await Territory_1.Territory.findById(territoryId);
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
            await Franchise_1.Franchise.findByIdAndUpdate(oldFranchiseId, {
                $pull: {
                    assignedTerritories: territory._id,
                },
            });
        }
        territory.franchiseId = null;
        territory.franchiseStatus = "VACANT";
        territory.currentFranchisee = undefined;
        await territory.save();
        res.json({
            success: true,
            message: "Territory assignment removed successfully",
            territory,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.removeTerritoryAssignment = removeTerritoryAssignment;
const deleteTerritory = async (req, res) => {
    try {
        const territoryId = req.params.id;
        if (!mongoose_1.default.Types.ObjectId.isValid(territoryId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid territory id",
            });
        }
        const childCount = await Territory_1.Territory.countDocuments({
            parentId: territoryId,
        });
        if (childCount > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete territory. Delete child territories first.",
            });
        }
        const territory = await Territory_1.Territory.findByIdAndDelete(territoryId);
        if (!territory) {
            return res.status(404).json({
                success: false,
                message: "Territory not found",
            });
        }
        if (territory.franchiseId) {
            await Franchise_1.Franchise.findByIdAndUpdate(territory.franchiseId, {
                $pull: {
                    assignedTerritories: territory._id,
                },
            });
        }
        res.json({
            success: true,
            message: "Territory deleted successfully",
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.deleteTerritory = deleteTerritory;
const getTerritoryTree = async (req, res) => {
    try {
        const territories = await Territory_1.Territory.find()
            .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel")
            .lean();
        const states = territories.filter((t) => t.level === "State");
        const tree = states.map((state) => ({
            ...state,
            districts: territories
                .filter((d) => String(d.parentId) === String(state._id))
                .map((district) => ({
                ...district,
                mandals: territories
                    .filter((m) => String(m.parentId) === String(district._id))
                    .map((mandal) => ({
                    ...mandal,
                    pincodes: territories.filter((p) => String(p.parentId) === String(mandal._id)),
                })),
            })),
        }));
        res.json({
            success: true,
            tree,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getTerritoryTree = getTerritoryTree;
const getStates = async (req, res) => {
    try {
        const states = await StateMaster_1.StateMaster.find({ status: "active" }).sort({ name: 1 });
        res.json({ success: true, count: states.length, states });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getStates = getStates;
const getDistricts = async (req, res) => {
    try {
        const { stateId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(stateId)) {
            return res.status(400).json({ success: false, message: "Invalid stateId format" });
        }
        const districts = await DistrictMaster_1.DistrictMaster.find({ stateId, status: "active" }).sort({ name: 1 });
        res.json({ success: true, count: districts.length, districts });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDistricts = getDistricts;
const getMandals = async (req, res) => {
    try {
        const { districtId } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(districtId)) {
            return res.status(400).json({ success: false, message: "Invalid districtId format" });
        }
        const mandals = await MandalMaster_1.MandalMaster.find({ districtId, status: "active" }).sort({ name: 1 });
        res.json({ success: true, count: mandals.length, mandals });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getMandals = getMandals;
