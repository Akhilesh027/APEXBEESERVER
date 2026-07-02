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
        const { level, state, district, mandal, pincode, status, density, targetCoverage, franchiseId, } = req.body;
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
        let parent = null;
        let name = state.trim();
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
                message: "Territory already exists",
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
        const { status, density, targetCoverage, franchiseId, } = req.body;
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
        existingTerritory.status = status || existingTerritory.status;
        existingTerritory.density = density || existingTerritory.density;
        existingTerritory.targetCoverage =
            targetCoverage || existingTerritory.targetCoverage;
        existingTerritory.franchiseId = newFranchiseId;
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
            .populate("parentId", "name level state district mandal pincode")
            .populate("franchiseId", "businessName ownerName email mobile franchiseCode franchiseLevel state district mandal");
        res.json({
            success: true,
            message: "Territory updated successfully",
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
