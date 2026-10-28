import { Request, Response } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Product from '../models/Product';
import { FoodMenuItem } from '../models/FoodMenuItem';
import { FoodMenuCategory } from '../models/FoodMenuCategory';
import { RestaurantProfile } from '../models/RestaurantProfile';
import Category from '../models/Category';
import CategoryExperienceConfig from '../models/CategoryExperienceConfig';
import { Vendor } from '../models/Vendor';
import Order from '../models/Order';
import { uploadToCloudinary } from '../config/cloudinary';

const validateProductFields = (body: any, res: Response): boolean => {
  const protectedFields = [
    'status', 'adminPricing', 'commissionShares', 'pricingStatus',
    'approvedBy', 'approvedAt', 'sellerNegotiations', 'finalSellerAmount',
    'platformFeePercent', 'adminPricingApproved', 'sellerPricingAccepted',
    'isActive', 'approvedByAdminAt', 'sellerAcceptedAt', 'liveAt'
  ];
  for (const field of protectedFields) {
    if (body[field] !== undefined) {
      res.status(400).json({ success: false, message: `Field ${field} is protected and cannot be set by vendors.` });
      return false;
    }
  }
  return true;
};

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const parseJson = (value: any, fallback: any) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeNumber = (value: any, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const makeUniqueSlug = async (name: string, excludeId?: any) => {
  const slugBase = makeSlug(name);
  let slug = slugBase;
  let count = 1;

  while (
    await Product.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    slug = `${slugBase}-${count}`;
    count++;
  }

  return slug;
};

const normalizeVariants = (variants: any[]) => {
  if (!Array.isArray(variants)) return [];

  return variants.map((variant) => {
    const mrp = normalizeNumber(variant.mrp);
    const discountPercent = normalizeNumber(variant.discountPercent);
    const calculatedSelling =
      mrp > 0 ? Math.round(mrp - (mrp * discountPercent) / 100) : 0;

    return {
      sku: String(variant.sku || '').toUpperCase().trim(),
      attributes: variant.attributes || {},
      mrp,
      discountPercent,
      sellingPrice:
        variant.sellingPrice !== undefined
          ? normalizeNumber(variant.sellingPrice)
          : calculatedSelling,
      stock: normalizeNumber(variant.stock),
      images: Array.isArray(variant.images) ? variant.images : [],
      isActive: variant.isActive !== false,
    };
  });
};

const getUploadedFiles = async (req: Request) => {
  const files = req.files as {
    thumbnail?: Express.Multer.File[];
    images?: Express.Multer.File[];
  };

  let thumbnail = '';
  let images: string[] = [];

  if (files?.thumbnail?.[0]?.buffer) {
    const uploadedUrl = await uploadToCloudinary(
      files.thumbnail[0].buffer,
      'apexbee/products/thumbnails'
    );

    if (uploadedUrl) thumbnail = uploadedUrl;
  }

  if (files?.images?.length) {
    const uploadedImages = await Promise.all(
      files.images
        .filter((file) => file.buffer)
        .map((file) =>
          uploadToCloudinary(file.buffer, 'apexbee/products/gallery')
        )
    );

    images = uploadedImages.filter(Boolean) as string[];
  }

  return { thumbnail, images };
};

const populateProduct = (query: any) => {
  return query
    .populate('sellerId', 'name email mobile phone roles shopName storeName businessName storeLogo profilePicture logo sellerProfile rating reviewsCount latitude longitude location address city state zipcode pincode pinCode mandal district')
    .populate('categoryId', 'name slug level brands attributes')
    .populate('subCategoryId', 'name slug level brands attributes')
    .populate('childCategoryId', 'name slug level brands attributes');
};

const populateProductList = (query: any) => {
  return query
    .populate('sellerId', 'name email mobile roles shopName storeName businessName storeLogo profilePicture logo pincode pinCode mandal district location')
    .populate('categoryId', 'name slug level image')
    .populate('subCategoryId', 'name slug level')
    .populate('childCategoryId', 'name slug level');
};

const roundMoney = (val: number) => Math.round((val + Number.EPSILON) * 100) / 100;

const buildAdminPricing = (body: any) => {
  const mrp = normalizeNumber(body.mrp);
  const sellingPrice = normalizeNumber(body.sellingPrice);
  const platformFeePercent = normalizeNumber(body.platformFeePercent);
  const vendorCommissionPercent = normalizeNumber(body.vendorCommissionPercent);

  const vendorCommissionAmount = roundMoney(
    body.vendorCommissionAmount !== undefined
      ? normalizeNumber(body.vendorCommissionAmount)
      : (sellingPrice * vendorCommissionPercent) / 100
  );

  const platformFeeAmount = roundMoney(
    body.platformFeeAmount !== undefined
      ? normalizeNumber(body.platformFeeAmount)
      : (sellingPrice * platformFeePercent) / 100
  );

  const distributedFrom = body.distributedFrom || 'platform_fee';

  const distributionPool = roundMoney(
    body.distributionPool !== undefined
      ? normalizeNumber(body.distributionPool)
      : distributedFrom === 'apexbee_commission'
        ? vendorCommissionAmount
        : distributedFrom === 'both'
          ? (vendorCommissionAmount + platformFeeAmount)
          : distributedFrom === 'none'
            ? 0
            : platformFeeAmount
  );

  const shippingCharge = normalizeNumber(body.shippingCharge);
  const packingCharge = normalizeNumber(body.packingCharge);

  const commissionShares = parseJson(body.commissionShares, []).map(
    (item: any) => {
      const percent = normalizeNumber(item.percent);
      const amount = roundMoney(
        item.amount !== undefined && distributedFrom !== 'none'
          ? normalizeNumber(item.amount)
          : (distributionPool * percent) / 100
      );

      return {
        type: item.type,
        label: item.label,
        percent,
        amount,
        isActive: distributedFrom !== 'none' && item.isActive !== false,
      };
    }
  );

  const totalCommissionAmount = roundMoney(
    commissionShares.reduce(
      (sum: number, item: any) => sum + (item.isActive ? normalizeNumber(item.amount) : 0),
      0
    )
  );

  const finalSellerAmount = roundMoney(
    body.finalSellerAmount !== undefined
      ? normalizeNumber(body.finalSellerAmount)
      : sellingPrice - vendorCommissionAmount
  );

  const customerSellingAmount = roundMoney(
    body.customerSellingAmount !== undefined
      ? normalizeNumber(body.customerSellingAmount)
      : sellingPrice + shippingCharge + packingCharge
  );

  const getShareAmt = (type: string) => {
    const sh = commissionShares.find((s: any) => s.type === type && s.isActive !== false);
    return sh ? normalizeNumber(sh.amount) : 0;
  };
  const getSharePct = (type: string) => {
    const sh = commissionShares.find((s: any) => s.type === type && s.isActive !== false);
    return sh ? normalizeNumber(sh.percent) : 0;
  };

  const level1Amt = getShareAmt('level1') || roundMoney((distributionPool * (getSharePct('level1') || 10)) / 100);
  const level2Amt = getShareAmt('level2') || roundMoney((distributionPool * (getSharePct('level2') || 5)) / 100);
  const level3Amt = getShareAmt('level3') || roundMoney((distributionPool * (getSharePct('level3') || 2.5)) / 100);

  const computedAverage = roundMoney((level1Amt + level2Amt + level3Amt) / 3);
  const totalReferralEarning = roundMoney(level1Amt + level2Amt + level3Amt);

  const estimatedEarning = body.estimatedEarning !== undefined && body.estimatedEarning !== null && body.estimatedEarning !== '' && !isNaN(Number(body.estimatedEarning))
    ? normalizeNumber(body.estimatedEarning)
    : (body.averageReferralEarning !== undefined && body.averageReferralEarning !== null && body.averageReferralEarning !== '' && !isNaN(Number(body.averageReferralEarning))
      ? normalizeNumber(body.averageReferralEarning)
      : computedAverage);

  const averageReferralEarning = estimatedEarning;

  const platformNetProfit = roundMoney(
    body.platformNetProfit !== undefined
      ? normalizeNumber(body.platformNetProfit)
      : (platformFeeAmount + vendorCommissionAmount) - totalCommissionAmount
  );

  return {
    mrp,
    sellingPrice,
    platformFeePercent,
    platformFeeAmount,
    vendorCommissionPercent,
    vendorCommissionAmount,
    distributedFrom,
    distributionPool,
    shippingCharge,
    packingCharge,
    commissionShares,
    totalCommissionAmount,
    finalSellerAmount,
    customerSellingAmount,
    platformNetProfit,
    referralEarnings: {
      level1: level1Amt,
      level2: level2Amt,
      level3: level3Amt,
      average: averageReferralEarning,
      total: totalReferralEarning,
    },
    averageReferralEarning,
    estimatedEarning,
    remarks: body.remarks || '',
  };
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).user;
    const isAdmin = authUser?.roles.includes('admin');

    if (!isAdmin && !validateProductFields(req.body, res)) {
      return;
    }

    const {
      name,
      description,
      categoryId,
      subCategoryId,
      childCategoryId,
      brand,
      sku,
      baseMrp,
      discountPercent,
      baseSellingPrice,
      stock,
      sellerType,
    } = req.body;

    // Block product creation if experience config restricts it
    const targetCategoryIds = [categoryId, subCategoryId, childCategoryId].filter(Boolean);
    if (targetCategoryIds.length > 0) {
      const blockedConfig = await CategoryExperienceConfig.findOne({
        categoryId: { $in: targetCategoryIds },
        productCreationEnabled: false,
      });
      if (blockedConfig) {
        res.status(403).json({
          success: false,
          message: 'Product creation is disabled for this category.',
        });
        return;
      }
    }

    let finalCategoryId = categoryId;
    const sellerId = isAdmin ? (req.body.sellerId || authUser.id) : authUser.id;

    if (!sellerId) {
      res.status(401).json({
        message: 'Seller not found. Login required.',
      });
      return;
    }

    if (!isAdmin) {
      const vendor = await Vendor.findOne({ $or: [{ userId: sellerId }, { _id: sellerId }] });
      if (vendor) {
        try {
          const { EntitlementService } = await import('../modules/subscription/services/EntitlementService');
          const { VendorSubscription } = await import('../modules/subscription/models/VendorSubscription');

          // Check vendor's current subscription status first
          const vendorSub = await VendorSubscription.findOne({ vendorId: vendor._id });
          const now = new Date();

          // TRIAL vendors (within trial period) always get product creation access
          const regDate = vendor.createdAt ? new Date(vendor.createdAt as any) : now;
          const trialEnd = vendorSub?.trialEnd || new Date(regDate.getTime() + 30 * 24 * 60 * 60 * 1000);
          const isOnTrial = !vendorSub || vendorSub.status === 'TRIAL' || (now <= trialEnd);
          const isActivePaid = vendorSub && (vendorSub.status === 'ACTIVE' || vendorSub.status === 'GRACE_PERIOD');
          const isActiveVendor = vendor.status === 'active' || !vendor.status;

          // Allow during trial or if vendor is active with no explicit subscription (default free access)
          if (isOnTrial || !vendorSub) {
            // Trial/new vendors: allow up to 500 products free
            const currentCount = await Product.countDocuments({
              $or: [{ sellerId: sellerId }, { sellerId: vendor._id }]
            });
            if (currentCount >= 500) {
              res.status(403).json({
                success: false,
                message: `Trial product limit reached (500 items). Please upgrade to a paid plan to add more products.`,
                limit: 500,
                currentCount
              });
              return;
            }
          } else if (isActivePaid) {
            // Paid active subscription: check entitlement limits
            const isRestaurant = vendor.storeType === 'restaurant' || (vendor as any).primaryCategory?.toLowerCase().includes('food');
            const featKey = isRestaurant ? 'MAX_MENU_ITEMS' : 'MAX_PRODUCTS';
            const entitlement = await EntitlementService.getFeatureEntitlement(vendor._id.toString(), featKey);

            if (entitlement && !entitlement.enabled && entitlement.source !== 'DEFAULT') {
              res.status(403).json({
                success: false,
                message: 'Product creation feature is disabled for your active subscription plan. Please upgrade your plan.'
              });
              return;
            }

            if (entitlement && entitlement.limit !== null && entitlement.limit !== undefined) {
              const currentCount = await Product.countDocuments({
                $or: [{ sellerId: sellerId }, { sellerId: vendor._id }]
              });
              if (currentCount >= entitlement.limit) {
                res.status(403).json({
                  success: false,
                  message: `Product limit reached (${entitlement.limit} items) for your subscription plan. Please upgrade to Premium for more items.`,
                  limit: entitlement.limit,
                  currentCount
                });
                return;
              }
            }
          } else if (isActiveVendor) {
            // Expired subscription but vendor account is still active: allow with a soft limit
            const currentCount = await Product.countDocuments({
              $or: [{ sellerId: sellerId }, { sellerId: vendor._id }]
            });
            if (currentCount >= 100) {
              res.status(403).json({
                success: false,
                message: `Your subscription has expired. You can continue with your existing ${currentCount} products, but adding more requires an active plan. Please renew your subscription.`,
                limit: 100,
                currentCount
              });
              return;
            }
          }
          // If none of the above, let vendor create product
        } catch (eErr: any) {
          console.warn('[Product Subscription Check Warning]:', eErr.message);
          // On any error in subscription check, allow the product creation to proceed
        }
      }
    }

    if (!finalCategoryId && sellerId) {
      const vendor = await Vendor.findOne({ $or: [{ userId: sellerId }, { _id: sellerId }] });
      if (vendor) {
        const catSearchStr = vendor.primaryCategory || (vendor.categories && vendor.categories[0]);
        if (catSearchStr) {
          const matchedCat = await Category.findOne({
            $or: [
              { _id: mongoose.Types.ObjectId.isValid(catSearchStr) ? catSearchStr : null },
              { name: new RegExp(`^${catSearchStr.replace(/[^a-zA-Z0-9]/g, '.*')}`, 'i') },
              { slug: makeSlug(catSearchStr) }
            ]
          });
          if (matchedCat) {
            finalCategoryId = matchedCat._id;
          }
        }
      }
    }

    if (!name?.trim() || !finalCategoryId || !sku?.trim()) {
      res.status(400).json({
        message: 'Product name, category and SKU are required',
      });
      return;
    }

    const cleanSku = String(sku).toUpperCase().trim();

    const existingSku = await Product.exists({ sku: cleanSku });

    if (existingSku) {
      res.status(400).json({
        message: 'SKU already exists. Please regenerate SKU.',
      });
      return;
    }

    const slug = await makeUniqueSlug(name);
    const uploaded = await getUploadedFiles(req);

    const parsedVariants = normalizeVariants(parseJson(req.body.variants, []));
    const parsedAttributes = parseJson(req.body.attributes, {});

    const mrp = normalizeNumber(baseMrp);
    const discount = normalizeNumber(discountPercent);
    const calculatedSelling =
      mrp > 0 ? Math.round(mrp - (mrp * discount) / 100) : 0;

    let product: any;
    const vendor = await Vendor.findOne({ $or: [{ userId: sellerId }, { _id: sellerId }] });
    const storeId = vendor ? vendor._id.toString() : sellerId.toString();

    // Perform atomic creation with rollback protection
    try {
      product = await Product.create({
        sellerId,
        sellerType: sellerType || 'vendor',
        vendorPincode: vendor?.pincode || req.body.vendorPincode || '',

        name: name.trim(),
        slug,
        description: description || '',

        categoryId: finalCategoryId,
        subCategoryId: subCategoryId || null,
        subcategoryId: subCategoryId || null,
        childCategoryId: childCategoryId || null,
        createdBy: sellerId,

        brand: brand || '',
        sku: cleanSku,

        thumbnail: uploaded.thumbnail,
        images: uploaded.images,

        attributes: parsedAttributes,
        variants: parsedVariants,

        baseMrp: mrp,
        discountPercent: discount,
        baseSellingPrice:
          baseSellingPrice !== undefined && baseSellingPrice !== ''
            ? normalizeNumber(baseSellingPrice)
            : calculatedSelling,
        stock: normalizeNumber(stock),

        status: isAdmin ? (req.body.status || 'Live') : 'Pending Review',
        isActive: isAdmin ? (req.body.isActive !== false) : false,
        moderationStatus: isAdmin ? 'approved' : 'pending',
        adminPricingApproved: isAdmin ? true : false,
        sellerPricingAccepted: isAdmin ? true : false,
        submittedAt: new Date(),
        isStoreProduct: req.body.isStoreProduct === 'true' || req.body.isStoreProduct === true,
        isSubscriptionAvailable: req.body.isSubscriptionAvailable === 'true' || req.body.isSubscriptionAvailable === true,
        isPreOrder: req.body.isPreOrder === 'true' || req.body.isPreOrder === true,
        preOrderType: req.body.preOrderType || 'ADVANCE_NOTICE',
        preOrderLeadTimeDays: Number(req.body.preOrderLeadTimeDays) || 1,
        preOrderLeadTimeHours: Number(req.body.preOrderLeadTimeHours) || 24,
        preOrderDailyCutoffTime: req.body.preOrderDailyCutoffTime || '18:00',
        preOrderAllowTimeSlot: req.body.preOrderAllowTimeSlot === undefined ? true : (req.body.preOrderAllowTimeSlot === 'true' || req.body.preOrderAllowTimeSlot === true),
        preOrderAllowCustomMessage: req.body.preOrderAllowCustomMessage === 'true' || req.body.preOrderAllowCustomMessage === true,
        preOrderCustomMessageLabel: req.body.preOrderCustomMessageLabel || 'Message on Cake / Custom Instructions',
        preOrderAvailableDays: parseJson(req.body.preOrderAvailableDays, []),
        preOrderReleaseDate: req.body.preOrderReleaseDate ? new Date(req.body.preOrderReleaseDate) : null,
        preOrderMessage: req.body.preOrderMessage || '',
        preOrderLimit: Number(req.body.preOrderLimit) || 0,
        isSelfPickup: req.body.isSelfPickup === undefined ? true : (req.body.isSelfPickup === 'true' || req.body.isSelfPickup === true),
        deliveryScope: req.body.deliveryScope || (req.body.isPanIndia === 'true' || req.body.isPanIndia === true ? 'pan_india' : 'local'),
        isPanIndia: req.body.deliveryScope === 'pan_india' || req.body.isPanIndia === 'true' || req.body.isPanIndia === true,
      });

      if (mongoose.Types.ObjectId.isValid(storeId)) {
        try {
          const StoreProductModel = mongoose.model('StoreProduct');
          const InventoryModel = mongoose.model('Inventory');

          await StoreProductModel.create({
            storeId: new mongoose.Types.ObjectId(storeId),
            productId: product._id,
            mrp: mrp || 0,
            sellingPrice: calculatedSelling || mrp || 0,
            minimumOrderQuantity: 1,
            preparationTimeMinutes: 15,
            isActive: true,
          });

          await InventoryModel.create({
            storeId: new mongoose.Types.ObjectId(storeId),
            productId: product._id,
            availableStock: normalizeNumber(stock, 50),
            reservedStock: 0,
            damagedStock: 0,
            lowStockThreshold: 5,
          });
        } catch (subErr: any) {
          console.warn('[Auxiliary StoreProduct/Inventory Creation Warning]:', subErr.message);
        }
      }
    } catch (createErr: any) {
      console.error('[Product Creation Error]:', createErr.message);
      throw new Error(`Product creation failed: ${createErr.message}`);
    }

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.status(201).json({
      success: true,
      message: 'Product added successfully and is live!',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to create product',
      error: error.message,
    });
  }
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { category, categoryId, status, isActive, excludeId, limit, page, sellerId, sellerType } = req.query;

    const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;
    const pincode = req.query.pincode ? String(req.query.pincode).trim() : '';
    const state = req.query.state ? String(req.query.state).trim() : '';
    const district = req.query.district ? String(req.query.district).trim() : '';
    const mandal = req.query.mandal ? String(req.query.mandal).trim() : '';

    const andConditions: any[] = [];
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = (status === 'all' || Number(limit) >= 100)
      ? Math.min(10000, Math.max(1, Number(limit) || 1000))
      : Math.min(100, Math.max(1, Number(limit) || 20));

    // 1. Enforce Hyperlocal vs Pan-India Product Visibility based on Customer Location (when sellerId is not specified)
    if (!sellerId && (district || mandal || pincode || (lat && lng))) {
      let matchingVendors: any[] = [];

      if (lat && lng) {
        // Fetch active vendors and filter by coordinate distance <= deliveryRadiusKm (or max 20km)
        const allActiveVendors = await Vendor.find({
          status: { $in: ['active', 'Approved', 'approved', 'ACTIVE', 'Active'] }
        }).select('_id userId location pincode mandal district deliveryRadiusKm').lean();

        matchingVendors = allActiveVendors.filter(v => {
          const vLng = v.location?.coordinates?.[0];
          const vLat = v.location?.coordinates?.[1];
          if (typeof vLat === 'number' && typeof vLng === 'number' && vLat !== 0 && vLng !== 0) {
            const dist = calculateDistance(lat, lng, vLat, vLng);
            const maxRadius = v.deliveryRadiusKm || 20;
            return dist <= maxRadius;
          }
          if (pincode && v.pincode && String(v.pincode).trim() === String(pincode).trim()) return true;
          if (mandal && v.mandal && v.mandal.toLowerCase() === mandal.toLowerCase()) return true;
          return false;
        });
      } else {
        const vendorLocationOr: any[] = [];
        if (pincode) {
          const cleanPin = String(pincode).trim();
          vendorLocationOr.push({ pincode: cleanPin });
          vendorLocationOr.push({ pinCode: cleanPin });
        }
        if (mandal) {
          const cleanMandal = mandal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          vendorLocationOr.push({ mandal: { $regex: `^${cleanMandal}$`, $options: 'i' } });
        }
        if (district && !pincode && !mandal) {
          const cleanDistrict = district.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          vendorLocationOr.push({ district: { $regex: `^${cleanDistrict}$`, $options: 'i' } });
          vendorLocationOr.push({ city: { $regex: `^${cleanDistrict}$`, $options: 'i' } });
        }

        if (vendorLocationOr.length > 0) {
          matchingVendors = await Vendor.find({
            status: { $in: ['active', 'Approved', 'approved', 'ACTIVE', 'Active'] },
            $or: vendorLocationOr
          }).select('_id userId').lean();
        }
      }

      const allowedSellerIds = matchingVendors.flatMap(v => [v._id, v.userId]).filter(Boolean);

      andConditions.push({
        $or: [
          ...(allowedSellerIds.length > 0 ? [{ sellerId: { $in: allowedSellerIds } }] : []),
          { deliveryScope: { $in: ['pan_india', 'both', 'national_courier'] } },
          { isPanIndia: true },
          { isGlobalDelivery: true }
        ]
      });
    }

    // 2. Specific seller query
    if (sellerId) {
      const vendor = await Vendor.findOne({ $or: [{ userId: sellerId }, { _id: sellerId }] });
      if (vendor) {
        andConditions.push({
          $or: [
            { sellerId: sellerId },
            { sellerId: vendor._id },
            { sellerId: vendor.userId },
            { createdBy: sellerId },
            { createdBy: vendor.userId }
          ]
        });
      } else {
        andConditions.push({ sellerId: sellerId });
      }
    }
    if (sellerType) {
      andConditions.push({ sellerType: sellerType });
    }

    // 3. Status & Active filtering
    const liveStatuses = ['Live', 'Active', 'Approved', 'approved', 'active', 'published'];
    if (status === 'all') {
      // Admin query for all products: do not restrict by status or active state
    } else {
      if (status && status !== 'draft' && status !== 'pending' && status !== 'rejected' && status !== 'Inactive' && status !== 'inactive') {
        andConditions.push({ status: { $in: liveStatuses } });
      } else if (!status) {
        andConditions.push({ status: { $in: liveStatuses } });
      } else if (status) {
        andConditions.push({ status: status });
      }

      if (isActive !== undefined) {
        andConditions.push({ isActive: isActive === 'true' });
      } else {
        andConditions.push({ isActive: true });
      }

      andConditions.push({ isArchived: { $ne: true } });
      andConditions.push({ moderationStatus: { $ne: 'rejected' } });
    }

    // 4. Category filtering
    if (category || categoryId) {
      const catParam = String(categoryId || category).trim();
      const cleanParam = catParam.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, '').trim();

      let foundCategory = null;
      if (mongoose.Types.ObjectId.isValid(catParam)) {
        foundCategory = await Category.findById(catParam).select('_id').lean();
      }
      if (!foundCategory && cleanParam) {
        const regex = new RegExp(cleanParam.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        foundCategory = await Category.findOne({
          $or: [
            { name: regex },
            { slug: catParam.toLowerCase() },
            { slug: cleanParam.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
          ]
        }).select('_id').lean();
      }

      if (foundCategory) {
        const childCats = await Category.find({ parentId: foundCategory._id }).select('_id').lean();
        const childCatIds = childCats.map((c) => c._id);
        const grandChildCats = await Category.find({ parentId: { $in: childCatIds } }).select('_id').lean();
        const allCatIds = [foundCategory._id, ...childCatIds, ...grandChildCats.map((c) => c._id)];

        andConditions.push({
          $or: [
            { categoryId: { $in: allCatIds } },
            { subCategoryId: { $in: allCatIds } },
            { subcategoryId: { $in: allCatIds } },
            { childCategoryId: { $in: allCatIds } }
          ]
        });
      } else {
        const regex = new RegExp(cleanParam.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
        andConditions.push({
          $or: [
            { category: regex },
            { subcategory: regex },
            { name: regex },
            { brand: regex }
          ]
        });
      }
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    let authUser: any = undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork') as any;
        authUser = decoded;
      } catch (err) { }
    }

    const isAdmin = authUser && authUser.roles?.includes('admin');
    let selectString = '';
    if (!isAdmin) {
      selectString = '-adminPricing -commissionShares -sellerNegotiations -purchasePrice -internalNotes -approvalHistory';
    }

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limitNum);

    let query = Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const rawProducts = await populateProductList(query.select(selectString));

    const sellerIds = rawProducts.flatMap((p: any) => [p.sellerId?._id, p.sellerId, p.createdBy]).filter(Boolean);
    const vendors = sellerIds.length > 0
      ? await Vendor.find({ $or: [{ userId: { $in: sellerIds } }, { _id: { $in: sellerIds } }] })
        .select('_id userId businessName ownerName shopName storeName location pincode mandal district state deliveryMode storeDesign')
        .lean()
      : [];
    const vendorMap = new Map();
    vendors.forEach((v: any) => {
      if (v.userId) vendorMap.set(v.userId.toString(), v);
      if (v._id) vendorMap.set(v._id.toString(), v);
    });

    const products = rawProducts.map((p: any) => {
      const productObj = p;
      const sellerIdStr = (p.sellerId?._id || p.sellerId || '').toString();
      const createdByStr = (p.createdBy?._id || p.createdBy || '').toString();
      const vendor = vendorMap.get(sellerIdStr) || vendorMap.get(createdByStr);

      let distanceKm: number | null = null;
      let duration = 15;
      let shippingCharge = 0;
      let deliveryTimeLabel = '⚡ Fast [15 MINS]';
      let isCourierShipping = false;

      const isPanIndiaItem = productObj.isPanIndia || productObj.deliveryScope === 'pan_india' || productObj.deliveryScope === 'both';
      const vendorLat = vendor?.location?.coordinates?.[1];
      const vendorLng = vendor?.location?.coordinates?.[0];

      if (lat && lng && typeof vendorLat === 'number' && typeof vendorLng === 'number') {
        distanceKm = calculateDistance(lat, lng, vendorLat, vendorLng);
      } else if (pincode && vendor?.pincode) {
        if (pincode === vendor.pincode) {
          distanceKm = 1.5;
        } else if (district && vendor?.district && district.toLowerCase() !== vendor.district.toLowerCase()) {
          distanceKm = 280; // Inter-district (e.g. Hyderabad vs Adilabad)
        } else {
          distanceKm = 8.5;
        }
      } else if (district && vendor?.district) {
        if (district.toLowerCase() === vendor.district.toLowerCase()) {
          distanceKm = 3.5;
        } else {
          distanceKm = 280; // Inter-district
        }
      }

      if (distanceKm !== null && distanceKm > 20) {
        isCourierShipping = true;
        deliveryTimeLabel = '🌐 Courier [2-4 Days]';
        duration = 2880; // 2 days in minutes
        shippingCharge = distanceKm > 100 ? 50 : 30;
      } else if (distanceKm !== null) {
        isCourierShipping = false;
        duration = Math.max(10, Math.round(10 + distanceKm * 2));
        deliveryTimeLabel = `⚡ Fast [${duration} MINS]`;
        shippingCharge = distanceKm > 3 ? Math.round(distanceKm * 6) : 0;
      } else if (isPanIndiaItem) {
        isCourierShipping = true;
        deliveryTimeLabel = '🌐 Pan-India Courier';
        duration = 2880;
        shippingCharge = productObj.adminPricing?.shippingCharge ?? 0;
      } else {
        isCourierShipping = false;
        duration = 15;
        deliveryTimeLabel = '⚡ Fast [15 MINS]';
        shippingCharge = productObj.adminPricing?.shippingCharge ?? 0;
        distanceKm = 1.5;
      }

      if (!productObj.adminPricing) {
        productObj.adminPricing = {};
      }

      const finalShippingCharge = productObj.adminPricing?.shippingCharge ?? shippingCharge;
      productObj.adminPricing.shippingCharge = finalShippingCharge;
      productObj.shippingCharge = finalShippingCharge;
      productObj.calculatedDistanceKm = distanceKm !== null ? parseFloat(distanceKm.toFixed(1)) : null;
      productObj.estimatedDeliveryMinutes = duration;
      productObj.deliveryTimeLabel = deliveryTimeLabel;
      productObj.isCourierShipping = isCourierShipping;
      productObj.deliveryMode = vendor?.deliveryMode || 'self_delivery';
      productObj.vendorLocationName = vendor?.district || vendor?.state || '';

      const vPin = vendor?.pincode || (p.sellerId && typeof p.sellerId === 'object' ? (p.sellerId.pincode || p.sellerId.pinCode) : '') || '';
      productObj.vendorPincode = vPin;
      productObj.shopPincode = vPin;
      productObj.storePincode = vPin;
      productObj.vendorMandal = vendor?.mandal || '';
      productObj.vendorDistrict = vendor?.district || '';
      productObj.vendorState = vendor?.state || '';
      productObj.vendorCoordinates = vendor?.location?.coordinates || null;

      productObj.sellerId = {
        ...(typeof productObj.sellerId === 'object' ? productObj.sellerId : {}),
        _id: vendor?._id || (typeof productObj.sellerId === 'object' ? productObj.sellerId?._id : productObj.sellerId),
        name: vendor?.businessName || vendor?.ownerName || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.name : 'ApexBee Seller'),
        businessName: vendor?.businessName,
        pincode: vPin,
        pinCode: vPin,
        location: vendor?.location || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.location : null),
        district: vendor?.district || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.district : '')
      };

      // Store name & store rating override
      const shopNameVal = vendor?.shopName || vendor?.storeName || vendor?.storeDesign?.shopName || vendor?.storeDesign?.storeName || vendor?.businessName;
      if (shopNameVal) {
        productObj.shopName = shopNameVal;
        productObj.storeName = shopNameVal;
      }
      if (vendor?.businessName) {
        productObj.businessName = vendor.businessName;
      }
      productObj.brand = shopNameVal || vendor?.businessName || productObj.brand || 'ApexBee Seller';
      productObj.vendorRating = 4.8;

      return productObj;
    });

    res.json({
      success: true,
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages,
        totalProducts
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch products error:', error);
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message,
    });
  }
};

export const getMyProducts = async (req: Request, res: Response) => {
  try {
    const sellerId = (req as any).user?.id || (req as any).user?._id || req.query.sellerId;

    if (!sellerId) {
      res.status(401).json({
        message: 'Seller not found',
      });
      return;
    }

    const products = await populateProductList(
      Product.find({ sellerId, isArchived: { $ne: true } })
        .sort({ createdAt: -1 })
        .lean()
    );

    res.json({ products });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch seller products',
      error: error.message,
    });
  }
};



export const getProductById = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const product = await populateProduct(Product.findById(req.params.id));

    if (!product) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    let authUser: any = undefined;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork') as any;
        authUser = decoded;
      } catch (err) { }
    }

    const isOwner = authUser && String(product.sellerId._id || product.sellerId) === String(authUser.id);
    const isAdmin = authUser && authUser.roles?.includes('admin');

    const liveStatuses = ['Live', 'Active', 'Approved', 'approved', 'active', 'published'];
    const isLive = liveStatuses.includes(product.status) && product.isActive !== false && product.isArchived !== true && product.moderationStatus !== 'rejected';
    if (!isLive && !isOwner && !isAdmin) {
      res.status(404).json({ success: false, message: 'Product is currently not live or unavailable' });
      return;
    }

    const productObj = product.toObject();
    const sellerIdVal = product.sellerId?._id || product.sellerId || product.createdBy;
    const vendor = await Vendor.findOne({ $or: [{ _id: sellerIdVal }, { userId: sellerIdVal }] });
    const vPin = vendor?.pincode || (product.sellerId && typeof product.sellerId === 'object' ? ((product.sellerId as any).pincode || (product.sellerId as any).pinCode) : '') || '';

    productObj.vendorPincode = vPin;
    productObj.shopPincode = vPin;
    productObj.storePincode = vPin;
    productObj.vendorMandal = vendor?.mandal || '';
    productObj.vendorDistrict = vendor?.district || '';
    productObj.vendorState = vendor?.state || '';
    productObj.vendorLocationName = vendor?.district || vendor?.state || '';

    productObj.sellerId = {
      ...(typeof productObj.sellerId === 'object' ? productObj.sellerId : {}),
      _id: vendor?._id || (typeof productObj.sellerId === 'object' ? productObj.sellerId?._id : productObj.sellerId),
      name: vendor?.businessName || vendor?.ownerName || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.name : 'ApexBee Seller'),
      businessName: vendor?.businessName,
      pincode: vPin,
      pinCode: vPin,
      location: vendor?.location || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.location : null),
      district: vendor?.district || (typeof productObj.sellerId === 'object' ? productObj.sellerId?.district : '')
    };

    if (!isOwner && !isAdmin) {
      delete productObj.adminPricing;
      delete productObj.commissionShares;
      delete productObj.sellerNegotiations;
      delete productObj.purchasePrice;
      delete productObj.internalNotes;
      delete productObj.approvalHistory;
    }

    res.json({ product: productObj });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch product',
      error: error.message,
    });
  }
}

export const updateProduct = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Resource not found' });
      return;
    }

    const authUser = (req as any).user;
    const isOwner = authUser && String(product.sellerId) === String(authUser.id);
    const isAdmin = authUser && authUser.roles?.includes('admin');

    if (!isOwner && !isAdmin) {
      res.status(404).json({ success: false, message: 'Resource not found' });
      return;
    }

    if (!isAdmin && !validateProductFields(req.body, res)) {
      return;
    }
    // Capture pre-edit snapshot for vendor edits so admin can compare changes
    if (!isAdmin) {
      product.preEditSnapshot = {
        name: product.name,
        description: product.description,
        baseMrp: product.baseMrp,
        baseSellingPrice: product.baseSellingPrice,
        stock: product.stock,
        sku: product.sku,
        thumbnail: product.thumbnail,
        images: [...(product.images || [])],
        attributes: product.attributes ? JSON.parse(JSON.stringify(product.attributes)) : {},
        minimumOrderQuantity: product.minimumOrderQuantity || 1,
        isStoreProduct: product.isStoreProduct,
        isSubscriptionAvailable: product.isSubscriptionAvailable,
        isPreOrder: product.isPreOrder,
        preOrderReleaseDate: product.preOrderReleaseDate,
        preOrderMessage: product.preOrderMessage,
        preOrderLimit: product.preOrderLimit,
        deliveryScope: product.deliveryScope,
        brand: product.brand,
        snapshotAt: new Date(),
      };
    }

    const uploaded = await getUploadedFiles(req);

    if (uploaded.thumbnail) {
      product.thumbnail = uploaded.thumbnail;
    }

    if (uploaded.images.length) {
      product.images = [...product.images, ...uploaded.images];
    }

    if (req.body.name && req.body.name !== product.name) {
      product.name = req.body.name.trim();
      product.slug = await makeUniqueSlug(req.body.name, product._id);
    }

    if (req.body.sku && req.body.sku !== product.sku) {
      const newSku = String(req.body.sku).toUpperCase().trim();

      const existingSku = await Product.exists({
        sku: newSku,
        _id: { $ne: product._id },
      });

      if (existingSku) {
        res.status(400).json({
          message: 'SKU already exists. Please regenerate SKU.',
        });
        return;
      }

      product.sku = newSku;
    }

    product.description = req.body.description ?? product.description;
    product.categoryId = req.body.categoryId || product.categoryId;

    product.subCategoryId =
      req.body.subCategoryId === ''
        ? null
        : req.body.subCategoryId || product.subCategoryId;

    product.childCategoryId =
      req.body.childCategoryId === ''
        ? null
        : req.body.childCategoryId || product.childCategoryId;

    product.brand = req.body.brand ?? product.brand;

    if (req.body.baseMrp !== undefined) {
      product.baseMrp = normalizeNumber(req.body.baseMrp);
    }

    if (req.body.discountPercent !== undefined) {
      product.discountPercent = normalizeNumber(req.body.discountPercent);
    }

    if (req.body.baseSellingPrice !== undefined) {
      product.baseSellingPrice = normalizeNumber(req.body.baseSellingPrice);
    }

    if (req.body.stock !== undefined) {
      product.stock = normalizeNumber(req.body.stock);
    }

    if (req.body.attributes !== undefined) {
      product.attributes = parseJson(req.body.attributes, {});
    }

    if (req.body.variants !== undefined) {
      product.variants = normalizeVariants(parseJson(req.body.variants, [])) as any;
    }

    // Auto-extract MOQ from attributes or body
    const findMoqFromAttrs = (attrs: any) => {
      if (!attrs || typeof attrs !== 'object') return 0;
      for (const [k, v] of Object.entries(attrs)) {
        if (k.toLowerCase().includes('moq') || k.toLowerCase().includes('minimum order')) {
          const n = Number(v);
          if (!isNaN(n) && n > 0) return n;
        }
      }
      return 0;
    };

    const attrMoq = findMoqFromAttrs(product.attributes) || (Array.isArray(product.variants) ? findMoqFromAttrs(product.variants[0]?.attributes) : 0);
    const reqMoq = Number(req.body.minimumOrderQuantity || req.body.moq) || 0;
    const finalMoq = Math.max(1, reqMoq || attrMoq || Number(product.minimumOrderQuantity) || 1);
    product.minimumOrderQuantity = finalMoq;
    product.moq = finalMoq;

    if (req.body.isStoreProduct !== undefined) {
      product.isStoreProduct = req.body.isStoreProduct === 'true' || req.body.isStoreProduct === true;
    }
    if (req.body.isSubscriptionAvailable !== undefined) {
      product.isSubscriptionAvailable = req.body.isSubscriptionAvailable === 'true' || req.body.isSubscriptionAvailable === true;
    }
    if (req.body.isPreOrder !== undefined) {
      product.isPreOrder = req.body.isPreOrder === 'true' || req.body.isPreOrder === true;
    }
    if (req.body.preOrderType !== undefined) {
      product.preOrderType = req.body.preOrderType;
    }
    if (req.body.preOrderLeadTimeDays !== undefined) {
      product.preOrderLeadTimeDays = Number(req.body.preOrderLeadTimeDays) || 1;
    }
    if (req.body.preOrderLeadTimeHours !== undefined) {
      product.preOrderLeadTimeHours = Number(req.body.preOrderLeadTimeHours) || 24;
    }
    if (req.body.preOrderDailyCutoffTime !== undefined) {
      product.preOrderDailyCutoffTime = req.body.preOrderDailyCutoffTime || '18:00';
    }
    if (req.body.preOrderAllowTimeSlot !== undefined) {
      product.preOrderAllowTimeSlot = req.body.preOrderAllowTimeSlot === 'true' || req.body.preOrderAllowTimeSlot === true;
    }
    if (req.body.preOrderAllowCustomMessage !== undefined) {
      product.preOrderAllowCustomMessage = req.body.preOrderAllowCustomMessage === 'true' || req.body.preOrderAllowCustomMessage === true;
    }
    if (req.body.preOrderCustomMessageLabel !== undefined) {
      product.preOrderCustomMessageLabel = req.body.preOrderCustomMessageLabel || 'Message on Cake / Custom Instructions';
    }
    if (req.body.preOrderAvailableDays !== undefined) {
      product.preOrderAvailableDays = parseJson(req.body.preOrderAvailableDays, []);
    }
    if (req.body.preOrderReleaseDate !== undefined) {
      product.preOrderReleaseDate = req.body.preOrderReleaseDate ? new Date(req.body.preOrderReleaseDate) : null;
    }
    if (req.body.preOrderMessage !== undefined) {
      product.preOrderMessage = req.body.preOrderMessage || '';
    }
    if (req.body.preOrderLimit !== undefined) {
      product.preOrderLimit = Number(req.body.preOrderLimit) || 0;
    }
    if (req.body.isSelfPickup !== undefined) {
      product.isSelfPickup = req.body.isSelfPickup === 'true' || req.body.isSelfPickup === true;
    }

    if (req.body.deliveryScope) {
      product.deliveryScope = req.body.deliveryScope;
    }
    if (req.body.isLocalDelivery !== undefined) {
      product.isLocalDelivery = req.body.isLocalDelivery === 'true' || req.body.isLocalDelivery === true;
    }
    if (req.body.isPanIndia !== undefined) {
      product.isPanIndia = req.body.isPanIndia === 'true' || req.body.isPanIndia === true;
    }

    if (!isAdmin) {
      product.status = 'Vendor Edited';
      product.isVendorEdit = true;
      product.vendorEditedAt = new Date();
      product.adminPricingApproved = false;
      product.sellerPricingAccepted = false;
      product.isActive = false;
      product.approvedByAdminAt = undefined;
      product.sellerAcceptedAt = undefined;
      product.liveAt = undefined;
    }

    await product.save();

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      success: true,
      message: isAdmin
        ? 'Product updated successfully.'
        : 'Product updated successfully and submitted to Admin for review & approval.',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update product',
      error: error.message,
    });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId ? String(rawId).replace(/^(prod_|food_)/, '') : '';
    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const authUser = (req as any).user;
    const isAdmin = authUser && (authUser.roles?.includes('admin') || authUser.role === 'admin');

    const product = await Product.findById(cleanId);
    let foodItem = null;

    if (!product) {
      foodItem = await FoodMenuItem.findById(cleanId);
      if (!foodItem) {
        res.status(404).json({ success: false, message: 'Product or food item not found' });
        return;
      }
    }

    const isOwner = authUser && product && (String(product.sellerId) === String(authUser.id) || String(product.createdBy) === String(authUser.id));

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
      return;
    }

    // Permanent delete from database for admin or when permanent=true query parameter is present
    if (isAdmin || req.query.permanent === 'true') {
      if (product) {
        const prodId = product._id;
        const foodMenuId = product.foodMenuItemId;

        // 1. Permanently remove from Product collection
        await Product.findByIdAndDelete(prodId);

        // 2. If it was linked to a FoodMenuItem, delete that too
        if (foodMenuId) {
          await FoodMenuItem.findByIdAndDelete(foodMenuId);
          try {
            if (mongoose.models.FoodVariant) {
              await mongoose.models.FoodVariant.deleteMany({ menuItemId: foodMenuId });
            }
          } catch (_) {}
          try {
            if (mongoose.models.FoodMenuItemAddonGroup) {
              await mongoose.models.FoodMenuItemAddonGroup.deleteMany({ menuItemId: foodMenuId });
            }
          } catch (_) {}
        }

        // 3. Remove associated StoreProduct & Inventory
        try {
          const StoreProductModel = mongoose.model('StoreProduct');
          await StoreProductModel.deleteMany({ productId: prodId });
        } catch (_) {}

        try {
          const InventoryModel = mongoose.model('Inventory');
          await InventoryModel.deleteMany({ productId: prodId });
        } catch (_) {}
      }

      if (foodItem) {
        const fId = foodItem._id;
        await FoodMenuItem.findByIdAndDelete(fId);
        await Product.deleteMany({ foodMenuItemId: fId });
        try {
          if (mongoose.models.FoodVariant) {
            await mongoose.models.FoodVariant.deleteMany({ menuItemId: fId });
          }
        } catch (_) {}
        try {
          if (mongoose.models.FoodMenuItemAddonGroup) {
            await mongoose.models.FoodMenuItemAddonGroup.deleteMany({ menuItemId: fId });
          }
        } catch (_) {}
      }

      res.json({ success: true, message: 'Product permanently deleted from database successfully' });
      return;
    }

    // Soft-delete / Archive live products for non-admin seller requests
    product.isArchived = true;
    product.isActive = false;
    product.status = 'Archived';
    await product.save();

    try {
      const StoreProductModel = mongoose.model('StoreProduct');
      const InventoryModel = mongoose.model('Inventory');

      await StoreProductModel.updateMany({ productId: product._id }, { $set: { isAvailableForDelivery: false, isAvailableForPickup: false } });
      await InventoryModel.updateMany({ productId: product._id }, { $set: { availableQuantity: 0 } });
    } catch (_) {}

    res.json({ success: true, message: 'Product archived and removed from storefront successfully' });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete product',
      error: error.message,
    });
  }
};

export const configureAdminPricing = async (req: Request, res: Response) => {
  try {
    const prodId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(prodId)) {
      res.status(400).json({ success: false, message: 'Invalid Product ID format' });
      return;
    }

    // Try finding by Product _id first, then by foodMenuItemId
    let product = await Product.findById(prodId);
    if (!product) {
      product = await Product.findOne({ foodMenuItemId: prodId });
    }

    // If still not found, check if a FoodMenuItem exists and auto-create the Product record
    if (!product) {
      const foodItem = await FoodMenuItem.findById(prodId);
      if (foodItem) {
        product = await Product.create({
          name: foodItem.name,
          slug: foodItem.slug || foodItem.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now(),
          description: foodItem.description || '',
          sellerId: foodItem.restaurantId,
          sellerType: 'RestaurantProfile',
          itemType: 'FOOD',
          foodMenuItemId: foodItem._id,
          baseMrp: foodItem.basePrice,
          baseSellingPrice: foodItem.offerPrice || foodItem.basePrice,
          thumbnail: foodItem.image || '',
          images: foodItem.image ? [foodItem.image] : [],
          moderationStatus: 'pending',
          status: 'Pending Review',
          isActive: false,
          stock: 9999,
          sku: `FOOD-${foodItem._id.toString().slice(-6).toUpperCase()}`,
          adminPricingApproved: false,
          sellerPricingAccepted: false,
        });
      }
    }

    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const adminPricing = buildAdminPricing(req.body);

    product.adminPricing = {
      ...adminPricing,
      configuredBy: (req as any).user?._id || (req as any).user?.id || req.body.adminId,
      configuredAt: new Date(),
    } as any;

    // Explicitly persist shipping and packaging charges on root product document for fast querying & frontend rendering
    product.shippingCharge = adminPricing.shippingCharge || 0;
    product.packingCharge = adminPricing.packingCharge || 0;
    product.deliveryFee = adminPricing.shippingCharge || 0;
    product.packagingCharge = adminPricing.packingCharge || 0;
    product.packageCharge = adminPricing.packingCharge || 0;

    if (req.body.referralCommission) {
      product.referralCommission = {
        level1: normalizeNumber(req.body.referralCommission.level1),
        level2: normalizeNumber(req.body.referralCommission.level2),
        level3: normalizeNumber(req.body.referralCommission.level3)
      };
    } else {
      const shares = req.body.commissionShares;
      if (Array.isArray(shares)) {
        const getSharePercent = (type: string) => {
          const sh = shares.find((s: any) => s && s.type === type && s.isActive !== false);
          return sh ? (Number(sh.percent) || 0) : 0;
        };
        product.referralCommission = {
          level1: getSharePercent("level1"),
          level2: getSharePercent("level2"),
          level3: getSharePercent("level3")
        };
      }
    }

    product.status = 'Awaiting Seller Approval';
    product.isVendorEdit = false;
    product.vendorEditedAt = undefined;
    product.adminPricingApproved = true;
    product.sellerPricingAccepted = false;
    product.approvedByAdminAt = new Date();
    product.isActive = false;

    product.markModified('adminPricing');
    product.markModified('referralCommission');

    await product.save();

    if (product.foodMenuItemId) {
      try {
        await FoodMenuItem.findByIdAndUpdate(product.foodMenuItemId, {
          platformCommissionPercent: product.adminPricing.platformFeePercent,
          platformShareAmount: product.adminPricing.platformFeeAmount,
          vendorCommissionPercent: product.adminPricing.vendorCommissionPercent,
          vendorCommissionAmount: product.adminPricing.vendorCommissionAmount,
          distributedFrom: product.adminPricing.distributedFrom,
          vendorPayoutAmount: product.adminPricing.finalSellerAmount,
          packagingCharge: adminPricing.packingCharge || 0,
          packingCharge: adminPricing.packingCharge || 0,
          shippingCharge: adminPricing.shippingCharge || 0,
          deliveryFee: adminPricing.shippingCharge || 0,
          adminPricing: product.adminPricing,
          commissionShares: product.adminPricing?.commissionShares,
          referralCommission: product.referralCommission,
          referralEarnings: product.adminPricing?.referralEarnings,
          approvalStatus: 'PENDING_RESTAURANT_ACCEPTANCE',
          adminApprovedAt: new Date(),
        });
      } catch (e) {
        console.warn('[configureAdminPricing] FoodMenuItem sync warning:', e);
      }
    }

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      success: true,
      message: 'Admin pricing saved. Waiting for seller approval.',
      product: populatedProduct,
    });
  } catch (error: any) {
    console.error('Failed to configure admin pricing error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to configure admin pricing',
      error: error.message,
    });
  }
};

export const sellerAcceptPricing = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    if (product.status !== 'Awaiting Seller Approval') {
      res.status(400).json({
        message: 'Product is not waiting for seller approval',
      });
      return;
    }

    if (!product.adminPricing) {
      res.status(400).json({
        message: 'Admin pricing is not configured',
      });
      return;
    }

    product.sellerPricingAccepted = true;
    product.status = 'Live';
    product.isActive = true;
    product.sellerAcceptedAt = new Date();
    product.liveAt = new Date();

    await product.save();

    if (product.foodMenuItemId) {
      try {
        await FoodMenuItem.findByIdAndUpdate(product.foodMenuItemId, {
          approvalStatus: 'PUBLISHED_LIVE',
          status: 'ACTIVE',
          restaurantAcceptedAt: new Date(),
        });
      } catch (e) {
        console.warn('[sellerAcceptPricing] FoodMenuItem sync warning:', e);
      }
    }

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      message: 'Pricing accepted. Product is now live.',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to accept pricing',
      error: error.message,
    });
  }
};

export const sellerNegotiatePricing = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const {
      message,
      requestedSellingPrice,
      requestedPlatformFeePercent,
      requestedShippingCharge,
      requestedPackingCharge,
    } = req.body;

    if (!message?.trim()) {
      res.status(400).json({
        message: 'Negotiation message is required',
      });
      return;
    }

    product.sellerNegotiations.push({
      message: message.trim(),
      requestedSellingPrice:
        requestedSellingPrice !== undefined
          ? normalizeNumber(requestedSellingPrice)
          : undefined,
      requestedPlatformFeePercent:
        requestedPlatformFeePercent !== undefined
          ? normalizeNumber(requestedPlatformFeePercent)
          : undefined,
      requestedShippingCharge:
        requestedShippingCharge !== undefined
          ? normalizeNumber(requestedShippingCharge)
          : undefined,
      requestedPackingCharge:
        requestedPackingCharge !== undefined
          ? normalizeNumber(requestedPackingCharge)
          : undefined,
      createdAt: new Date(),
    } as any);

    product.status = 'Negotiation Requested';
    product.sellerPricingAccepted = false;
    product.isActive = false;

    await product.save();

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      message: 'Negotiation request sent to admin',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to negotiate pricing',
      error: error.message,
    });
  }
};

export const rejectProduct = async (req: Request, res: Response) => {
  try {
    let product = await Product.findById(req.params.id);
    if (!product) {
      product = await Product.findOne({ foodMenuItemId: req.params.id });
    }

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    product.status = 'Rejected';
    product.isVendorEdit = false;
    product.preEditSnapshot = undefined;
    product.vendorEditedAt = undefined;
    product.isActive = false;
    product.adminPricingApproved = false;
    product.sellerPricingAccepted = false;
    product.rejectionReason = req.body.reason || 'Product rejected by admin';

    await product.save();

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      message: 'Product rejected',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to reject product',
      error: error.message,
    });
  }
};

export const quickApproveVendorEdit = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    if (!product.isVendorEdit && product.status !== 'Vendor Edited') {
      res.status(400).json({ message: 'Product is not a vendor edit' });
      return;
    }

    product.status = 'Live';
    product.isVendorEdit = false;
    product.preEditSnapshot = undefined;
    product.vendorEditedAt = undefined;
    product.isActive = true;
    product.adminPricingApproved = true;
    product.sellerPricingAccepted = true;
    product.approvedByAdminAt = new Date();
    product.sellerAcceptedAt = new Date();
    product.liveAt = new Date();
    product.moderationStatus = 'approved' as any;

    await product.save();

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      success: true,
      message: 'Vendor edit approved. Product is now live.',
      product: populatedProduct,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to approve vendor edit',
      error: error.message,
    });
  }
};

export const bulkApproveProducts = async (req: Request, res: Response) => {
  try {
    const { productIds, remarks } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ success: false, message: 'productIds array is required' });
      return;
    }

    const cleanIds = productIds.map((id: string) => id.replace(/^(prod_|food_)/, ''));

    // 1. Fetch products to update their adminPricing if price changed
    const products = await Product.find({ _id: { $in: cleanIds } });
    const now = new Date();

    for (const prod of products) {
      prod.status = 'Live';
      prod.isActive = true;
      prod.isVendorEdit = false;
      prod.adminPricingApproved = true;
      prod.sellerPricingAccepted = true;
      prod.moderationStatus = 'approved' as any;
      prod.approvedByAdminAt = now;
      prod.sellerAcceptedAt = now;
      prod.liveAt = now;
      prod.vendorEditedAt = undefined;
      prod.preEditSnapshot = undefined;

      // Sync admin pricing with new selling price if not yet synced
      const prodPrice = prod.baseSellingPrice || (prod as any).price || 0;
      const prodMrp = prod.baseMrp || prodPrice;

      const pool = Math.round((prodPrice * 10) / 100);
      const l1 = Math.round((pool * 10) / 100);
      const l2 = Math.round((pool * 5) / 100);
      const l3 = Math.round((pool * 2.5) / 100);
      const avg = Math.round(((l1 + l2 + l3) / 3) * 100) / 100;

      if (!prod.adminPricing) {
        prod.adminPricing = {
          mrp: prodMrp,
          sellingPrice: prodPrice,
          platformFeePercent: 25,
          platformFeeAmount: pool,
          vendorCommissionPercent: 0,
          vendorCommissionAmount: 0,
          distributedFrom: 'platform_fee',
          distributionPool: pool,
          finalSellerAmount: prodPrice,
          shippingCharge: 0,
          packingCharge: 0,
          remarks: remarks || 'Bulk Approved by Admin',
          commissionShares: [],
          referralEarnings: {
            level1: l1,
            level2: l2,
            level3: l3,
            average: avg,
            total: l1 + l2 + l3,
          },
          averageReferralEarning: avg,
          estimatedEarning: l1,
        };
      } else {
        // If price was modified by vendor, sync sellingPrice in adminPricing
        if (prodPrice && prod.adminPricing.sellingPrice !== prodPrice) {
          prod.adminPricing.sellingPrice = prodPrice;
          prod.adminPricing.mrp = Math.max(prod.adminPricing.mrp || 0, prodMrp);
          const pFee = prod.adminPricing.platformFeePercent !== undefined && prod.adminPricing.platformFeePercent !== null ? prod.adminPricing.platformFeePercent : 25;
          const currentPool = Math.round((prodPrice * pFee) / 100);
          prod.adminPricing.platformFeeAmount = currentPool;
          prod.adminPricing.distributionPool = currentPool;
          const curL1 = Math.round((currentPool * 10) / 100);
          const curL2 = Math.round((currentPool * 5) / 100);
          const curL3 = Math.round((currentPool * 2.5) / 100);
          const curAvg = Math.round(((curL1 + curL2 + curL3) / 3) * 100) / 100;
          prod.adminPricing.referralEarnings = {
            level1: curL1,
            level2: curL2,
            level3: curL3,
            average: curAvg,
            total: curL1 + curL2 + curL3,
          };
          prod.adminPricing.averageReferralEarning = curAvg;
          prod.adminPricing.estimatedEarning = curL1;
        }
      }

      await prod.save();
    }

    // 2. Also update FoodMenuItem if any food items are passed
    try {
      await FoodMenuItem.updateMany(
        { _id: { $in: cleanIds } },
        {
          $set: {
            approvalStatus: 'PUBLISHED_LIVE',
            isAvailable: true,
            approvedAt: now
          }
        }
      );
    } catch (err: any) {
      console.warn('Bulk food item approval note:', err.message);
    }

    res.json({
      success: true,
      message: `Successfully approved ${cleanIds.length} products to Live status.`,
      count: cleanIds.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to bulk approve products',
      error: error.message
    });
  }
};

export const bulkRejectProducts = async (req: Request, res: Response) => {
  try {
    const { productIds, reason } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ success: false, message: 'productIds array is required' });
      return;
    }

    const cleanIds = productIds.map((id: string) => id.replace(/^(prod_|food_)/, ''));

    await Product.updateMany(
      { _id: { $in: cleanIds } },
      {
        $set: {
          status: 'Rejected',
          isActive: false,
          moderationStatus: 'rejected_by_admin',
          rejectionReason: reason || 'Rejected by Admin in Bulk Review'
        }
      }
    );

    try {
      await FoodMenuItem.updateMany(
        { _id: { $in: cleanIds } },
        {
          $set: {
            approvalStatus: 'REJECTED_BY_ADMIN',
            rejectionReason: reason || 'Rejected by Admin'
          }
        }
      );
    } catch (err: any) { }

    res.json({
      success: true,
      message: `Successfully rejected ${cleanIds.length} products.`,
      count: cleanIds.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to bulk reject products',
      error: error.message
    });
  }
};

export const bulkDeleteProducts = async (req: Request, res: Response) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ success: false, message: 'productIds array is required' });
      return;
    }

    const cleanIds = productIds
      .map((id: string) => (id ? String(id).replace(/^(prod_|food_)/, '') : ''))
      .filter((id: string) => mongoose.Types.ObjectId.isValid(id));

    if (cleanIds.length === 0) {
      res.status(400).json({ success: false, message: 'No valid IDs provided' });
      return;
    }

    // Find all products to identify any linked foodMenuItemIds
    const products = await Product.find({ _id: { $in: cleanIds } });
    const linkedFoodIds = products
      .map((p) => p.foodMenuItemId)
      .filter(Boolean)
      .map((id) => String(id));

    const allFoodIdsToDelete = Array.from(new Set([...cleanIds, ...linkedFoodIds]));

    // 1. Delete from Product collection
    await Product.deleteMany({
      $or: [
        { _id: { $in: cleanIds } },
        { foodMenuItemId: { $in: allFoodIdsToDelete } }
      ]
    });

    // 2. Delete from FoodMenuItem collection
    await FoodMenuItem.deleteMany({ _id: { $in: allFoodIdsToDelete } });
    try {
      if (mongoose.models.FoodVariant) {
        await mongoose.models.FoodVariant.deleteMany({ menuItemId: { $in: allFoodIdsToDelete } });
      }
    } catch (_) {}
    try {
      if (mongoose.models.FoodMenuItemAddonGroup) {
        await mongoose.models.FoodMenuItemAddonGroup.deleteMany({ menuItemId: { $in: allFoodIdsToDelete } });
      }
    } catch (_) {}

    // 3. Remove associated StoreProduct & Inventory
    try {
      const StoreProductModel = mongoose.model('StoreProduct');
      await StoreProductModel.deleteMany({ productId: { $in: cleanIds } });
    } catch (_) {}

    try {
      const InventoryModel = mongoose.model('Inventory');
      await InventoryModel.deleteMany({ productId: { $in: cleanIds } });
    } catch (_) {}

    res.json({
      success: true,
      message: `Successfully deleted ${cleanIds.length} products from the database permanently`,
      count: cleanIds.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to bulk delete products',
      error: error.message
    });
  }
};

export const bulkUpdateProducts = async (req: Request, res: Response) => {
  try {
    const { productIds, updateData } = req.body;

    if (!productIds?.length) {
      res.status(400).json({ message: 'Product ids are required' });
      return;
    }

    const safeUpdateData = { ...updateData };

    delete safeUpdateData._id;
    delete safeUpdateData.sellerId;
    delete safeUpdateData.slug;
    delete safeUpdateData.sku;

    await Product.updateMany(
      { _id: { $in: productIds } },
      { $set: safeUpdateData }
    );

    res.json({
      message: 'Products updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to bulk update products',
      error: error.message,
    });
  }
};

export const getProductsByVendor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { vendorId } = req.params;

    // Collect all possible ObjectIds for vendor (_id, userId)
    const vendorObjectIds: any[] = [];
    if (mongoose.Types.ObjectId.isValid(vendorId)) {
      vendorObjectIds.push(new mongoose.Types.ObjectId(vendorId));
    }

    const vendor = await Vendor.findOne(
      mongoose.Types.ObjectId.isValid(vendorId)
        ? { $or: [{ _id: vendorId }, { userId: vendorId }] }
        : { userId: vendorId }
    );
    if (vendor) {
      if (vendor._id && !vendorObjectIds.some(id => id.toString() === vendor._id.toString())) {
        vendorObjectIds.push(vendor._id);
      }
      if (vendor.userId && !vendorObjectIds.some(id => id.toString() === vendor.userId.toString())) {
        vendorObjectIds.push(vendor.userId);
      }
    }

    // Collect all possible restaurant IDs for this vendor / business ID
    const restaurantObjectIds: any[] = [];
    const restaurantQuery: any[] = [];
    if (mongoose.Types.ObjectId.isValid(vendorId)) {
      restaurantQuery.push(
        { _id: vendorId },
        { userId: vendorId },
        { vendorId: vendorId },
        { storeId: vendorId }
      );
    }
    for (const vId of vendorObjectIds) {
      restaurantQuery.push(
        { _id: vId },
        { userId: vId },
        { vendorId: vId },
        { storeId: vId }
      );
    }

    const restaurants = await RestaurantProfile.find({ $or: restaurantQuery });
    for (const r of restaurants) {
      if (r._id && !restaurantObjectIds.some(id => id.toString() === r._id.toString())) {
        restaurantObjectIds.push(r._id);
      }
      if (r.userId && !vendorObjectIds.some(id => id.toString() === r.userId.toString())) {
        vendorObjectIds.push(r.userId);
      }
      if (r.vendorId && !vendorObjectIds.some(id => id.toString() === r.vendorId.toString())) {
        vendorObjectIds.push(r.vendorId);
      }
      if (r.storeId && !vendorObjectIds.some(id => id.toString() === r.storeId.toString())) {
        vendorObjectIds.push(r.storeId);
      }
    }
    if (mongoose.Types.ObjectId.isValid(vendorId) && !restaurantObjectIds.some(id => id.toString() === vendorId.toString())) {
      restaurantObjectIds.push(new mongoose.Types.ObjectId(vendorId));
    }

    // Query standard products belonging to this vendor
    const products = await Product.find({
      $or: [
        { sellerId: { $in: vendorObjectIds } },
        { createdBy: { $in: vendorObjectIds } },
        { vendorId: { $in: vendorObjectIds } }
      ],
      status: { $nin: ['archived', 'Archived', 'draft', 'Draft', 'rejected', 'Rejected'] },
      isActive: { $ne: false }
    })
      .populate('categoryId', 'name')
      .populate('subCategoryId', 'name');

    const formattedProducts = products.map((p: any) => {
      const pObj = p.toObject ? p.toObject() : p;
      const shipCharge = pObj.adminPricing?.shippingCharge ?? pObj.shippingCharge ?? pObj.deliveryFee ?? 0;
      const packCharge = pObj.adminPricing?.packingCharge ?? pObj.packingCharge ?? pObj.packagingCharge ?? 0;
      return {
        _id: pObj._id,
        vendorId: pObj.sellerId || vendorId,
        itemName: pObj.name,
        name: pObj.name,
        images: pObj.images && pObj.images.length > 0 ? pObj.images : [pObj.thumbnail].filter(Boolean),
        afterDiscount: pObj.baseSellingPrice || pObj.baseMrp || 0,
        userPrice: pObj.baseMrp || pObj.baseSellingPrice || 0,
        baseSellingPrice: pObj.baseSellingPrice || pObj.baseMrp || 0,
        baseMrp: pObj.baseMrp || pObj.baseSellingPrice || 0,
        adminPricing: pObj.adminPricing ? {
          ...pObj.adminPricing,
          shippingCharge: shipCharge,
          packingCharge: packCharge,
          mrp: pObj.baseMrp || pObj.adminPricing.mrp || 0,
          sellingPrice: pObj.baseSellingPrice || pObj.adminPricing.sellingPrice || 0,
          commissionShares: pObj.adminPricing.commissionShares || [],
          referralCommission: pObj.referralCommission || pObj.adminPricing.referralCommission,
        } : {
          shippingCharge: shipCharge,
          packingCharge: packCharge,
          mrp: pObj.baseMrp || 0,
          sellingPrice: pObj.baseSellingPrice || 0,
        },
        referralCommission: pObj.referralCommission,
        shippingCharge: shipCharge,
        packingCharge: packCharge,
        deliveryFee: shipCharge,
        packagingCharge: packCharge,
        category: pObj.categoryId ? {
          _id: pObj.categoryId._id || pObj.categoryId,
          name: pObj.categoryId.name || 'Category'
        } : undefined,
        subcategory: pObj.subCategoryId?.name || pObj.subcategory || '',
        status: pObj.status,
        isSubscriptionAvailable: !!pObj.isSubscriptionAvailable,
        isPreOrder: !!pObj.isPreOrder,
        preOrderReleaseDate: pObj.preOrderReleaseDate || null,
        preOrderMessage: pObj.preOrderMessage || '',
        brand: pObj.brand || 'Fresh & Local',
      };
    });

    // Also query FoodMenuItem if restaurant or food business exists
    let formattedFoodItems: any[] = [];
    if (restaurantObjectIds.length > 0 || vendorObjectIds.length > 0) {
      const foodItems = await FoodMenuItem.find({
        $or: [
          { restaurantId: { $in: restaurantObjectIds } },
          { restaurantId: { $in: vendorObjectIds } }
        ],
        status: { $nin: ['ARCHIVED', 'DRAFT'] },
        soldOut: { $ne: true }
      }).populate('categoryId', 'name');

      formattedFoodItems = foodItems.map((item: any) => {
        const iObj = item.toObject ? item.toObject() : item;
        const effectivePrice = iObj.offerPrice && iObj.offerPrice > 0 ? iObj.offerPrice : (iObj.basePrice || 0);
        const itemImage = iObj.image || iObj.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60';
        const packCharge = iObj.packagingCharge || iObj.packingCharge || 0;
        const shipCharge = iObj.shippingCharge || iObj.deliveryFee || 0;
        return {
          _id: iObj._id,
          vendorId: vendorId,
          itemName: iObj.name,
          name: iObj.name,
          images: [itemImage],
          thumbnail: itemImage,
          afterDiscount: effectivePrice,
          userPrice: iObj.basePrice || effectivePrice,
          baseSellingPrice: effectivePrice,
          baseMrp: iObj.basePrice || effectivePrice,
          adminPricing: {
            ...(iObj.adminPricing || {}),
            shippingCharge: shipCharge,
            packingCharge: packCharge,
            mrp: iObj.basePrice || effectivePrice,
            sellingPrice: effectivePrice,
            commissionShares: iObj.adminPricing?.commissionShares || iObj.commissionShares || [],
            referralCommission: iObj.adminPricing?.referralCommission || iObj.referralCommission,
            referralEarnings: iObj.adminPricing?.referralEarnings || iObj.referralEarnings,
            estimatedEarning: iObj.adminPricing?.estimatedEarning || iObj.estimatedEarning,
          },
          commissionShares: iObj.adminPricing?.commissionShares || iObj.commissionShares || [],
          referralCommission: iObj.adminPricing?.referralCommission || iObj.referralCommission,
          shippingCharge: shipCharge,
          packingCharge: packCharge,
          deliveryFee: shipCharge,
          packagingCharge: packCharge,
          category: {
            _id: iObj.categoryId?._id ? iObj.categoryId._id.toString() : (iObj.categoryId ? iObj.categoryId.toString() : 'food-cat'),
            name: iObj.categoryId?.name || iObj.cuisine || 'Food & Dining'
          },
          subcategory: iObj.cuisine || iObj.categoryId?.name || (iObj.foodType === 'VEG' ? 'Pure Veg' : 'Non-Veg'),
          status: iObj.status === 'ACTIVE' ? 'Live' : (iObj.status || 'Live'),
          isSubscriptionAvailable: false,
          isPreOrder: !!iObj.isPreOrder,
          preOrderReleaseDate: iObj.preOrderReleaseDate || null,
          preOrderMessage: iObj.preOrderMessage || '',
          brand: iObj.cuisine || 'Fresh & Hot',
          ratings: 4.8,
          rating: 4.8,
          foodType: iObj.foodType,
          isVeg: iObj.foodType === 'VEG',
          description: iObj.description || ''
        };
      });
    }

    res.status(200).json({
      success: true,
      data: [...formattedProducts, ...formattedFoodItems]
    });
  } catch (error: any) {
    console.error('Error fetching products by vendor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vendor products',
      error: error.message
    });
  }
};

export const duplicateProduct = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const authUser = (req as any).user;
    const isOwner = authUser && String(product.sellerId) === String(authUser.id);
    const isAdmin = authUser && authUser.roles?.includes('admin');

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Forbidden: ownership mismatch' });
      return;
    }

    const baseName = `${product.name} - Copy`;
    const newSlug = await makeUniqueSlug(baseName);
    const newSku = `DUP-${product.sku.substring(0, 5)}-${Date.now().toString().slice(-4)}`;

    const duplicatedProduct = new Product({
      sellerId: product.sellerId,
      sellerType: product.sellerType,
      name: baseName,
      slug: newSlug,
      description: product.description,
      categoryId: product.categoryId,
      subCategoryId: product.subCategoryId,
      childCategoryId: product.childCategoryId,
      brand: product.brand,
      sku: newSku,
      thumbnail: product.thumbnail,
      images: product.images,
      attributes: product.attributes,
      variants: product.variants,
      baseMrp: product.baseMrp,
      discountPercent: product.discountPercent,
      baseSellingPrice: product.baseSellingPrice,
      stock: product.stock,
      status: 'Draft',
      isActive: false,
      isStoreProduct: product.isStoreProduct,
      isSubscriptionAvailable: product.isSubscriptionAvailable,
      isPreOrder: product.isPreOrder,
      preOrderReleaseDate: product.preOrderReleaseDate,
      preOrderMessage: product.preOrderMessage,
      preOrderLimit: product.preOrderLimit,
      badges: product.badges
    });

    await duplicatedProduct.save();
    const populated = await populateProduct(Product.findById(duplicatedProduct._id));

    res.status(201).json({
      message: 'Product duplicated successfully',
      product: populated
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to duplicate product',
      error: error.message
    });
  }
};

export const archiveProduct = async (req: Request, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid ID format' });
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const authUser = (req as any).user;
    const isOwner = authUser && String(product.sellerId) === String(authUser.id);
    const isAdmin = authUser && authUser.roles?.includes('admin');

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Forbidden: ownership mismatch' });
      return;
    }

    product.isArchived = true;
    product.isActive = false; // Disable listing immediately
    product.status = 'Draft';

    await product.save();

    res.json({
      message: 'Product archived successfully',
      product
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to archive product',
      error: error.message
    });
  }
};

export const toggleProductStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ success: false, message: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found' });
      return;
    }

    const authUser = (req as any).user;
    const vendor = await Vendor.findOne({ $or: [{ userId: authUser.id }, { _id: authUser.id }] });
    const vendorIds = [
      authUser.id?.toString(),
      authUser._id?.toString(),
      vendor?._id?.toString(),
      vendor?.userId?.toString()
    ].filter(Boolean);

    const isOwner = vendorIds.includes(product.sellerId?.toString()) ||
      vendorIds.includes(product.createdBy?.toString());
    const isAdmin = authUser.roles?.includes('admin');

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, message: 'Not authorized to change this product status' });
      return;
    }

    // Determine target active state
    let targetActive: boolean;
    if (typeof req.body.isActive === 'boolean') {
      targetActive = req.body.isActive;
    } else if (typeof req.body.status === 'string') {
      targetActive = ['live', 'active', 'on', 'approved'].includes(req.body.status.toLowerCase());
    } else {
      targetActive = !product.isActive;
    }

    if (!targetActive) {
      // Vendor switched OFF product
      product.isActive = false;
      product.status = 'Inactive';
    } else {
      // Vendor switched ON product - verify admin and seller approvals
      if (product.moderationStatus === 'rejected' || product.status === 'Rejected') {
        res.status(400).json({
          success: false,
          message: 'Cannot activate a rejected product. Please edit and submit for review.'
        });
        return;
      }

      if (!isAdmin) {
        if (product.status === 'Awaiting Seller Approval') {
          res.status(400).json({
            success: false,
            message: 'Please review and accept Admin pricing first before turning Store Status ON.'
          });
          return;
        }

        const isApprovedByBoth = product.status === 'Live' || product.status === 'Inactive' || product.sellerPricingAccepted || (product.adminPricingApproved && product.status === 'Approved');
        if (!isApprovedByBoth) {
          res.status(400).json({
            success: false,
            message: 'Product must be approved by Admin and accepted by Vendor before enabling Store Status (ON/OFF).'
          });
          return;
        }
      }

      product.isActive = true;
      product.status = 'Live';
    }

    await product.save();

    const populatedProduct = await populateProduct(Product.findById(product._id));

    res.json({
      success: true,
      message: targetActive
        ? 'Product is now Online & visible in ApexBee store'
        : 'Product is now Turned OFF & hidden from users',
      product: populatedProduct || product,
      isActive: product.isActive,
      status: product.status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update product status',
      error: error.message
    });
  }
};

export const getAiProductSuggestions = async (req: Request, res: Response) => {
  try {
    const { name, categoryId, categoryName: inputCategoryName, subCategoryName } = req.body;

    let categoryName = inputCategoryName || 'Premium Quality Product';
    if (!inputCategoryName && categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
      const cat = await Category.findById(categoryId);
      if (cat) categoryName = cat.name;
    }

    const rawName = name && name.trim().length > 0 ? name.trim() : (subCategoryName || categoryName || 'Fresh Item');
    const formattedTitle = rawName.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    const suggestedTitle = formattedTitle.includes('Fresh') || formattedTitle.includes('Premium')
      ? formattedTitle
      : `${formattedTitle} - Fresh & Premium Grade`;

    const desc = `Experience the finest quality ${formattedTitle}. Sourced directly from verified local suppliers and farmers, processed under strict hygiene conditions to preserve natural taste, texture, and freshness. Cleaned, graded, and securely packaged. Ideal for everyday household consumption and commercial catering needs.`;
    const teluguDesc = `అత్యుత్తమ నాణ్యత కలిగిన ${formattedTitle}, నేరుగా స్థానిక రైతులు మరియు సరఫరాదారుల నుండి సేకరించబడినది. ఎలాంటి రసాయనాలు లేకుండా పరిశుభ్రంగా ప్యాక్ చేయబడింది.`;

    const features = [
      `100% Authentic & Naturally Sourced`,
      `Quality tested under strict platform criteria`,
      `Hygienically sealed to lock in natural freshness`,
      `Direct local sourcing supporting regional sellers`
    ];

    const keywords = [
      formattedTitle.toLowerCase(),
      `fresh ${formattedTitle.toLowerCase()}`,
      `buy ${formattedTitle.toLowerCase()} online`,
      `best ${formattedTitle.toLowerCase()} price`,
      `${categoryName.toLowerCase()} online delivery`,
      'apexbee local'
    ].join(', ');

    res.json({
      success: true,
      data: {
        title: suggestedTitle,
        description: desc,
        teluguDescription: `${teluguDesc}\n\nEnglish: ${desc}`,
        features,
        keywords
      }
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to generate AI product suggestions',
      error: error.message
    });
  }
};

export const getInventoryMovements = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = (req as any).user;
    if (!authUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const sellerId = authUser.roles?.includes('admin') ? req.query.sellerId : authUser.id;
    if (!sellerId) {
      res.status(400).json({ message: 'Seller ID is required' });
      return;
    }

    const InventoryMovement = mongoose.model('InventoryMovement');
    const movements = await InventoryMovement.find({ sellerId })
      .populate('productId', 'name sku')
      .sort({ createdAt: -1 });

    res.json({ success: true, movements });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInventoryMovement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, quantityChanged, type, reason, batchNo } = req.body;
    const authUser = (req as any).user;

    if (!productId || quantityChanged === undefined || !type) {
      res.status(400).json({ message: 'productId, quantityChanged, and type are required' });
      return;
    }

    const sellerId = authUser.id;

    // Save movement audit
    const InventoryMovement = mongoose.model('InventoryMovement');
    const movement = new InventoryMovement({
      productId,
      sellerId,
      quantityChanged,
      type,
      reason: reason || 'Manual adjustment',
      batchNo: batchNo || 'N/A'
    });
    await movement.save();

    // Adjust product stock in DB
    const Product = mongoose.model('Product');
    const product = await Product.findById(productId);
    if (product) {
      const stockChange = Number(quantityChanged);
      product.stock = Math.max(0, product.stock + stockChange);
      await product.save();
    }

    res.status(201).json({ success: true, movement });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductBySku = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku } = req.params;
    const product = await Product.findOne({ sku });
    if (!product) {
      res.status(404).json({ success: false, message: 'Product not found with specified SKU/barcode.' });
      return;
    }
    res.status(200).json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBuyAgainProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    let authUser = (req as any).user;
    if (!authUser && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'supersecretjwtkeyforapexbeebusinessoperatingnetwork'
        ) as any;
        if (decoded && (decoded.id || decoded._id)) {
          authUser = decoded;
        }
      } catch (e) {
        // Invalid or expired token
      }
    }

    // If user is not authenticated, strictly return empty array (do NOT return fallback products)
    if (!authUser) {
      res.status(200).json({ success: true, products: [] });
      return;
    }

    const userId = authUser.id || authUser._id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
    const userQueryIds: any[] = [userId, ...(userObjectId ? [userObjectId] : [])];

    // Find past completed orders for this customer
    const pastOrders = await Order.find({
      $or: [
        { customerId: { $in: userQueryIds } },
        { user: { $in: userQueryIds } },
        { userId: { $in: userQueryIds } }
      ],
      orderStatus: { $nin: ['cancelled', 'Cancelled', 'pending_payment', 'Failed', 'Payment Rejected'] }
    }).sort({ createdAt: -1 });

    // Collect product IDs in order of recent purchases
    const productIds = new Set<string>();
    pastOrders.forEach((order: any) => {
      (order.items || []).forEach((item: any) => {
        if (item.productId) {
          const pid = (item.productId._id || item.productId).toString();
          productIds.add(pid);
        }
      });
    });

    const idsArray = Array.from(productIds);
    // If user has not purchased any products, strictly return empty array (never fallback to random products)
    if (idsArray.length === 0) {
      res.status(200).json({ success: true, products: [] });
      return;
    }

    const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;
    const pincode = req.query.pincode ? String(req.query.pincode).trim() : '';

    // Fetch the product documents that the user actually purchased
    const rawProducts = await Product.find({
      _id: { $in: idsArray },
      isActive: true,
      status: { $in: ['Live', 'Active', 'Approved', 'approved', 'active', 'published'] },
      isArchived: { $ne: true }
    });

    if (rawProducts.length === 0) {
      res.status(200).json({ success: true, products: [] });
      return;
    }

    const sellerIds = rawProducts.map((p: any) => p.sellerId?._id || p.sellerId).filter(Boolean);
    const vendors = await Vendor.find({ $or: [{ userId: { $in: sellerIds } }, { _id: { $in: sellerIds } }] });
    const vendorMap = new Map();
    vendors.forEach((v: any) => {
      if (v.userId) vendorMap.set(v.userId.toString(), v);
      if (v._id) vendorMap.set(v._id.toString(), v);
    });

    // Filter out local products from other pincodes where vendor cannot service customer location
    const filteredProducts = rawProducts.filter((p: any) => {
      const isPan = p.isPanIndia === true || p.deliveryScope === 'pan_india' || p.deliveryScope === 'both' || p.isGlobalDelivery === true;
      // Pan-India products deliver everywhere
      if (isPan) return true;

      // If customer has not provided location/pincode, allow
      if (!pincode && (!lat || !lng)) return true;

      const sellerIdStr = (p.sellerId?._id || p.sellerId || '').toString();
      const vendor = vendorMap.get(sellerIdStr);
      const vendorPin = String(vendor?.pincode || vendor?.pinCode || p.vendorPincode || p.sellerId?.pincode || '').trim();

      // Check distance if coordinate data is present
      if (lat && lng && vendor?.location?.coordinates) {
        const vLng = vendor.location.coordinates[0];
        const vLat = vendor.location.coordinates[1];
        if (typeof vLng === 'number' && typeof vLat === 'number' && vLat !== 0 && vLng !== 0) {
          const dist = calculateDistance(lat, lng, vLat, vLng);
          const maxRadius = vendor.deliveryRadiusKm || 20;
          if (dist <= maxRadius) return true;
        }
      }

      // Check matching pincode or serviceable pincodes list
      if (pincode) {
        if (vendorPin && vendorPin === pincode) return true;
        if (vendor?.serviceablePincodes && Array.isArray(vendor.serviceablePincodes) && vendor.serviceablePincodes.includes(pincode)) {
          return true;
        }
      }

      // Local product from another pincode/out-of-range vendor -> exclude from Buy Again in this pincode
      return false;
    });

    const mappedProducts = filteredProducts.map((p: any) => {
      const productObj = p.toObject ? p.toObject() : p;
      const sellerIdStr = (p.sellerId?._id || p.sellerId || '').toString();
      const vendor = vendorMap.get(sellerIdStr);

      let distance = 1.2;
      let duration = 10;
      let shippingCharge = 0;

      if (lat && lng && vendor?.location?.coordinates) {
        const vLng = vendor.location.coordinates[0];
        const vLat = vendor.location.coordinates[1];
        if (typeof vLng === 'number' && typeof vLat === 'number') {
          distance = calculateDistance(lat, lng, vLat, vLng);
          duration = Math.max(10, Math.round(10 + distance * 2.5));
          shippingCharge = distance > 3 ? Math.round(distance * 8) : 0;
        }
      } else if (pincode && vendor?.pincode) {
        if (vendor.pincode === pincode) {
          distance = 1.5;
          duration = 12;
          shippingCharge = 0;
        } else {
          distance = 4.8;
          duration = 25;
          shippingCharge = 15;
        }
      }

      if (!productObj.adminPricing) {
        productObj.adminPricing = {};
      }

      productObj.adminPricing.shippingCharge = shippingCharge;
      productObj.calculatedDistanceKm = parseFloat(distance.toFixed(1));
      productObj.estimatedDeliveryMinutes = duration;
      productObj.deliveryMode = vendor?.deliveryMode || 'self_delivery';
      productObj.brand = vendor?.businessName || productObj.brand || 'ApexBee Seller';
      productObj.vendorRating = 4.8;

      return productObj;
    });

    // Preserve the order of recent purchases
    const productsMap = new Map(mappedProducts.map(p => [p._id.toString(), p]));
    const orderedProducts = idsArray
      .map(id => productsMap.get(id))
      .filter(Boolean);

    res.status(200).json({ success: true, products: orderedProducts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const seedProductsForAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find({});
    if (!categories || categories.length === 0) {
      return res.status(400).json({ success: false, message: 'No categories found in database to seed.' });
    }

    const VendorModel = mongoose.model('Vendor');
    const StoreProductModel = mongoose.model('StoreProduct');
    const InventoryModel = mongoose.model('Inventory');
    const CategoryProductSchemaModel = mongoose.models.CategoryProductSchema || mongoose.model('CategoryProductSchema');

    // Find default vendor or admin seller
    let vendor = await VendorModel.findOne({ status: 'active' });
    if (!vendor) {
      vendor = await VendorModel.findOne({});
    }
    const sellerId = vendor ? (vendor.userId || vendor._id) : new mongoose.Types.ObjectId();
    const storeId = vendor ? vendor._id.toString() : sellerId.toString();

    let createdCount = 0;
    const details: any[] = [];

    for (const cat of categories) {
      let catId: any = cat._id;
      let subCatId: any = null;
      let childCatId: any = null;

      if (cat.level === 1) {
        catId = cat._id;
      } else if (cat.level === 2) {
        subCatId = cat._id;
        catId = cat.parentId || cat._id;
      } else if (cat.level === 3) {
        childCatId = cat._id;
        subCatId = cat.parentId;
        if (subCatId) {
          const parentSub = await Category.findById(subCatId);
          if (parentSub) catId = parentSub.parentId || catId;
        }
      }

      // Fetch schema attributes for this category
      let schemaDoc = await CategoryProductSchemaModel.findOne({ categoryId: cat._id });
      if (!schemaDoc && subCatId) {
        schemaDoc = await CategoryProductSchemaModel.findOne({ categoryId: subCatId });
      }

      const sampleAttributes: Record<string, any> = {};
      if (schemaDoc && Array.isArray(schemaDoc.attributes)) {
        schemaDoc.attributes.forEach((attr: any) => {
          if (attr.isDisabled) return;
          if (attr.type === 'select' && Array.isArray(attr.options) && attr.options.length > 0) {
            sampleAttributes[attr.key] = attr.options[0];
          } else if (attr.type === 'multiselect' && Array.isArray(attr.options) && attr.options.length > 0) {
            sampleAttributes[attr.key] = [attr.options[0]];
          } else if (attr.type === 'number') {
            sampleAttributes[attr.key] = attr.minValue || 10;
          } else if (attr.type === 'boolean') {
            sampleAttributes[attr.key] = true;
          } else {
            sampleAttributes[attr.key] = `Sample ${attr.name || attr.key}`;
          }
        });
      }

      const productName = `Premium ${cat.name}`;
      const cleanCatName = cat.name.replace(/[^a-zA-Z0-9]/g, '');
      const sku = `SEED-${(cleanCatName.substring(0, 4) || 'ITEM').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Create Product
      const product = await Product.create({
        name: productName,
        slug: `seed-${makeSlug(cat.name)}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        description: `High quality ${cat.name} with verified category specifications and complete attributes.`,
        categoryId: catId,
        subCategoryId: subCatId,
        subcategoryId: subCatId,
        childCategoryId: childCatId,
        createdBy: sellerId,
        sellerId: sellerId,
        sellerType: 'vendor',
        brand: 'ApexBee Prime',
        sku,
        thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
        images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80'],
        attributes: sampleAttributes,
        variants: [],
        baseMrp: 499,
        discountPercent: 10,
        baseSellingPrice: 449,
        stock: 100,
        status: 'Live',
        isActive: true,
        moderationStatus: 'approved',
        adminPricingApproved: true,
        sellerPricingAccepted: true,
        liveAt: new Date(),
        isStoreProduct: true,
      });

      // Create StoreProduct
      await StoreProductModel.create({
        storeId,
        productId: product._id,
        mrp: 499,
        sellingPrice: 449,
        minimumOrderQuantity: 1,
        preparationTimeMinutes: 15,
        isActive: true,
      });

      // Create Inventory
      await InventoryModel.create({
        storeId,
        productId: product._id,
        availableStock: 100,
        reservedStock: 0,
        damagedStock: 0,
        lowStockThreshold: 5,
      });

      createdCount++;
      details.push({
        categoryName: cat.name,
        level: cat.level,
        productId: product._id,
        sku: product.sku,
        attributesSeeded: Object.keys(sampleAttributes),
      });
    }

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${createdCount} products across all categories (Level 1, Subcategories & Child Categories)!`,
      createdCount,
      details,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to seed category products', error: error.message });
  }
};

export const removeSeededProducts = async (req: Request, res: Response) => {
  try {
    const { deleteAll, all } = req.query;

    let filter: any = {
      $or: [
        { sku: /^SEED-/i },
        { sku: /^DEMO-SEED-/i },
        { slug: /^seed-/i },
        { brand: 'ApexBee Prime' },
        { name: /^Premium /i }
      ]
    };

    if (deleteAll === 'true' || all === 'true') {
      filter = {};
    }

    const seededProducts = await Product.find(filter).select('_id');
    const productIds = seededProducts.map((p) => p._id);

    if (productIds.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No seeded products found to remove.',
        removedCount: 0
      });
    }

    const prodRes = await Product.deleteMany({ _id: { $in: productIds } });

    const StoreProductModel = mongoose.models.StoreProduct;
    if (StoreProductModel) {
      await StoreProductModel.deleteMany({ productId: { $in: productIds } });
    }

    const InventoryModel = mongoose.models.Inventory;
    if (InventoryModel) {
      await InventoryModel.deleteMany({ productId: { $in: productIds } });
    }

    const ProductVariantModel = mongoose.models.ProductVariant;
    if (ProductVariantModel) {
      await ProductVariantModel.deleteMany({ productId: { $in: productIds } });
    }

    const SearchDocumentModel = mongoose.models.SearchDocument;
    if (SearchDocumentModel) {
      await SearchDocumentModel.deleteMany({ entityId: { $in: productIds } });
    }

    res.status(200).json({
      success: true,
      message: `Successfully removed ${prodRes.deletedCount} seeded products and associated records.`,
      removedCount: prodRes.deletedCount
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove seeded products',
      error: error.message
    });
  }
};

/**
 * Task USER - 12: Dynamic Open Graph (OG) & Social Sharing Preview Endpoint
 * Generates crawler-accessible HTML with og:title, og:description, og:image, og:url, og:type
 * Preserves referral parameters (?ref=) and supports WhatsApp/Facebook/Twitterbot/Telegram crawlers.
 */
export const getProductSocialSharePreview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ref = (req.query.ref as string) || (req.query.referral as string) || '';
    const userAgent = (req.headers['user-agent'] as string) || '';

    // Detect social crawlers
    const isCrawler = /facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Pinterest|Discordbot|SkypeUriPreview|Googlebot|bingbot|crawler|spider|bot/i.test(
      userAgent
    );

    // Configurable base URLs
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://apexbee.in';
    const SERVER_URL = process.env.SERVER_URL || 'https://server.apexbee.in';
    const DEFAULT_LOGO = `${SERVER_URL}/uploads/logo.png`;

    // Query product
    let product: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id).populate('categoryId', 'name').lean();
    } else {
      product = await Product.findOne({ $or: [{ slug: id }, { sku: id }] }).populate('categoryId', 'name').lean();
    }

    // Default fallback values
    let ogTitle = 'ApexBee — Hyperlocal Shopping, Services & App Portal';
    let ogDescription = 'Shop fashion, groceries, electronics, book doorstep services, discover local stores, and earn with ApexBee.';
    let ogImage = DEFAULT_LOGO;
    let price = 0;
    let mrp = 0;
    let canonicalUrl = `${FRONTEND_URL}/product/${id}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;

    if (product) {
      const name = product.name || product.itemName || 'Quality Product';
      price = Number(
        product.adminPricing?.customerSellingAmount ??
        product.adminPricing?.sellingPrice ??
        product.baseSellingPrice ??
        product.salesPrice ??
        product.sellingPrice ??
        product.price ??
        0
      );
      mrp = Number(product.baseMrp ?? product.userPrice ?? product.mrp ?? price);

      ogTitle = `${name} | ApexBee`;

      // Clean description
      let rawDesc = (product.description || '').replace(/<[^>]*>?/gm, '').trim();
      if (!rawDesc) {
        rawDesc = `Explore ${name} on ApexBee. High quality, verified seller, guaranteed genuine product.`;
      }
      if (rawDesc.length > 180) {
        rawDesc = `${rawDesc.substring(0, 177)}...`;
      }

      const formattedPrice = price > 0 ? `₹${price.toLocaleString('en-IN')}` : '';
      const priceText = formattedPrice ? ` — Buy now for ${formattedPrice}!` : '';
      ogDescription = `${rawDesc}${priceText}`;

      // Resolve absolute public image URL
      let candidateImg = '';
      if (Array.isArray(product.images) && product.images.length > 0 && product.images[0]) {
        candidateImg = typeof product.images[0] === 'string' ? product.images[0] : (product.images[0].url || product.images[0].secure_url || '');
      } else if (product.thumbnail) {
        candidateImg = product.thumbnail;
      } else if (product.image) {
        candidateImg = product.image;
      }

      if (candidateImg) {
        if (candidateImg.startsWith('http://') || candidateImg.startsWith('https://')) {
          ogImage = candidateImg;
        } else {
          ogImage = `${SERVER_URL}${candidateImg.startsWith('/') ? '' : '/'}${candidateImg}`;
        }
      }

      canonicalUrl = `${FRONTEND_URL}/product/${product._id || id}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
    }

    // HTML escape helper
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const safeTitle = escapeHtml(ogTitle);
    const safeDesc = escapeHtml(ogDescription);
    const safeImg = escapeHtml(ogImage);
    const safeUrl = escapeHtml(canonicalUrl);

    // If human browser (not crawler) and not forcing preview format, redirect to frontend preserving ?ref=
    const forcePreview = req.query.format === 'html' || req.query.preview === 'true';
    if (!isCrawler && !forcePreview) {
      return res.redirect(302, canonicalUrl);
    }

    // Social Crawler Optimized Full HTML Response
    const html = `<!DOCTYPE html>
<html lang="en" prefix="og: https://ogp.me/ns# product: https://ogp.me/ns/product#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}">
  <link rel="canonical" href="${safeUrl}">

  <!-- Open Graph Meta Tags for WhatsApp, Facebook, LinkedIn -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="ApexBee">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImg}">
  <meta property="og:image:secure_url" content="${safeImg}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${safeTitle}">
  <meta property="og:url" content="${safeUrl}">
  ${price > 0 ? `<meta property="product:price:amount" content="${price}">` : ''}
  <meta property="product:price:currency" content="INR">

  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@ApexBeeOfficial">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImg}">
  <meta name="twitter:url" content="${safeUrl}">

  <!-- Structured Data JSON-LD for Search Crawlers -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": ${JSON.stringify(ogTitle)},
    "image": [${JSON.stringify(ogImage)}],
    "description": ${JSON.stringify(ogDescription)},
    "offers": {
      "@type": "Offer",
      "url": ${JSON.stringify(canonicalUrl)},
      "priceCurrency": "INR",
      "price": "${price}",
      "availability": "https://schema.org/InStock",
      "seller": {
        "@type": "Organization",
        "name": "ApexBee"
      }
    }
  }
  </script>

  <!-- Instant Browser Redirect Fallback for Non-Crawler Users -->
  <noscript>
    <meta http-equiv="refresh" content="0;url=${safeUrl}">
  </noscript>
  <script>
    if (!navigator.userAgent.match(/facebookexternalhit|WhatsApp|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Pinterest|Discordbot|Googlebot/i)) {
      window.location.replace("${safeUrl}");
    }
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0A1128; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: #111a3d; padding: 2rem; border-radius: 1rem; max-width: 480px; border: 1px solid #233166; }
    img { max-width: 100%; border-radius: 0.75rem; max-height: 250px; object-fit: cover; }
    h1 { font-size: 1.25rem; margin-top: 1rem; color: #f8fafc; }
    p { font-size: 0.875rem; color: #94a3b8; }
    .price { font-size: 1.5rem; font-weight: bold; color: #fbbf24; margin: 0.5rem 0; }
    a.btn { display: inline-block; background: #fbbf24; color: #0a1128; font-weight: bold; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <img src="${safeImg}" alt="${safeTitle}">
    <h1>${safeTitle}</h1>
    ${price > 0 ? `<div class="price">₹${price.toLocaleString('en-IN')}</div>` : ''}
    <p>${safeDesc}</p>
    <a href="${safeUrl}" class="btn">View on ApexBee &rarr;</a>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('[getProductSocialSharePreview Error]:', error);
    return res.redirect(302, 'https://apexbee.in');
  }
};

