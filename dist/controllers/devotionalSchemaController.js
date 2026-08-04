"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrUpdateCategorySchema = exports.getAllCategorySchemas = exports.getResolvedCategorySchema = void 0;
const schemaResolutionService_1 = require("../services/devotional/schemaResolutionService");
const CategoryProductSchema_1 = __importDefault(require("../models/CategoryProductSchema"));
// GET /api/category-schemas/:categoryId/resolved
const getResolvedCategorySchema = async (req, res) => {
    try {
        const { categoryId } = req.params;
        if (!categoryId) {
            res.status(400).json({ success: false, message: 'Category ID is required' });
            return;
        }
        const resolvedSchema = await (0, schemaResolutionService_1.resolveCategorySchema)(categoryId);
        res.status(200).json({
            success: true,
            data: resolvedSchema,
        });
    }
    catch (error) {
        res.status(404).json({
            success: false,
            message: 'Failed to resolve category product schema',
            error: error.message,
        });
    }
};
exports.getResolvedCategorySchema = getResolvedCategorySchema;
// GET /api/admin/category-schemas
const getAllCategorySchemas = async (req, res) => {
    try {
        const schemas = await CategoryProductSchema_1.default.find().populate('categoryId', 'name slug level');
        res.status(200).json({
            success: true,
            data: schemas,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch category schemas', error: error.message });
    }
};
exports.getAllCategorySchemas = getAllCategorySchemas;
// POST /api/admin/category-schemas
const createOrUpdateCategorySchema = async (req, res) => {
    try {
        const { categoryId, attributes, productMode, inventoryPolicy, deliveryPolicy, isChildOverride } = req.body;
        const schema = await CategoryProductSchema_1.default.findOneAndUpdate({ categoryId }, {
            $set: {
                categoryId,
                attributes,
                productMode,
                inventoryPolicy,
                deliveryPolicy,
                isChildOverride: isChildOverride || false,
                schemaVersion: 1,
                isPublished: true,
            },
        }, { upsert: true, new: true });
        res.status(200).json({
            success: true,
            message: 'Category product schema saved successfully',
            data: schema,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to save category product schema', error: error.message });
    }
};
exports.createOrUpdateCategorySchema = createOrUpdateCategorySchema;
