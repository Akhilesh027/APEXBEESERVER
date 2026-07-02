"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.getCategoryDropdown = exports.getCategoryTree = exports.getCategories = exports.createCategory = void 0;
const streamifier_1 = __importDefault(require("streamifier"));
const Category_1 = __importDefault(require("../models/Category"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const makeSlug = (name) => name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const parseArray = (value) => {
    if (!value)
        return [];
    if (Array.isArray(value))
        return value;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return String(value)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
};
const parseAttributes = (value) => {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
};
const uploadToCloudinary = async (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary_1.default.uploader.upload_stream({ folder }, (error, result) => {
            if (error || !result)
                return reject(error);
            resolve(result.secure_url);
        });
        streamifier_1.default.createReadStream(buffer).pipe(stream);
    });
};
const buildTree = (categories) => {
    const map = {};
    const tree = [];
    categories.forEach((cat) => {
        map[cat._id.toString()] = {
            ...cat,
            id: cat._id.toString(),
            children: [],
        };
    });
    categories.forEach((cat) => {
        const parentId = cat.parentId?.toString();
        const id = cat._id.toString();
        if (parentId && map[parentId]) {
            map[parentId].children.push(map[id]);
        }
        else {
            tree.push(map[id]);
        }
    });
    return tree;
};
const createCategory = async (req, res) => {
    try {
        const { name, description, parentId, isActive, sortOrder, } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ message: 'Category name is required' });
        }
        let level = 1;
        if (parentId) {
            const parent = await Category_1.default.findById(parentId);
            if (!parent) {
                return res.status(404).json({ message: 'Parent category not found' });
            }
            if (parent.level >= 3) {
                return res.status(400).json({
                    message: 'Only 3 levels allowed: Category, SubCategory, ChildCategory',
                });
            }
            level = (parent.level + 1);
        }
        const slugBase = makeSlug(name);
        let slug = slugBase;
        let count = 1;
        while (await Category_1.default.exists({ slug })) {
            slug = `${slugBase}-${count}`;
            count++;
        }
        const files = req.files;
        let image = '';
        let banner = '';
        if (files?.image?.[0]) {
            image = await uploadToCloudinary(files.image[0].buffer, 'apexbee/categories/images');
        }
        if (files?.banner?.[0]) {
            banner = await uploadToCloudinary(files.banner[0].buffer, 'apexbee/categories/banners');
        }
        const category = await Category_1.default.create({
            name: name.trim(),
            slug,
            description: description || '',
            parentId: parentId || null,
            level,
            image,
            banner,
            brands: parseArray(req.body.brands),
            attributes: parseAttributes(req.body.attributes),
            isActive: isActive === 'false' ? false : true,
            sortOrder: Number(sortOrder) || 0,
        });
        res.status(201).json({
            message: 'Category created successfully',
            category,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to create category',
            error: error.message,
        });
    }
};
exports.createCategory = createCategory;
const getCategories = async (_req, res) => {
    try {
        const categories = await Category_1.default.find()
            .populate('parentId', 'name slug level')
            .sort({ level: 1, sortOrder: 1, createdAt: -1 });
        res.json({ categories });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch categories',
            error: error.message,
        });
    }
};
exports.getCategories = getCategories;
const getCategoryTree = async (_req, res) => {
    try {
        const categories = await Category_1.default.find({ isActive: true })
            .sort({ sortOrder: 1, name: 1 })
            .lean();
        res.json({ categories: buildTree(categories) });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch category tree',
            error: error.message,
        });
    }
};
exports.getCategoryTree = getCategoryTree;
const getCategoryDropdown = async (_req, res) => {
    try {
        const categories = await Category_1.default.find({ isActive: true })
            .select('name slug parentId level image attributes brands')
            .sort({ sortOrder: 1, name: 1 })
            .lean();
        res.json({ categories: buildTree(categories) });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch dropdown categories',
            error: error.message,
        });
    }
};
exports.getCategoryDropdown = getCategoryDropdown;
const getCategoryById = async (req, res) => {
    try {
        const category = await Category_1.default.findById(req.params.id).populate('parentId', 'name slug level');
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ category });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch category',
            error: error.message,
        });
    }
};
exports.getCategoryById = getCategoryById;
const updateCategory = async (req, res) => {
    try {
        const category = await Category_1.default.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const { name, description, parentId, isActive, sortOrder, } = req.body;
        let level = category.level;
        if (parentId && parentId !== String(category.parentId)) {
            if (parentId === req.params.id) {
                return res.status(400).json({
                    message: 'Category cannot be its own parent',
                });
            }
            const parent = await Category_1.default.findById(parentId);
            if (!parent) {
                return res.status(404).json({ message: 'Parent category not found' });
            }
            if (parent.level >= 3) {
                return res.status(400).json({
                    message: 'Only 3 category levels are allowed',
                });
            }
            level = (parent.level + 1);
        }
        const files = req.files;
        if (files?.image?.[0]) {
            category.image = await uploadToCloudinary(files.image[0].buffer, 'apexbee/categories/images');
        }
        if (files?.banner?.[0]) {
            category.banner = await uploadToCloudinary(files.banner[0].buffer, 'apexbee/categories/banners');
        }
        if (name && name.trim() !== category.name) {
            const slugBase = makeSlug(name);
            let slug = slugBase;
            let count = 1;
            while (await Category_1.default.exists({
                slug,
                _id: { $ne: category._id },
            })) {
                slug = `${slugBase}-${count}`;
                count++;
            }
            category.name = name.trim();
            category.slug = slug;
        }
        category.description = description ?? category.description;
        category.parentId = parentId || null;
        category.level = level;
        category.brands = req.body.brands !== undefined ? parseArray(req.body.brands) : category.brands;
        category.attributes =
            req.body.attributes !== undefined
                ? parseAttributes(req.body.attributes)
                : category.attributes;
        category.isActive =
            isActive === undefined ? category.isActive : isActive === 'true' || isActive === true;
        category.sortOrder =
            sortOrder === undefined ? category.sortOrder : Number(sortOrder) || 0;
        await category.save();
        res.json({
            message: 'Category updated successfully',
            category,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to update category',
            error: error.message,
        });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const hasChildren = await Category_1.default.exists({
            parentId: req.params.id,
        });
        if (hasChildren) {
            return res.status(400).json({
                message: 'Delete subcategories first before deleting this category',
            });
        }
        const category = await Category_1.default.findByIdAndDelete(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json({ message: 'Category deleted successfully' });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to delete category',
            error: error.message,
        });
    }
};
exports.deleteCategory = deleteCategory;
