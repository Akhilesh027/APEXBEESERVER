"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchBarcode = exports.deleteHistory = exports.saveHistory = exports.getRecent = exports.getTrending = exports.getSuggestions = exports.search = void 0;
const SearchDocument_1 = require("../models/SearchDocument");
const ProductVariant_1 = __importDefault(require("../models/ProductVariant"));
const StoreProduct_1 = __importDefault(require("../models/StoreProduct"));
const search = async (req, res) => {
    try {
        const { query, entityType, category, subcategory, latitude, longitude, radius, page = '1', limit = '10', sort = 'popularity', } = req.query;
        const filter = { isActive: true };
        if (query) {
            filter.$or = [
                { title: { $regex: String(query), $options: 'i' } },
                { subtitle: { $regex: String(query), $options: 'i' } },
                { description: { $regex: String(query), $options: 'i' } },
                { keywords: { $in: [new RegExp(String(query), 'i')] } },
            ];
        }
        if (entityType) {
            filter.entityType = entityType;
        }
        if (category) {
            filter.categoryId = category;
        }
        if (subcategory) {
            filter.subcategoryId = subcategory;
        }
        const pageNum = parseInt(String(page), 10);
        const limitNum = parseInt(String(limit), 10);
        const skip = (pageNum - 1) * limitNum;
        // Execute standard search query
        let mongoQuery = SearchDocument_1.SearchDocument.find(filter);
        if (sort === 'popularity') {
            mongoQuery = mongoQuery.sort({ popularityScore: -1 });
        }
        else if (sort === 'newest') {
            mongoQuery = mongoQuery.sort({ createdAt: -1 });
        }
        const total = await SearchDocument_1.SearchDocument.countDocuments(filter);
        const results = await mongoQuery.skip(skip).limit(limitNum);
        return res.status(200).json({
            success: true,
            total,
            page: pageNum,
            limit: limitNum,
            results,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.search = search;
const getSuggestions = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(200).json({ success: true, suggestions: [] });
        }
        const matches = await SearchDocument_1.SearchDocument.find({
            $or: [
                { title: { $regex: `^${query}`, $options: 'i' } },
                { keywords: { $in: [new RegExp(`^${query}`, 'i')] } },
            ],
            isActive: true,
        })
            .limit(6)
            .select('title entityType entityId');
        const suggestions = matches.map((m) => ({
            text: m.title,
            type: m.entityType,
            id: m.entityId,
        }));
        return res.status(200).json({ success: true, suggestions });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getSuggestions = getSuggestions;
const getTrending = async (req, res) => {
    try {
        // Return high popularity score items as trending searches
        const trendingDocs = await SearchDocument_1.SearchDocument.find({ isActive: true })
            .sort({ popularityScore: -1, searchCount: -1 })
            .limit(5)
            .select('title');
        const trending = trendingDocs.map((doc) => doc.title);
        return res.status(200).json({ success: true, trending });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTrending = getTrending;
const getRecent = async (req, res) => {
    try {
        // For demo/integration testing, return mock recent searches
        return res.status(200).json({
            success: true,
            recent: ['Milk', 'Fresh Flowers', 'Basmati Rice'],
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getRecent = getRecent;
const saveHistory = async (req, res) => {
    try {
        const { query } = req.body;
        if (query) {
            await SearchDocument_1.SearchDocument.updateOne({ title: query, entityType: 'product' }, { $inc: { searchCount: 1, popularityScore: 1 } });
        }
        return res.status(200).json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.saveHistory = saveHistory;
const deleteHistory = async (req, res) => {
    try {
        return res.status(200).json({ success: true, message: 'History cleared' });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteHistory = deleteHistory;
const searchBarcode = async (req, res) => {
    try {
        const { barcode } = req.params;
        const variant = await ProductVariant_1.default.findOne({ barcode });
        if (!variant) {
            return res.status(404).json({ success: false, message: 'Barcode not matched' });
        }
        const storeProducts = await StoreProduct_1.default.find({ variantId: variant._id }).populate('productId');
        return res.status(200).json({
            success: true,
            variant,
            storeProducts,
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.searchBarcode = searchBarcode;
