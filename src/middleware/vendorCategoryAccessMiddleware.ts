import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Vendor } from '../models/Vendor';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import Category from '../models/Category';
import { resolveCategorySchema, validatePayloadAgainstSchema } from '../services/devotional/schemaResolutionService';

export const assertVendorCategoryAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
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
    const vendor = await Vendor.findOne({ userId: req.user.id });
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
    const categoryDoc = await Category.findById(targetCatId);
    if (!categoryDoc) {
      res.status(404).json({ success: false, message: `Category not found: ${targetCatId}` });
      return;
    }

    // Find parent category ID (Level 1)
    let parentCatId = categoryDoc.parentId;
    if (categoryDoc.level === 3 && categoryDoc.parentId) {
      const parentSub = await Category.findById(categoryDoc.parentId);
      if (parentSub) parentCatId = parentSub.parentId;
    }

    if (!parentCatId && categoryDoc.level === 1) {
      parentCatId = categoryDoc._id;
    }

    // Query VendorCategoryAccess record
    const access = await VendorCategoryAccess.findOne({
      vendorId: vendor._id,
      parentCategoryId: parentCatId,
      status: { $in: ['approved', 'partially_approved'] },
    });

    if (!access) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Vendor is not approved for this parent category vertical',
      });
      return;
    }

    // If level 3 child category, check explicit approval if configured
    if (categoryDoc.level === 3) {
      const isApprovedChild = access.approvedChildCategoryIds.some(
        id => id.toString() === categoryDoc._id.toString()
      );
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
    const resolvedSchema = await resolveCategorySchema(categoryDoc._id.toString()).catch(() => null);
    if (
      resolvedSchema &&
      resolvedSchema.allowedVendorCapabilities &&
      resolvedSchema.allowedVendorCapabilities.length > 0 &&
      access.approvedCapabilities &&
      access.approvedCapabilities.length > 0
    ) {
      const hasCapabilityMatch = resolvedSchema.allowedVendorCapabilities.some((cap: string) =>
        access.approvedCapabilities.includes(cap)
      );
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
    (req as any).vendor = vendor;
    (req as any).vendorAccess = access;

    next();
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Internal authorization error', error: error.message });
  }
};

export const validateCategoryProductPayload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryId, subCategoryId, childCategoryId, attributes } = req.body;
    const targetCatId = childCategoryId || subCategoryId || categoryId;

    if (!targetCatId) {
      return next();
    }

    // Fetch resolved category schema
    const resolvedSchema = await resolveCategorySchema(targetCatId);
    if (!resolvedSchema) {
      return next();
    }

    // Parse attributes if it comes as a JSON string from FormData
    let parsedAttributes = attributes || {};
    if (typeof attributes === 'string') {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (e) {
        parsedAttributes = {};
      }
    }

    // Validate payload attributes against schema
    const validation = validatePayloadAgainstSchema(parsedAttributes, resolvedSchema);
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

    (req as any).resolvedCategorySchema = resolvedSchema;
    next();
  } catch (error: any) {
    // If schema resolution fails, pass through or return 422 if invalid category ID
    res.status(422).json({
      success: false,
      message: 'Failed to resolve category product schema for payload validation',
      error: error.message,
    });
  }
};
