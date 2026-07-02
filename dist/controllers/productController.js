"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductsByVendor = exports.bulkUpdateProducts = exports.rejectProduct = exports.sellerNegotiatePricing = exports.sellerAcceptPricing = exports.configureAdminPricing = exports.deleteProduct = exports.updateProduct = exports.getProductById = exports.getMyProducts = exports.getAllProducts = exports.createProduct = void 0;
const Product_1 = __importDefault(require("../models/Product"));
const Category_1 = __importDefault(require("../models/Category"));
const Vendor_1 = require("../models/Vendor");
const cloudinary_1 = require("../config/cloudinary");
const makeSlug = (name) => name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
const parseJson = (value, fallback) => {
    if (value === undefined || value === null || value === '')
        return fallback;
    if (typeof value !== 'string')
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
const normalizeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};
const makeUniqueSlug = async (name, excludeId) => {
    const slugBase = makeSlug(name);
    let slug = slugBase;
    let count = 1;
    while (await Product_1.default.exists({
        slug,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })) {
        slug = `${slugBase}-${count}`;
        count++;
    }
    return slug;
};
const normalizeVariants = (variants) => {
    if (!Array.isArray(variants))
        return [];
    return variants.map((variant) => {
        const mrp = normalizeNumber(variant.mrp);
        const discountPercent = normalizeNumber(variant.discountPercent);
        const calculatedSelling = mrp > 0 ? Math.round(mrp - (mrp * discountPercent) / 100) : 0;
        return {
            sku: String(variant.sku || '').toUpperCase().trim(),
            attributes: variant.attributes || {},
            mrp,
            discountPercent,
            sellingPrice: variant.sellingPrice !== undefined
                ? normalizeNumber(variant.sellingPrice)
                : calculatedSelling,
            stock: normalizeNumber(variant.stock),
            images: Array.isArray(variant.images) ? variant.images : [],
            isActive: variant.isActive !== false,
        };
    });
};
const getUploadedFiles = async (req) => {
    const files = req.files;
    let thumbnail = '';
    let images = [];
    if (files?.thumbnail?.[0]?.buffer) {
        const uploadedUrl = await (0, cloudinary_1.uploadToCloudinary)(files.thumbnail[0].buffer, 'apexbee/products/thumbnails');
        if (uploadedUrl)
            thumbnail = uploadedUrl;
    }
    if (files?.images?.length) {
        const uploadedImages = await Promise.all(files.images
            .filter((file) => file.buffer)
            .map((file) => (0, cloudinary_1.uploadToCloudinary)(file.buffer, 'apexbee/products/gallery')));
        images = uploadedImages.filter(Boolean);
    }
    return { thumbnail, images };
};
const populateProduct = (query) => {
    return query
        .populate('sellerId', 'name email mobile phone roles sellerProfile')
        .populate('categoryId', 'name slug level brands attributes')
        .populate('subCategoryId', 'name slug level brands attributes')
        .populate('childCategoryId', 'name slug level brands attributes');
};
const calculatePricing = (body) => {
    const sellingPrice = normalizeNumber(body.sellingPrice);
    const mrp = normalizeNumber(body.mrp, sellingPrice);
    const platformFeePercent = normalizeNumber(body.platformFeePercent);
    const platformFeeAmount = body.platformFeeAmount !== undefined
        ? normalizeNumber(body.platformFeeAmount)
        : (sellingPrice * platformFeePercent) / 100;
    const shippingCharge = normalizeNumber(body.shippingCharge);
    const packingCharge = normalizeNumber(body.packingCharge);
    const commissionShares = parseJson(body.commissionShares, []).map((item) => {
        const percent = normalizeNumber(item.percent);
        const amount = item.amount !== undefined
            ? normalizeNumber(item.amount)
            : (platformFeeAmount * percent) / 100;
        return {
            type: item.type,
            label: item.label,
            percent,
            amount,
            isActive: item.isActive !== false,
        };
    });
    const totalCommissionAmount = commissionShares.reduce((sum, item) => sum + normalizeNumber(item.amount), 0);
    const finalSellerAmount = sellingPrice - platformFeeAmount - shippingCharge - packingCharge;
    const customerSellingAmount = body.customerSellingAmount !== undefined
        ? normalizeNumber(body.customerSellingAmount)
        : sellingPrice + shippingCharge + packingCharge;
    const platformNetProfit = body.platformNetProfit !== undefined
        ? normalizeNumber(body.platformNetProfit)
        : platformFeeAmount - totalCommissionAmount;
    return {
        mrp,
        sellingPrice,
        platformFeePercent,
        platformFeeAmount,
        shippingCharge,
        packingCharge,
        commissionShares,
        totalCommissionAmount,
        finalSellerAmount,
        customerSellingAmount,
        platformNetProfit,
        remarks: body.remarks || '',
    };
};
const createProduct = async (req, res) => {
    try {
        const { name, description, categoryId, subCategoryId, childCategoryId, brand, sku, baseMrp, discountPercent, baseSellingPrice, stock, sellerType, } = req.body;
        if (!name?.trim() || !categoryId || !sku?.trim()) {
            res.status(400).json({
                message: 'Product name, category and SKU are required',
            });
            return;
        }
        const sellerId = req.user?._id || req.body.sellerId;
        if (!sellerId) {
            res.status(401).json({
                message: 'Seller not found. Login required.',
            });
            return;
        }
        const cleanSku = String(sku).toUpperCase().trim();
        const existingSku = await Product_1.default.exists({ sku: cleanSku });
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
        const calculatedSelling = mrp > 0 ? Math.round(mrp - (mrp * discount) / 100) : 0;
        const product = await Product_1.default.create({
            sellerId,
            sellerType: sellerType || 'vendor',
            name: name.trim(),
            slug,
            description: description || '',
            categoryId,
            subCategoryId: subCategoryId || null,
            childCategoryId: childCategoryId || null,
            brand: brand || '',
            sku: cleanSku,
            thumbnail: uploaded.thumbnail,
            images: uploaded.images,
            attributes: parsedAttributes,
            variants: parsedVariants,
            baseMrp: mrp,
            discountPercent: discount,
            baseSellingPrice: baseSellingPrice !== undefined && baseSellingPrice !== ''
                ? normalizeNumber(baseSellingPrice)
                : calculatedSelling,
            stock: normalizeNumber(stock),
            status: 'Pending Review',
            isActive: false,
            adminPricingApproved: false,
            sellerPricingAccepted: false,
            submittedAt: new Date(),
            isStoreProduct: req.body.isStoreProduct === 'true' || req.body.isStoreProduct === true,
            isSubscriptionAvailable: req.body.isSubscriptionAvailable === 'true' || req.body.isSubscriptionAvailable === true,
        });
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.status(201).json({
            message: 'Product added successfully and sent for admin review',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to create product',
            error: error.message,
        });
    }
};
exports.createProduct = createProduct;
const getAllProducts = async (req, res) => {
    try {
        const { category, categoryId, status, isActive, excludeId, limit, sellerId } = req.query;
        const filter = {};
        if (sellerId) {
            filter.sellerId = sellerId;
        }
        if (status) {
            filter.status = status;
        }
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        }
        if (categoryId) {
            filter.categoryId = categoryId;
        }
        if (excludeId) {
            filter._id = { $ne: excludeId };
        }
        if (category) {
            const foundCategory = await Category_1.default.findOne({
                $or: [
                    { name: new RegExp('^' + String(category).trim() + '$', 'i') },
                    { slug: String(category).trim().toLowerCase() }
                ]
            });
            if (foundCategory) {
                filter.$or = [
                    { categoryId: foundCategory._id },
                    { subCategoryId: foundCategory._id },
                    { childCategoryId: foundCategory._id }
                ];
            }
            else {
                return res.json({ products: [] });
            }
        }
        let query = Product_1.default.find(filter).sort({
            createdAt: -1,
        });
        if (limit) {
            query = query.limit(Number(limit));
        }
        const products = await populateProduct(query);
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch products',
            error: error.message,
        });
    }
};
exports.getAllProducts = getAllProducts;
const getMyProducts = async (req, res) => {
    try {
        const sellerId = req.user?.id || req.user?._id || req.query.sellerId;
        if (!sellerId) {
            res.status(401).json({
                message: 'Seller not found',
            });
            return;
        }
        const products = await populateProduct(Product_1.default.find({ sellerId })).sort({
            createdAt: -1,
        });
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch seller products',
            error: error.message,
        });
    }
};
exports.getMyProducts = getMyProducts;
const getProductById = async (req, res) => {
    try {
        const product = await populateProduct(Product_1.default.findById(req.params.id));
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        res.json({ product });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to fetch product',
            error: error.message,
        });
    }
};
exports.getProductById = getProductById;
const updateProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        if (product.status === 'Live') {
            res.status(400).json({
                message: 'Live product cannot be edited directly',
            });
            return;
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
            const existingSku = await Product_1.default.exists({
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
            product.variants = normalizeVariants(parseJson(req.body.variants, []));
        }
        if (req.body.isStoreProduct !== undefined) {
            product.isStoreProduct = req.body.isStoreProduct === 'true' || req.body.isStoreProduct === true;
        }
        if (req.body.isSubscriptionAvailable !== undefined) {
            product.isSubscriptionAvailable = req.body.isSubscriptionAvailable === 'true' || req.body.isSubscriptionAvailable === true;
        }
        product.status = 'Pending Review';
        product.adminPricingApproved = false;
        product.sellerPricingAccepted = false;
        product.isActive = false;
        product.approvedByAdminAt = undefined;
        product.sellerAcceptedAt = undefined;
        product.liveAt = undefined;
        await product.save();
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.json({
            message: 'Product updated successfully and sent for review',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to update product',
            error: error.message,
        });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        if (product.status === 'Live') {
            res.status(400).json({
                message: 'Live product cannot be deleted directly',
            });
            return;
        }
        await product.deleteOne();
        res.json({ message: 'Product deleted successfully' });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to delete product',
            error: error.message,
        });
    }
};
exports.deleteProduct = deleteProduct;
const configureAdminPricing = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        const adminPricing = calculatePricing(req.body);
        product.adminPricing = {
            ...adminPricing,
            configuredBy: req.user?._id || req.body.adminId,
            configuredAt: new Date(),
        };
        if (req.body.referralCommission) {
            product.referralCommission = {
                level1: normalizeNumber(req.body.referralCommission.level1),
                level2: normalizeNumber(req.body.referralCommission.level2),
                level3: normalizeNumber(req.body.referralCommission.level3)
            };
        }
        else {
            const shares = req.body.commissionShares;
            if (Array.isArray(shares)) {
                const getSharePercent = (type) => {
                    const sh = shares.find((s) => s.type === type && s.isActive !== false);
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
        product.adminPricingApproved = true;
        product.sellerPricingAccepted = false;
        product.approvedByAdminAt = new Date();
        product.isActive = false;
        await product.save();
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.json({
            message: 'Admin pricing saved. Waiting for seller approval.',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to configure admin pricing',
            error: error.message,
        });
    }
};
exports.configureAdminPricing = configureAdminPricing;
const sellerAcceptPricing = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
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
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.json({
            message: 'Pricing accepted. Product is now live.',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to accept pricing',
            error: error.message,
        });
    }
};
exports.sellerAcceptPricing = sellerAcceptPricing;
const sellerNegotiatePricing = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        const { message, requestedSellingPrice, requestedPlatformFeePercent, requestedShippingCharge, requestedPackingCharge, } = req.body;
        if (!message?.trim()) {
            res.status(400).json({
                message: 'Negotiation message is required',
            });
            return;
        }
        product.sellerNegotiations.push({
            message: message.trim(),
            requestedSellingPrice: requestedSellingPrice !== undefined
                ? normalizeNumber(requestedSellingPrice)
                : undefined,
            requestedPlatformFeePercent: requestedPlatformFeePercent !== undefined
                ? normalizeNumber(requestedPlatformFeePercent)
                : undefined,
            requestedShippingCharge: requestedShippingCharge !== undefined
                ? normalizeNumber(requestedShippingCharge)
                : undefined,
            requestedPackingCharge: requestedPackingCharge !== undefined
                ? normalizeNumber(requestedPackingCharge)
                : undefined,
            createdAt: new Date(),
        });
        product.status = 'Negotiation Requested';
        product.sellerPricingAccepted = false;
        product.isActive = false;
        await product.save();
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.json({
            message: 'Negotiation request sent to admin',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to negotiate pricing',
            error: error.message,
        });
    }
};
exports.sellerNegotiatePricing = sellerNegotiatePricing;
const rejectProduct = async (req, res) => {
    try {
        const product = await Product_1.default.findById(req.params.id);
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        product.status = 'Rejected';
        product.isActive = false;
        product.adminPricingApproved = false;
        product.sellerPricingAccepted = false;
        product.rejectionReason = req.body.reason || 'Product rejected by admin';
        await product.save();
        const populatedProduct = await populateProduct(Product_1.default.findById(product._id));
        res.json({
            message: 'Product rejected',
            product: populatedProduct,
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to reject product',
            error: error.message,
        });
    }
};
exports.rejectProduct = rejectProduct;
const bulkUpdateProducts = async (req, res) => {
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
        await Product_1.default.updateMany({ _id: { $in: productIds } }, { $set: safeUpdateData });
        res.json({
            message: 'Products updated successfully',
        });
    }
    catch (error) {
        res.status(500).json({
            message: 'Failed to bulk update products',
            error: error.message,
        });
    }
};
exports.bulkUpdateProducts = bulkUpdateProducts;
const getProductsByVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;
        // Support querying by vendor.userId if the vendorId passed is vendor._id
        let querySellerId = vendorId;
        try {
            const vendor = await Vendor_1.Vendor.findById(vendorId);
            if (vendor && vendor.userId) {
                querySellerId = vendor.userId.toString();
            }
        }
        catch (err) {
            // Ignore if not a valid ObjectId
        }
        // Only return Live + active storefront products for customer-facing storefront view
        const products = await Product_1.default.find({
            $or: [
                { sellerId: querySellerId },
                { sellerId: vendorId }
            ],
            isStoreProduct: true,
            status: 'Live',
            isActive: true
        })
            .populate('categoryId', 'name')
            .populate('subCategoryId', 'name');
        const formattedProducts = products.map((p) => {
            const pObj = p.toObject ? p.toObject() : p;
            return {
                _id: pObj._id,
                vendorId: pObj.sellerId,
                itemName: pObj.name,
                images: pObj.images && pObj.images.length > 0 ? pObj.images : [pObj.thumbnail].filter(Boolean),
                afterDiscount: pObj.baseSellingPrice,
                userPrice: pObj.baseMrp,
                category: pObj.categoryId ? {
                    _id: pObj.categoryId._id || pObj.categoryId,
                    name: pObj.categoryId.name || 'Category'
                } : undefined,
                subcategory: pObj.subCategoryId?.name || '',
                status: pObj.status,
                isSubscriptionAvailable: !!pObj.isSubscriptionAvailable,
                brand: pObj.brand || 'Fresh & Local',
                deliveryFee: 0
            };
        });
        res.status(200).json({
            success: true,
            data: formattedProducts
        });
    }
    catch (error) {
        console.error('Error fetching products by vendor:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching products by vendor',
            error: error.message
        });
    }
};
exports.getProductsByVendor = getProductsByVendor;
