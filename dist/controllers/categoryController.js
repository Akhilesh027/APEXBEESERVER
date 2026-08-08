"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttributePresets = exports.upsertCategoryProductSchema = exports.getCategoryProductSchema = exports.getMergedCategoryAttributes = exports.verifyAcademyController = exports.seedAcademyController = exports.verifyServicesController = exports.seedServicesController = exports.verifyShoppingController = exports.seedShoppingController = exports.verifyDailyNeedsController = exports.seedDailyNeedsController = exports.verifyCatalogueCoreController = exports.seedCatalogueCoreController = exports.seedFullMvpController = exports.applyAttributePreset = exports.ATTRIBUTE_PRESETS = exports.seedVendorController = exports.getCategorySubcategories = exports.deleteCategory = exports.updateCategory = exports.getCategoryById = exports.getCategoryDropdown = exports.getCategoryTree = exports.getCategories = exports.createCategory = void 0;
const streamifier_1 = __importDefault(require("streamifier"));
const mongoose_1 = __importDefault(require("mongoose"));
const Category_1 = __importDefault(require("../models/Category"));
const CategoryProductSchema_1 = __importDefault(require("../models/CategoryProductSchema"));
const Subcategory_1 = __importDefault(require("../models/Subcategory"));
const CategoryExperienceConfig_1 = __importDefault(require("../models/CategoryExperienceConfig"));
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const seedVendorProducts_1 = require("../seeds/seedVendorProducts");
const seedFullMvpCategories_1 = require("../seeds/seedFullMvpCategories");
const seedCoreTaxonomies_1 = require("../seeds/seedCoreTaxonomies");
const seedDailyNeedsTaxonomy_1 = require("../seeds/seedDailyNeedsTaxonomy");
const verifyDailyNeedsTaxonomy_1 = require("../seeds/verifyDailyNeedsTaxonomy");
const seedShoppingTaxonomy_1 = require("../seeds/seedShoppingTaxonomy");
const verifyShoppingTaxonomy_1 = require("../seeds/verifyShoppingTaxonomy");
const seedServicesTaxonomy_1 = require("../seeds/seedServicesTaxonomy");
const verifyServicesTaxonomy_1 = require("../seeds/verifyServicesTaxonomy");
const seedAcademyTaxonomy_1 = require("../seeds/seedAcademyTaxonomy");
const verifyAcademyTaxonomy_1 = require("../seeds/verifyAcademyTaxonomy");
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
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const saveFileLocalOrCloud = async (file, folder, prefix) => {
    try {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME;
        if (cloudName && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            const cloudUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary_1.default.uploader.upload_stream({ folder }, (error, result) => {
                    if (error || !result)
                        return reject(error);
                    resolve(result.secure_url);
                });
                streamifier_1.default.createReadStream(file.buffer).pipe(stream);
            });
            if (cloudUrl)
                return cloudUrl;
        }
    }
    catch (err) {
        console.warn(`[CategoryUpload] Cloudinary upload skipped/failed (${err}). Using local file storage fallback.`);
    }
    const uploadDir = path_1.default.join(__dirname, '../../../public/uploads/categories');
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    const ext = path_1.default.extname(file.originalname) || '.png';
    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const filePath = path_1.default.join(uploadDir, filename);
    fs_1.default.writeFileSync(filePath, file.buffer);
    return `/uploads/categories/${filename}`;
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
            image = await saveFileLocalOrCloud(files.image[0], 'apexbee/categories/images', 'cat-icon');
        }
        if (files?.banner?.[0]) {
            banner = await saveFileLocalOrCloud(files.banner[0], 'apexbee/categories/banners', 'cat-banner');
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
            supportedItemTypes: parseArray(req.body.supportedItemTypes),
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
        res.json({ success: true, categories });
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
        const configs = await CategoryExperienceConfig_1.default.find().lean();
        const configMap = new Map();
        configs.forEach(c => configMap.set(c.categoryId.toString(), c));
        const categoriesWithConfig = categories.map(cat => {
            const config = configMap.get(cat._id.toString());
            return {
                ...cat,
                experienceType: config ? config.experienceType : 'catalogue',
                experienceRoute: config ? config.experienceRoute : undefined,
                comingSoon: config ? config.comingSoon : undefined,
                leadCaptureEnabled: config ? config.leadCaptureEnabled : undefined,
                productCreationEnabled: config ? config.productCreationEnabled : undefined,
                purchaseEnabled: config ? config.purchaseEnabled : undefined,
            };
        });
        res.json({ categories: buildTree(categoriesWithConfig) });
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
            .select('name slug parentId level image attributes brands supportedItemTypes')
            .sort({ sortOrder: 1, name: 1 })
            .lean();
        const schemas = await CategoryProductSchema_1.default.find().select('categoryId attributes').lean();
        const schemaMap = new Map();
        schemas.forEach((s) => {
            if (s.categoryId)
                schemaMap.set(s.categoryId.toString(), s.attributes || []);
        });
        const configs = await CategoryExperienceConfig_1.default.find().lean();
        const configMap = new Map();
        configs.forEach(c => configMap.set(c.categoryId.toString(), c));
        const categoriesWithConfig = categories.map(cat => {
            const config = configMap.get(cat._id.toString());
            const schemaAttrs = schemaMap.get(cat._id.toString());
            const mergedAttrs = (cat.attributes && cat.attributes.length > 0) ? cat.attributes : (schemaAttrs || []);
            return {
                ...cat,
                attributes: mergedAttrs,
                experienceType: config ? config.experienceType : 'catalogue',
                experienceRoute: config ? config.experienceRoute : undefined,
                comingSoon: config ? config.comingSoon : undefined,
                leadCaptureEnabled: config ? config.leadCaptureEnabled : undefined,
                productCreationEnabled: config ? config.productCreationEnabled : undefined,
                purchaseEnabled: config ? config.purchaseEnabled : undefined,
            };
        });
        // Exclude categories where product creation is disabled
        const allowedCategories = categoriesWithConfig.filter(cat => cat.productCreationEnabled !== false);
        res.json({ categories: buildTree(allowedCategories) });
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
            category.image = await saveFileLocalOrCloud(files.image[0], 'apexbee/categories/images', 'cat-icon');
        }
        if (files?.banner?.[0]) {
            category.banner = await saveFileLocalOrCloud(files.banner[0], 'apexbee/categories/banners', 'cat-banner');
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
        res.status(200).json({ message: 'Category deleted successfully' });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to delete category',
            error: error.message,
        });
    }
};
exports.deleteCategory = deleteCategory;
const getCategorySubcategories = async (req, res) => {
    try {
        const { id } = req.params;
        let categoryId = id;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            const cleanName = (s) => s.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim().toLowerCase();
            const cleanTarget = cleanName(id);
            const cats = await Category_1.default.find();
            const match = cats.find(c => c.name.toLowerCase() === id.toLowerCase() ||
                cleanName(c.name) === cleanTarget ||
                (c.slug && id.toLowerCase().includes(c.slug)));
            if (match) {
                categoryId = match._id.toString();
            }
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(categoryId)) {
            return res.json({ success: true, subcategories: [] });
        }
        const subcategories = await Subcategory_1.default.find({ categoryId, isActive: true }).sort({ displayOrder: 1, name: 1 });
        res.json({ success: true, subcategories });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch subcategories', error: error.message });
    }
};
exports.getCategorySubcategories = getCategorySubcategories;
const seedVendorController = async (req, res) => {
    try {
        console.log('[SeedVendorController] Executing seedVendor50Products v8...');
        const result = await (0, seedVendorProducts_1.seedVendor50Products)();
        res.status(200).json({ success: true, result });
    }
    catch (error) {
        console.error('[seedVendorController] Error:', error);
        res.status(200).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedVendorController = seedVendorController;
exports.ATTRIBUTE_PRESETS = {
    grocery: [
        { name: 'Net Weight / Pack Size', type: 'select', unit: 'kg/g', required: true, isVariant: true, options: ['250g', '500g', '1kg', '2kg', '5kg', '10kg', '25kg'] },
        { name: 'Dietary Preference', type: 'select', required: true, isVariant: false, options: ['Veg', 'Non-Veg', 'Eggitarian', 'Vegan'] },
        { name: 'Shelf Life', type: 'text', required: false, isVariant: false, placeholder: 'e.g. 6 Months' },
        { name: 'Organic Certified', type: 'boolean', required: false, isVariant: false },
        { name: 'Packaging Type', type: 'select', required: false, isVariant: false, options: ['Pouch', 'Box', 'Bottle', 'Can', 'Bag'] },
    ],
    restaurant: [
        { name: 'Portion Size', type: 'select', required: true, isVariant: true, options: ['Quarter', 'Half', 'Full', 'Single', 'Family Pack'] },
        { name: 'Spice Level', type: 'select', required: true, isVariant: false, options: ['Mild', 'Medium', 'Spicy', 'Extra Hot'] },
        { name: 'Food Preference', type: 'select', required: true, isVariant: false, options: ['Pure Veg', 'Non-Veg', 'Jain', 'Eggitarian'] },
        { name: 'Preparation Time', type: 'number', unit: 'Mins', required: false, isVariant: false, placeholder: 'e.g. 20' },
        { name: 'Serving Temp', type: 'select', required: false, isVariant: false, options: ['Hot', 'Cold', 'Normal'] },
    ],
    devotional: [
        { name: 'Material', type: 'select', required: true, isVariant: false, options: ['Brass', 'Copper', 'Silver', 'Panchaloha', 'Marble', 'Wood', 'Clay', 'Glass'] },
        { name: 'Height / Size', type: 'select', unit: 'inches', required: true, isVariant: true, options: ['3 inches', '6 inches', '9 inches', '1 foot', '1.5 feet', '2 feet'] },
        { name: 'Deity Name', type: 'select', required: false, isVariant: false, options: ['Lord Ganesha', 'Lord Shiva', 'Goddess Lakshmi', 'Lord Venkateswara', 'Goddess Durga', 'Lord Rama', 'Lord Hanuman', 'General'] },
        { name: 'Sanctified Status', type: 'boolean', required: false, isVariant: false },
        { name: 'Ritual Purpose', type: 'select', required: false, isVariant: false, options: ['Daily Pooja', 'Vinayaka Chavithi', 'Varalakshmi Vratham', 'Dasara', 'Diwali', 'Homam'] },
    ],
    fashion: [
        { name: 'Apparel Size', type: 'select', required: true, isVariant: true, options: ['S', 'M', 'L', 'XL', 'XXL', 'Free Size'] },
        { name: 'Color', type: 'select', required: true, isVariant: true, options: ['Red', 'Blue', 'Black', 'White', 'Green', 'Yellow', 'Gold', 'Pink'] },
        { name: 'Fabric Material', type: 'select', required: false, isVariant: false, options: ['Cotton', 'Silk', 'Georgette', 'Denim', 'Polyester', 'Linen'] },
        { name: 'Gender Target', type: 'select', required: true, isVariant: false, options: ['Men', 'Women', 'Unisex', 'Kids'] },
    ],
    electronics: [
        { name: 'RAM & Storage', type: 'select', required: true, isVariant: true, options: ['4GB RAM / 64GB Storage', '8GB RAM / 128GB Storage', '12GB RAM / 256GB Storage', '16GB RAM / 512GB Storage'] },
        { name: 'Warranty Period', type: 'select', unit: 'Months', required: true, isVariant: false, options: ['6 Months', '1 Year', '2 Years', 'No Warranty'] },
        { name: 'Color Finish', type: 'select', required: false, isVariant: true, options: ['Space Black', 'Silver', 'Ocean Blue', 'Gold'] },
        { name: 'Brand Model', type: 'text', required: true, isVariant: false },
    ],
    service_repair: [
        { name: 'Service Package', type: 'select', required: true, isVariant: true, options: ['Basic Inspection', 'Standard Repair', 'Comprehensive Deep Service'] },
        { name: 'Warranty on Service', type: 'select', unit: 'Days', required: true, isVariant: false, options: ['30 Days Warranty', '60 Days Warranty', '90 Days Warranty'] },
        { name: 'Service Duration', type: 'number', unit: 'Mins', required: false, isVariant: false, placeholder: 'e.g. 60' },
        { name: 'Spare Parts Included', type: 'boolean', required: false, isVariant: false },
    ],
    academy: [
        { name: 'Course Duration Plan', type: 'select', required: true, isVariant: true, options: ['1 Month Access', '3 Months Bootcamp', 'Full Certification Pass'] },
        { name: 'Course Level', type: 'select', required: true, isVariant: false, options: ['Beginner', 'Intermediate', 'Advanced'] },
        { name: 'Mode of Instruction', type: 'select', required: true, isVariant: false, options: ['Live Online Class', 'Recorded Self-Paced', 'In-Person Workshop'] },
        { name: 'Certificate Provided', type: 'boolean', required: true, isVariant: false },
    ],
};
const applyAttributePreset = async (req, res) => {
    try {
        const { id } = req.params;
        const { presetKey } = req.body;
        const presetAttributes = exports.ATTRIBUTE_PRESETS[presetKey];
        if (!presetAttributes) {
            return res.status(400).json({ message: `Preset '${presetKey}' not found` });
        }
        const category = await Category_1.default.findById(id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const existingNames = new Set(category.attributes?.map((a) => a.name.toLowerCase()));
        const newAttributes = presetAttributes.filter((a) => !existingNames.has(a.name.toLowerCase()));
        category.attributes = [...(category.attributes || []), ...newAttributes];
        await category.save();
        res.status(200).json({
            success: true,
            message: `Successfully applied preset '${presetKey}' to ${category.name}`,
            category,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to apply attribute preset', error: error.message });
    }
};
exports.applyAttributePreset = applyAttributePreset;
const seedFullMvpController = async (_req, res) => {
    try {
        console.log('[SeedFullMvpController] Seeding full MVP categories taxonomy...');
        const result = await (0, seedFullMvpCategories_1.seedFullMvpCategories)();
        res.status(200).json({ success: true, message: 'Full MVP Category Taxonomy seeded successfully!', result });
    }
    catch (error) {
        console.error('[seedFullMvpController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedFullMvpController = seedFullMvpController;
const seedCatalogueCoreController = async (req, res) => {
    try {
        const isDryRun = req.query.dryRun === 'true';
        const isVerifyOnly = req.query.verifyOnly === 'true';
        const result = await (0, seedCoreTaxonomies_1.seedCoreTaxonomies)({ dryRun: isDryRun, verifyOnly: isVerifyOnly });
        res.status(200).json({ success: true, message: 'Core Catalogue (Devotional, Restaurant, Daily Needs, Shopping) seeded successfully!', result });
    }
    catch (error) {
        console.error('[seedCatalogueCoreController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedCatalogueCoreController = seedCatalogueCoreController;
const verifyCatalogueCoreController = async (_req, res) => {
    try {
        const result = await (0, seedCoreTaxonomies_1.verifyCoreTaxonomies)();
        res.status(200).json({ success: true, message: 'Catalogue Core verification completed', result });
    }
    catch (error) {
        console.error('[verifyCatalogueCoreController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.verifyCatalogueCoreController = verifyCatalogueCoreController;
const seedDailyNeedsController = async (_req, res) => {
    try {
        const result = await (0, seedDailyNeedsTaxonomy_1.seedDailyNeedsTaxonomy)();
        res.status(200).json({ success: true, message: 'Daily Needs Taxonomy seeded successfully!', result });
    }
    catch (error) {
        console.error('[seedDailyNeedsController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedDailyNeedsController = seedDailyNeedsController;
const verifyDailyNeedsController = async (_req, res) => {
    try {
        const result = await (0, verifyDailyNeedsTaxonomy_1.verifyDailyNeedsTaxonomy)();
        res.status(200).json({ success: true, message: 'Daily Needs taxonomy verification completed', result });
    }
    catch (error) {
        console.error('[verifyDailyNeedsController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.verifyDailyNeedsController = verifyDailyNeedsController;
const seedShoppingController = async (_req, res) => {
    try {
        const result = await (0, seedShoppingTaxonomy_1.seedShoppingTaxonomy)();
        res.status(200).json({ success: true, message: 'Shopping Taxonomy seeded successfully!', result });
    }
    catch (error) {
        console.error('[seedShoppingController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedShoppingController = seedShoppingController;
const verifyShoppingController = async (_req, res) => {
    try {
        const result = await (0, verifyShoppingTaxonomy_1.verifyShoppingTaxonomy)();
        res.status(200).json({ success: true, message: 'Shopping taxonomy verification completed', result });
    }
    catch (error) {
        console.error('[verifyShoppingController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.verifyShoppingController = verifyShoppingController;
const seedServicesController = async (_req, res) => {
    try {
        const result = await (0, seedServicesTaxonomy_1.seedServicesTaxonomy)();
        res.status(200).json({ success: true, message: 'Services Taxonomy seeded successfully!', result });
    }
    catch (error) {
        console.error('[seedServicesController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedServicesController = seedServicesController;
const verifyServicesController = async (_req, res) => {
    try {
        const result = await (0, verifyServicesTaxonomy_1.verifyServicesTaxonomy)();
        res.status(200).json({ success: true, message: 'Services taxonomy verification completed', result });
    }
    catch (error) {
        console.error('[verifyServicesController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.verifyServicesController = verifyServicesController;
const seedAcademyController = async (_req, res) => {
    try {
        await (0, seedAcademyTaxonomy_1.seedAcademyTaxonomy)();
        res.status(200).json({ success: true, message: 'Academy Taxonomy seeded successfully!' });
    }
    catch (error) {
        console.error('[seedAcademyController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.seedAcademyController = seedAcademyController;
const verifyAcademyController = async (_req, res) => {
    try {
        const result = await (0, verifyAcademyTaxonomy_1.verifyAcademyTaxonomy)();
        res.status(200).json({ success: true, message: 'Academy taxonomy verification completed', result });
    }
    catch (error) {
        console.error('[verifyAcademyController] Error:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
};
exports.verifyAcademyController = verifyAcademyController;
const getMergedCategoryAttributes = async (req, res) => {
    try {
        const { id } = req.params;
        const cat = await Category_1.default.findById(id);
        if (!cat) {
            return res.status(404).json({ message: 'Category not found' });
        }
        const categoryChain = [cat];
        let current = cat;
        while (current.parentId) {
            const parent = await Category_1.default.findById(current.parentId);
            if (!parent)
                break;
            categoryChain.unshift(parent); // Top parent first
            current = parent;
        }
        const attributeMap = new Map();
        for (const item of categoryChain) {
            const schema = await CategoryProductSchema_1.default.findOne({ categoryId: item._id }).lean();
            const itemAttrs = (item.attributes && item.attributes.length > 0) ? item.attributes : (schema?.attributes || []);
            if (Array.isArray(itemAttrs)) {
                for (const attr of itemAttrs) {
                    const key = attr.name ? attr.name.toLowerCase().trim() : (attr.key || '');
                    if (key) {
                        attributeMap.set(key, { ...attr, inheritedFrom: item.name, inheritedLevel: item.level });
                    }
                }
            }
        }
        const mergedAttributes = Array.from(attributeMap.values());
        res.json({
            success: true,
            category: cat,
            categoryChain: categoryChain.map(c => ({ id: c._id, name: c.name, level: c.level })),
            mergedAttributes
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch merged attributes', error: error.message });
    }
};
exports.getMergedCategoryAttributes = getMergedCategoryAttributes;
/**
 * GET /api/categories/:id/product-schema
 * Fetch the CategoryProductSchema for a given category (or its parent chain).
 */
const getCategoryProductSchema = async (req, res) => {
    try {
        const { id } = req.params;
        let schema = await CategoryProductSchema_1.default.findOne({ categoryId: id });
        // If no schema for this category, try to find one from the parent chain (inheritance)
        if (!schema) {
            const cat = await Category_1.default.findById(id);
            if (cat && cat.parentId) {
                schema = await CategoryProductSchema_1.default.findOne({ categoryId: cat.parentId });
            }
        }
        if (!schema) {
            return res.json({
                success: true,
                schema: null,
                message: 'No product schema defined for this category. You can create one.'
            });
        }
        res.json({ success: true, schema });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCategoryProductSchema = getCategoryProductSchema;
/**
 * PUT /api/categories/:id/product-schema
 * Create or update the CategoryProductSchema for a category.
 * Body: { attributes, commonFields, productMode, inventoryPolicy, deliveryPolicy, etc. }
 */
const upsertCategoryProductSchema = async (req, res) => {
    try {
        const { id } = req.params;
        const cat = await Category_1.default.findById(id);
        if (!cat) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        const { attributes, commonFields, variantAttributes, productMode, allowedVendorCapabilities, allowedItemTypes, inventoryPolicy, customizationPolicy, workflowPolicy, deliveryPolicy, compliancePolicy, isPublished, } = req.body;
        const updateData = {};
        if (attributes !== undefined)
            updateData.attributes = attributes;
        if (commonFields !== undefined)
            updateData.commonFields = commonFields;
        if (variantAttributes !== undefined)
            updateData.variantAttributes = variantAttributes;
        if (productMode !== undefined)
            updateData.productMode = productMode;
        if (allowedVendorCapabilities !== undefined)
            updateData.allowedVendorCapabilities = allowedVendorCapabilities;
        if (allowedItemTypes !== undefined)
            updateData.allowedItemTypes = allowedItemTypes;
        if (inventoryPolicy !== undefined)
            updateData.inventoryPolicy = inventoryPolicy;
        if (customizationPolicy !== undefined)
            updateData.customizationPolicy = customizationPolicy;
        if (workflowPolicy !== undefined)
            updateData.workflowPolicy = workflowPolicy;
        if (deliveryPolicy !== undefined)
            updateData.deliveryPolicy = deliveryPolicy;
        if (compliancePolicy !== undefined)
            updateData.compliancePolicy = compliancePolicy;
        if (isPublished !== undefined)
            updateData.isPublished = isPublished;
        // Determine if this is a child override
        const isChildOverride = cat.level >= 3;
        updateData.isChildOverride = isChildOverride;
        if (cat.parentId)
            updateData.subcategoryId = cat.parentId;
        const schema = await CategoryProductSchema_1.default.findOneAndUpdate({ categoryId: id }, { $set: updateData, $setOnInsert: { categoryId: id, schemaVersion: 1 } }, { upsert: true, new: true, runValidators: true });
        // Also sync the attributes back to the Category model so they appear in merged-attributes
        if (attributes && Array.isArray(attributes)) {
            cat.attributes = attributes.map((a) => ({
                name: a.name,
                type: a.type || 'text',
                required: a.required || false,
                isVariant: a.isVariant || false,
                options: a.options || [],
                unit: a.unit || '',
                key: a.key || a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            }));
            await cat.save();
        }
        res.json({
            success: true,
            message: `Product schema ${schema.isNew ? 'created' : 'updated'} for "${cat.name}"`,
            schema,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.upsertCategoryProductSchema = upsertCategoryProductSchema;
/**
 * GET /api/categories/attribute-presets
 * Return all available attribute presets for quick-apply.
 */
const getAttributePresets = async (_req, res) => {
    try {
        res.json({
            success: true,
            presets: Object.entries(exports.ATTRIBUTE_PRESETS).map(([key, attrs]) => ({
                key,
                label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
                attributeCount: attrs.length,
                attributes: attrs,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAttributePresets = getAttributePresets;
