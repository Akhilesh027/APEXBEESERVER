"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCategoryProductPayload = exports.assertVendorCategoryAccess = void 0;
const Vendor_1 = require("../models/Vendor");
const VendorCategoryAccess_1 = __importDefault(require("../models/VendorCategoryAccess"));
const Category_1 = __importDefault(require("../models/Category"));
const schemaResolutionService_1 = require("../services/devotional/schemaResolutionService");
const assertVendorCategoryAccess = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Not authenticated' });
            return;
        }
        // Admin role bypasses vendor category restriction
        if (req.user.roles.includes('admin')) {
            return next();
        }
        const { categoryId, subCategoryId, childCategoryId } = req.body;
        const targetCatId = childCategoryId || subCategoryId || categoryId;
        if (!targetCatId) {
            res.status(400).json({ success: false, message: 'Category ID is required' });
            return;
        }
        // Find vendor associated with authenticated user
        const vendor = await Vendor_1.Vendor.findOne({ userId: req.user.id });
        if (!vendor) {
            res.status(403).json({ success: false, message: 'Vendor profile not found for user' });
            return;
        }
        if (vendor.status !== 'active') {
            res.status(403).json({ success: false, message: 'Forbidden: Vendor account is inactive' });
            return;
        }
        if (vendor.marketplaceStatus === 'Suspended' || vendor.marketplaceStatus === 'Rejected') {
            res.status(403).json({ success: false, message: `Forbidden: Vendor store is ${vendor.marketplaceStatus.toLowerCase()}` });
            return;
        }
        // Check target category exists
        const categoryDoc = await Category_1.default.findById(targetCatId);
        if (!categoryDoc) {
            res.status(404).json({ success: false, message: `Category not found: ${targetCatId}` });
            return;
        }
        // Find parent category ID (Level 1)
        let parentCatId = categoryDoc.parentId;
        if (categoryDoc.level === 3 && categoryDoc.parentId) {
            const parentSub = await Category_1.default.findById(categoryDoc.parentId);
            if (parentSub)
                parentCatId = parentSub.parentId;
        }
        if (!parentCatId && categoryDoc.level === 1) {
            parentCatId = categoryDoc._id;
        }
        // Query VendorCategoryAccess record
        let access = await VendorCategoryAccess_1.default.findOne({
            vendorId: vendor._id,
            parentCategoryId: parentCatId,
            status: { $in: ['approved', 'partially_approved'] },
        });
        if (!access) {
            // Auto-heal/approve access for active vendors operating in their primary category or matching parent category
            const parentCatDoc = categoryDoc.level === 1 ? categoryDoc : (parentCatId ? await Category_1.default.findById(parentCatId) : null);
            if (parentCatDoc) {
                const parentSlug = (parentCatDoc.slug || '').toLowerCase();
                const parentName = (parentCatDoc.name || '').toLowerCase();
                const vendorPrimary = (vendor.primaryCategory || '').toLowerCase();
                const vendorType = (vendor.storeType || '').toLowerCase();
                const vendorCat = (vendor.category || '').toLowerCase();
                const vendorCategories = (vendor.categories || []).map((c) => c.toLowerCase());
                const isMatchingVertical = !vendor.primaryCategory ||
                    vendorPrimary.includes(parentSlug) || parentSlug.includes(vendorPrimary) ||
                    vendorPrimary.includes(parentName) || parentName.includes(vendorPrimary) ||
                    vendorType.includes(parentSlug) || parentSlug.includes(vendorType) ||
                    vendorCat.includes(parentSlug) || parentSlug.includes(vendorCat) ||
                    vendorCategories.some((c) => c.includes(parentSlug) || parentSlug.includes(c));
                if (isMatchingVertical) {
                    access = await VendorCategoryAccess_1.default.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: parentCatDoc._id }, {
                        $set: {
                            vendorId: vendor._id,
                            storeId: vendor._id,
                            parentCategoryId: parentCatDoc._id,
                            status: 'approved',
                            approvedCapabilities: ['pooja_store', 'general_store', 'retail_store'],
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
            }
        }
        if (!access || (access.status !== 'approved' && access.status !== 'partially_approved')) {
            res.status(403).json({
                success: false,
                message: 'Forbidden: Vendor is not approved for this parent category vertical',
            });
            return;
        }
        // If level 3 child category, check explicit approval if configured
        if (categoryDoc.level === 3) {
            const isApprovedChild = access.approvedChildCategoryIds.some(id => id.toString() === categoryDoc._id.toString());
            const isApprovedSub = categoryDoc.parentId
                ? access.approvedSubcategoryIds.some(id => id.toString() === categoryDoc.parentId?.toString())
                : false;
            if (!isApprovedChild && !isApprovedSub && access.approvedChildCategoryIds.length > 0) {
                res.status(403).json({
                    success: false,
                    message: `Forbidden: Vendor is not authorized for child category '${categoryDoc.name}'`,
                });
                return;
            }
        }
        // Capability intersection check
        const resolvedSchema = await (0, schemaResolutionService_1.resolveCategorySchema)(categoryDoc._id.toString()).catch(() => null);
        if (resolvedSchema &&
            resolvedSchema.allowedVendorCapabilities &&
            resolvedSchema.allowedVendorCapabilities.length > 0 &&
            access.approvedCapabilities &&
            access.approvedCapabilities.length > 0) {
            const hasCapabilityMatch = resolvedSchema.allowedVendorCapabilities.some((cap) => access.approvedCapabilities.includes(cap));
            if (!hasCapabilityMatch) {
                res.status(403).json({
                    success: false,
                    message: `Forbidden: Vendor approved capabilities do not permit category '${categoryDoc.name}'`,
                });
                return;
            }
        }
        // Check action restriction flags
        if (categoryDoc.supportedItemTypes.includes('service') && !access.restrictions.canCreateServices) {
            res.status(403).json({
                success: false,
                message: 'Forbidden: Service creation permission disabled for this vendor',
            });
            return;
        }
        if (!access.restrictions.canCreateProducts && categoryDoc.supportedItemTypes.includes('product')) {
            res.status(403).json({
                success: false,
                message: 'Forbidden: Product creation permission disabled for this vendor',
            });
            return;
        }
        // Store vendor and access context on req for downstream controllers
        req.vendor = vendor;
        req.vendorAccess = access;
        next();
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Internal authorization error', error: error.message });
    }
};
exports.assertVendorCategoryAccess = assertVendorCategoryAccess;
const validateCategoryProductPayload = async (req, res, next) => {
    try {
        const { categoryId, subCategoryId, childCategoryId, attributes } = req.body;
        const targetCatId = childCategoryId || subCategoryId || categoryId;
        if (!targetCatId) {
            return next();
        }
        // Fetch resolved category schema
        const resolvedSchema = await (0, schemaResolutionService_1.resolveCategorySchema)(targetCatId);
        if (!resolvedSchema) {
            return next();
        }
        // Parse attributes if it comes as a JSON string from FormData
        let parsedAttributes = attributes || {};
        if (typeof attributes === 'string') {
            try {
                parsedAttributes = JSON.parse(attributes);
            }
            catch (e) {
                parsedAttributes = {};
            }
        }
        // Validate payload attributes against schema
        const validation = (0, schemaResolutionService_1.validatePayloadAgainstSchema)(parsedAttributes, resolvedSchema);
        if (!validation.isValid) {
            const detailedMsg = validation.errors.join(', ');
            console.warn('[CategoryValidationFailed]', detailedMsg);
            res.status(422).json({
                success: false,
                message: `Category specification attributes validation failed: ${detailedMsg}`,
                errors: validation.errors,
            });
            return;
        }
        req.resolvedCategorySchema = resolvedSchema;
        next();
    }
    catch (error) {
        // Schema resolution errors are non-fatal — log and allow through
        console.warn('[validateCategoryProductPayload] Schema resolution skipped:', error.message);
        next();
    }
};
exports.validateCategoryProductPayload = validateCategoryProductPayload;
