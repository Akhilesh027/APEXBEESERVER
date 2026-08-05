"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.suspendVendorCapability = exports.updateVendorCategoryAccess = exports.reviewVendorCategoryAccess = exports.requestVendorCapabilities = exports.getVendorAllowedCategories = exports.findParentCategoryByTerm = exports.getMyCategoryAccess = void 0;
const VendorCategoryAccess_1 = __importDefault(require("../models/VendorCategoryAccess"));
const Vendor_1 = require("../models/Vendor");
const Category_1 = __importDefault(require("../models/Category"));
// GET /api/vendor/category-access/me
const getMyCategoryAccess = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor profile not found' });
            return;
        }
        const access = await VendorCategoryAccess_1.default.find({ vendorId: vendor._id }).populate('parentCategoryId', 'name slug level');
        res.status(200).json({
            success: true,
            data: access,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch vendor category access', error: error.message });
    }
};
exports.getMyCategoryAccess = getMyCategoryAccess;
const findParentCategoryByTerm = async (term) => {
    if (!term)
        return null;
    const cleanTerm = term.toLowerCase().trim();
    let cat = await Category_1.default.findOne({
        level: 1,
        $or: [
            { slug: cleanTerm },
            { slug: { $regex: new RegExp(cleanTerm.replace(/[^a-z0-9]/g, '.*'), 'i') } },
            { name: { $regex: new RegExp(cleanTerm.replace(/[^a-z0-9]/g, '.*'), 'i') } },
        ],
    });
    if (!cat) {
        if (cleanTerm.includes('shop') || cleanTerm.includes('retail')) {
            cat = await Category_1.default.findOne({ level: 1, $or: [{ slug: 'shopping' }, { name: /shopping/i }] });
        }
        else if (cleanTerm.includes('food') || cleanTerm.includes('restaur')) {
            cat = await Category_1.default.findOne({ level: 1, $or: [{ slug: 'restaurant' }, { name: /restaurant/i }] });
        }
        else if (cleanTerm.includes('daily') || cleanTerm.includes('grocer')) {
            cat = await Category_1.default.findOne({ level: 1, $or: [{ slug: 'daily-needs' }, { name: /daily/i }] });
        }
        else if (cleanTerm.includes('devot') || cleanTerm.includes('pooja') || cleanTerm.includes('puja')) {
            cat = await Category_1.default.findOne({ level: 1, $or: [{ slug: 'devotional' }, { name: /devotional/i }] });
        }
        else if (cleanTerm.includes('servic')) {
            cat = await Category_1.default.findOne({ level: 1, $or: [{ slug: 'services' }, { name: /services/i }] });
        }
    }
    return cat;
};
exports.findParentCategoryByTerm = findParentCategoryByTerm;
// GET /api/vendor/allowed-categories
const getVendorAllowedCategories = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor profile not found' });
            return;
        }
        const primaryCatTerm = vendor.primaryCategory || vendor.category || vendor.storeType || '';
        const primaryParent = await (0, exports.findParentCategoryByTerm)(primaryCatTerm);
        if (primaryParent && (vendor.status === 'active' || !vendor.status)) {
            // Ensure active VendorCategoryAccess record exists for vendor's assigned primary category
            await VendorCategoryAccess_1.default.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: primaryParent._id }, {
                $set: {
                    vendorId: vendor._id,
                    storeId: vendor._id,
                    parentCategoryId: primaryParent._id,
                    status: 'approved',
                    approvedCapabilities: ['general_store', 'retail_store', 'shopping_store', 'pooja_store'],
                    approvedItemTypes: ['product', 'service'],
                    restrictions: {
                        canCreateProducts: true,
                        canCreateServices: true,
                        canJoinFestivalCombos: true,
                        canAcceptBulkOrders: true,
                        canSellWholesale: true,
                        canOfferSubscriptions: true,
                    },
                    approvedAt: new Date(),
                },
            }, { upsert: true, new: true });
        }
        let accessRecords = await VendorCategoryAccess_1.default.find({
            vendorId: vendor._id,
            status: { $in: ['approved', 'partially_approved'] },
        });
        if (primaryParent) {
            const primaryAccess = accessRecords.filter(a => a.parentCategoryId.toString() === primaryParent._id.toString());
            if (primaryAccess.length > 0) {
                accessRecords = primaryAccess;
            }
        }
        if (accessRecords.length === 0) {
            let parent = primaryParent || await Category_1.default.findOne({ level: 1 });
            if (parent && (vendor.status === 'active' || !vendor.status)) {
                const autoAccess = await VendorCategoryAccess_1.default.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: parent._id }, {
                    $set: {
                        vendorId: vendor._id,
                        storeId: vendor._id,
                        parentCategoryId: parent._id,
                        status: 'approved',
                        approvedCapabilities: ['general_store', 'retail_store', 'shopping_store', 'pooja_store'],
                        approvedItemTypes: ['product', 'service'],
                        restrictions: {
                            canCreateProducts: true,
                            canCreateServices: true,
                            canJoinFestivalCombos: true,
                            canAcceptBulkOrders: true,
                            canSellWholesale: true,
                            canOfferSubscriptions: true,
                        },
                        approvedAt: new Date(),
                    },
                }, { upsert: true, new: true });
                accessRecords = [autoAccess];
            }
        }
        const parentIds = accessRecords.map(a => a.parentCategoryId);
        const approvedSubIds = accessRecords.flatMap(a => a.approvedSubcategoryIds);
        const approvedChildIds = accessRecords.flatMap(a => a.approvedChildCategoryIds);
        const parents = await Category_1.default.find({ _id: { $in: parentIds }, level: 1 });
        const subQuery = approvedSubIds.length > 0 ? { _id: { $in: approvedSubIds }, level: 2 } : { parentId: { $in: parentIds }, level: 2 };
        const subcategories = await Category_1.default.find(subQuery);
        const subIds = subcategories.map(s => s._id);
        const childQuery = approvedChildIds.length > 0 ? { _id: { $in: approvedChildIds }, level: 3 } : { parentId: { $in: subIds }, level: 3 };
        const childCategories = await Category_1.default.find(childQuery);
        res.status(200).json({
            success: true,
            data: {
                parentCategory: parents[0] || primaryParent,
                parentCategories: parents,
                subcategories: subcategories.map(sub => ({
                    ...sub.toObject(),
                    childCategories: childCategories.filter(c => c.parentId?.toString() === sub._id.toString()),
                })),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch allowed categories', error: error.message });
    }
};
exports.getVendorAllowedCategories = getVendorAllowedCategories;
// POST /api/vendor/category-access/request
const requestVendorCapabilities = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor profile not found' });
            return;
        }
        const { requestedCapabilities, parentCategoryId } = req.body;
        if (!requestedCapabilities || !Array.isArray(requestedCapabilities)) {
            res.status(400).json({ success: false, message: 'requestedCapabilities array is required' });
            return;
        }
        let parentId = parentCategoryId;
        if (!parentId) {
            const devCat = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            parentId = devCat?._id;
        }
        if (!parentId) {
            res.status(400).json({ success: false, message: 'Devotional parent category not found' });
            return;
        }
        let access = await VendorCategoryAccess_1.default.findOne({
            vendorId: vendor._id,
            parentCategoryId: parentId,
        });
        const validCapabilities = [
            'pooja_store', 'flower_shop', 'coconut_shop', 'fruit_shop',
            'sweet_shop', 'prasadam_partner', 'idol_statue_shop', 'photo_frame_shop',
            'digital_printing_shop', 'brass_copper_shop', 'spiritual_book_shop',
            'pooja_items_manufacturer', 'decoration_shop', 'temple_service_partner',
            'priest_pandit', 'devotional_wholesaler'
        ];
        const sanitizedRequested = requestedCapabilities.filter((c) => validCapabilities.includes(c));
        if (!access) {
            access = await VendorCategoryAccess_1.default.create({
                vendorId: vendor._id,
                storeId: vendor._id,
                parentCategoryId: parentId,
                requestedCapabilities: sanitizedRequested,
                approvedCapabilities: [],
                approvedSubcategoryIds: [],
                approvedChildCategoryIds: [],
                status: 'pending',
                restrictions: {
                    canCreateProducts: false,
                    canCreateServices: false,
                    canJoinFestivalCombos: false,
                    canAcceptBulkOrders: false,
                    canSellWholesale: false,
                    canOfferSubscriptions: false,
                },
            });
        }
        else {
            // Merge newly requested capabilities without duplicating or erasing existing approved capabilities
            const mergedRequested = Array.from(new Set([...access.requestedCapabilities, ...sanitizedRequested]));
            access.requestedCapabilities = mergedRequested;
            if (access.status === 'draft' || access.status === 'rejected') {
                access.status = 'pending';
            }
            await access.save();
        }
        res.status(200).json({
            success: true,
            message: 'Devotional capabilities requested successfully. Awaiting admin review.',
            data: access,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to request capabilities', error: error.message });
    }
};
exports.requestVendorCapabilities = requestVendorCapabilities;
// POST /api/admin/vendors/:vendorId/category-access/review
const reviewVendorCategoryAccess = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { parentCategoryId, approvedCapabilities, approvedSubcategoryIds, approvedChildCategoryIds, approvedItemTypes, restrictions, status, rejectionReason, } = req.body;
        const vendor = await Vendor_1.Vendor.findById(vendorId);
        if (!vendor) {
            res.status(404).json({ success: false, message: 'Vendor not found' });
            return;
        }
        let parentId = parentCategoryId;
        if (!parentId) {
            const devCat = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
            parentId = devCat?._id;
        }
        const access = await VendorCategoryAccess_1.default.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: parentId }, {
            $set: {
                vendorId: vendor._id,
                storeId: vendor._id,
                parentCategoryId: parentId,
                approvedCapabilities: approvedCapabilities || [],
                approvedSubcategoryIds: approvedSubcategoryIds || [],
                approvedChildCategoryIds: approvedChildCategoryIds || [],
                approvedItemTypes: approvedItemTypes || ['product'],
                restrictions: restrictions || {
                    canCreateProducts: true,
                    canCreateServices: false,
                    canJoinFestivalCombos: true,
                    canAcceptBulkOrders: false,
                    canSellWholesale: false,
                    canOfferSubscriptions: false,
                },
                status: status || 'approved',
                approvedAt: status === 'approved' ? new Date() : undefined,
                approvedBy: req.user?.id,
                rejectionReason: rejectionReason || '',
            },
        }, { upsert: true, new: true });
        // Sync primary category on Vendor and User models if approved
        if (parentId && (status === 'approved' || status === 'partially_approved')) {
            const parentCat = await Category_1.default.findById(parentId);
            if (parentCat) {
                vendor.primaryCategory = parentCat.name;
                vendor.storeType = parentCat.slug;
                await vendor.save();
            }
        }
        res.status(200).json({
            success: true,
            message: `Vendor category access updated to '${status}' successfully`,
            data: access,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to review vendor category access', error: error.message });
    }
};
exports.reviewVendorCategoryAccess = reviewVendorCategoryAccess;
// PATCH /api/admin/vendor-category-access/:accessId
const updateVendorCategoryAccess = async (req, res) => {
    try {
        const { accessId } = req.params;
        const updates = req.body;
        const access = await VendorCategoryAccess_1.default.findByIdAndUpdate(accessId, { $set: updates }, { new: true });
        if (!access) {
            res.status(404).json({ success: false, message: 'Category access record not found' });
            return;
        }
        res.status(200).json({ success: true, data: access });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update category access', error: error.message });
    }
};
exports.updateVendorCategoryAccess = updateVendorCategoryAccess;
// POST /api/admin/vendor-category-access/:accessId/suspend-capability
const suspendVendorCapability = async (req, res) => {
    try {
        const { accessId } = req.params;
        const { capability, reason } = req.body;
        const access = await VendorCategoryAccess_1.default.findById(accessId);
        if (!access) {
            res.status(404).json({ success: false, message: 'Category access record not found' });
            return;
        }
        access.approvedCapabilities = access.approvedCapabilities.filter(c => c !== capability);
        access.suspensionReason = reason || `Capability '${capability}' suspended by admin.`;
        if (access.approvedCapabilities.length === 0) {
            access.status = 'suspended';
        }
        else {
            access.status = 'partially_approved';
        }
        await access.save();
        res.status(200).json({
            success: true,
            message: `Capability '${capability}' suspended successfully`,
            data: access,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to suspend vendor capability', error: error.message });
    }
};
exports.suspendVendorCapability = suspendVendorCapability;
