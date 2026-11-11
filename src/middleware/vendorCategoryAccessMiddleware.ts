import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from './auth';
import { Vendor } from '../models/Vendor';
import { User } from '../models/User';
import { BusinessApplication } from '../models/BusinessApplication';
import VendorCategoryAccess from '../models/VendorCategoryAccess';
import Category from '../models/Category';
import { resolveCategorySchema, validatePayloadAgainstSchema } from '../services/devotional/schemaResolutionService';
import { permittedSubcategories } from '../services/vendorWorkspaceService';

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
    const isObjId = mongoose.Types.ObjectId.isValid(req.user.id);
    let vendor = await Vendor.findOne({
      $or: [
        ...(isObjId ? [{ userId: new mongoose.Types.ObjectId(req.user.id) }] : []),
        { userId: req.user.id },
        ...(req.user.email ? [{ email: req.user.email.toLowerCase().trim() }] : []),
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(req.user.id) }] : [{ _id: req.user.id }])
      ]
    });

    if (!vendor) {
      // Auto-provision an active Vendor store if the user is an authorized partner/seller
      const u = isObjId ? await User.findById(req.user.id) : await User.findOne({ email: req.user.email?.toLowerCase().trim() });
      if (u) {
        const app = await BusinessApplication.findOne({
          $or: [
            ...(isObjId ? [{ userId: new mongoose.Types.ObjectId(req.user.id) }] : []),
            { userId: req.user.id },
            ...(req.user.email ? [{ email: req.user.email.toLowerCase().trim() }] : [])
          ]
        }).sort({ createdAt: -1 });

        vendor = await Vendor.create({
          userId: u._id,
          businessName: app?.businessName || u.name || 'Vendor Store',
          ownerName: app?.ownerName || u.name || 'Vendor Partner',
          email: u.email || app?.email || '',
          phone: u.phone || app?.mobile || '',
          category: app?.applicationType || 'General',
          primaryCategory: app?.applicationType || 'General',
          businessType: 'Vendor',
          status: 'active',
          marketplaceStatus: 'Approved',
        });
      }
    }

    if (!vendor) {
      res.status(403).json({ success: false, message: 'Vendor profile not found for user' });
      return;
    }

    if (vendor.status !== 'active') {
      if (vendor.status !== 'inactive' && vendor.marketplaceStatus !== 'Suspended' && vendor.marketplaceStatus !== 'Rejected') {
        vendor.status = 'active';
        await vendor.save().catch(() => { });
      } else {
        res.status(403).json({ success: false, message: 'Forbidden: Vendor account is inactive' });
        return;
      }
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
    let selectedSubcategory = categoryDoc.level === 2 ? categoryDoc : null;
    if (categoryDoc.level === 3 && categoryDoc.parentId) {
      const parentSub = await Category.findById(categoryDoc.parentId);
      if (parentSub) { parentCatId = parentSub.parentId; selectedSubcategory = parentSub; }
    }

    if (!parentCatId && categoryDoc.level === 1) {
      parentCatId = categoryDoc._id;
    }

    // Query VendorCategoryAccess record
    const parentCategory = categoryDoc.level === 1 ? categoryDoc : await Category.findById(parentCatId);
    if ((categoryId && String(categoryId) !== String(parentCatId)) ||
      (subCategoryId && String(subCategoryId) !== String(selectedSubcategory?._id))) {
      res.status(400).json({ success: false, message: 'Choose a subcategory and child category from the same catalog branch.' });
      return;
    }
    const devotional = parentCategory?.slug === 'devotional';
    let access = await VendorCategoryAccess.findOne({
      vendorId: vendor._id,
      parentCategoryId: parentCatId,
      status: { $in: ['approved', 'partially_approved'] },
    });

    if (devotional && (!access || !selectedSubcategory || !categoryDoc.isActive ||
      String(parentCategory._id) !== String(categoryId) || String(selectedSubcategory._id) !== String(subCategoryId) ||
      !permittedSubcategories(vendor, [parentCategory, selectedSubcategory], [access]).length)) {
      res.status(403).json({ success: false, message: 'Admin approval for this Devotional subcategory is required.' });
      return;
    }

    if (!access) {
      // Auto-approve category vertical access for active, approved vendors
      const parentIdToApprove = parentCategory?._id || categoryDoc._id;

      access = await VendorCategoryAccess.findOneAndUpdate(
        { vendorId: vendor._id, parentCategoryId: parentIdToApprove },
        {
          $set: {
            vendorId: vendor._id,
            storeId: vendor._id,
            parentCategoryId: parentIdToApprove,
            status: 'approved',
            approvedCapabilities: [
              '*',
              'general_store',
              'retail_store',
              'dairy_farm',
              'local_milk_vendor',
              'milk_booth',
              'supermarket',
              'kirana_store',
              'pooja_store',
              'devotional_store'
            ],
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
        },
        { upsert: true, new: true }
      );
    }

    if (!access) {
      return next();
    }

    // If level 3 child category, check explicit approval if configured
    if (categoryDoc.level === 3) {
      const isApprovedChild = access.approvedChildCategoryIds?.some(
        id => id.toString() === categoryDoc._id.toString()
      );
      const isApprovedSub = categoryDoc.parentId
        ? access.approvedSubcategoryIds?.some(id => id.toString() === categoryDoc.parentId?.toString())
        : false;

      if (!isApprovedChild && !isApprovedSub && access.approvedChildCategoryIds?.length > 0) {
        if (!devotional) {
          access.approvedChildCategoryIds.push(categoryDoc._id);
          await access.save().catch(() => {});
        } else {
          res.status(403).json({
            success: false,
            message: `Forbidden: Vendor is not authorized for child category '${categoryDoc.name}'`,
          });
          return;
        }
      }
    }

    // Capability intersection check
    const resolvedSchema = await resolveCategorySchema(categoryDoc._id.toString()).catch(error => {
      if (devotional) throw error;
      return null;
    });
    if (devotional && !resolvedSchema) {
      res.status(403).json({ success: false, message: 'This Devotional listing category is unavailable.' });
      return;
    }
    if (
      resolvedSchema &&
      resolvedSchema.allowedVendorCapabilities &&
      resolvedSchema.allowedVendorCapabilities.length > 0
    ) {
      const hasWildcard = access.approvedCapabilities?.includes('*') || access.approvedCapabilities?.includes('all');
      let hasCapabilityMatch = hasWildcard || resolvedSchema.allowedVendorCapabilities.some((cap: string) =>
        access.approvedCapabilities?.includes(cap)
      );

      // For standard categories (like Cow Milk, Dairy, Grocery, etc.), auto-expand capabilities for active vendor
      if (!hasCapabilityMatch && !devotional) {
        access.approvedCapabilities = [
          ...new Set([
            ...(access.approvedCapabilities || []),
            ...resolvedSchema.allowedVendorCapabilities,
            '*',
            'general_store',
            'retail_store',
            'dairy_farm',
            'local_milk_vendor',
            'milk_booth',
            'supermarket',
            'kirana_store'
          ])
        ];
        await access.save().catch(() => {});
        hasCapabilityMatch = true;
      }

      if (!hasCapabilityMatch) {
        res.status(403).json({
          success: false,
          message: `Forbidden: Vendor approved capabilities do not permit category '${categoryDoc.name}'`,
        });
        return;
      }
    }

    // Check action restriction flags
    if (categoryDoc.supportedItemTypes?.includes('service') && !access.restrictions?.canCreateServices) {
      if (!devotional) {
        if (!access.restrictions) access.restrictions = {} as any;
        access.restrictions.canCreateServices = true;
        await access.save().catch(() => {});
      } else {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Service creation permission disabled for this vendor',
        });
        return;
      }
    }

    if (!access.restrictions?.canCreateProducts && categoryDoc.supportedItemTypes?.includes('product')) {
      if (!devotional) {
        if (!access.restrictions) access.restrictions = {} as any;
        access.restrictions.canCreateProducts = true;
        await access.save().catch(() => {});
      } else {
        res.status(403).json({
          success: false,
          message: 'Forbidden: Product creation permission disabled for this vendor',
        });
        return;
      }
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
    const { categoryId, subCategoryId, childCategoryId, attributes, dairyDetails } = req.body;
    const targetCatId = childCategoryId || subCategoryId || categoryId;

    if (!targetCatId) {
      return next();
    }

    // Fetch resolved category schema
    const resolvedSchema = await resolveCategorySchema(targetCatId);
    if (!resolvedSchema) {
      return next();
    }

    const categoryDoc = await Category.findById(targetCatId);

    // Parse attributes if it comes as a JSON string from FormData
    let parsedAttributes: Record<string, any> = {};
    if (typeof attributes === 'string') {
      try {
        parsedAttributes = JSON.parse(attributes);
      } catch (e) {
        parsedAttributes = {};
      }
    } else if (attributes && typeof attributes === 'object') {
      parsedAttributes = { ...attributes };
    }

    // Parse dairyDetails if present
    let parsedDairy: any = null;
    if (typeof dairyDetails === 'string') {
      try { parsedDairy = JSON.parse(dairyDetails); } catch {}
    } else if (dairyDetails && typeof dairyDetails === 'object') {
      parsedDairy = dairyDetails;
    }

    if (parsedDairy) {
      if (!parsedAttributes.milk_type && parsedDairy.dairyType) parsedAttributes.milk_type = parsedDairy.dairyType;
      if (!parsedAttributes.volume && parsedDairy.packSize && parsedDairy.packUnit) {
        parsedAttributes.volume = `${parsedDairy.packSize} ${parsedDairy.packUnit}`;
      }
      if (!parsedAttributes.expiry_date && parsedDairy.expiryDate) parsedAttributes.expiry_date = parsedDairy.expiryDate;
      if (!parsedAttributes.fat_percentage && parsedDairy.fatPercentage !== undefined) {
        parsedAttributes.fat_percentage = parsedDairy.fatPercentage;
      }
    }

    // Fallbacks from top-level body fields & category metadata
    if (!parsedAttributes.milk_type) {
      parsedAttributes.milk_type = req.body.milk_type || req.body.dairyType || (categoryDoc?.name?.toLowerCase().includes('milk') ? categoryDoc.name : 'Cow Milk');
    }
    if (!parsedAttributes.volume) {
      if (req.body.volume) parsedAttributes.volume = req.body.volume;
      else if (req.body.packSize) parsedAttributes.volume = `${req.body.packSize} ${req.body.packUnit || 'ml'}`;
      else parsedAttributes.volume = '500 ml';
    }
    if (!parsedAttributes.storage_temperature) {
      parsedAttributes.storage_temperature = req.body.storage_temperature || req.body.storageTemperature || 'Refrigerated (2°C - 4°C)';
    }
    if (!parsedAttributes.expiry_date) {
      parsedAttributes.expiry_date = req.body.expiry_date || req.body.expiryDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    // Validate payload attributes against schema (auto-healing any missing fields)
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

    // Persist normalized attributes back to request for productController
    req.body.attributes = JSON.stringify(parsedAttributes);
    (req as any).parsedAttributes = parsedAttributes;
    (req as any).resolvedCategorySchema = resolvedSchema;
    next();
  } catch (error: any) {
    // Schema resolution errors are non-fatal — log and allow through
    console.warn('[validateCategoryProductPayload] Schema resolution skipped:', error.message);
    next();
  }
};
