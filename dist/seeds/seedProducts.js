"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedCatalog = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const Category_1 = __importDefault(require("../models/Category"));
const Subcategory_1 = __importDefault(require("../models/Subcategory"));
const Product_1 = __importDefault(require("../models/Product"));
const ProductVariant_1 = __importDefault(require("../models/ProductVariant"));
const StoreProduct_1 = __importDefault(require("../models/StoreProduct"));
const Inventory_1 = __importDefault(require("../models/Inventory"));
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const SearchDocument_1 = __importDefault(require("../models/SearchDocument"));
const seedCatalog = async (dryRun = false) => {
    console.log(`[Seed Catalog] Starting full refresh. Dry Run: ${dryRun}`);
    if (dryRun) {
        console.log('[Seed Catalog] Dry-run enabled. No write operations will be performed.');
    }
    else {
        // Clean old documents
        console.log('[Seed Catalog] Cleaning existing catalog collections...');
        await Category_1.default.deleteMany({});
        await Subcategory_1.default.deleteMany({});
        await Product_1.default.deleteMany({});
        await ProductVariant_1.default.deleteMany({});
        await StoreProduct_1.default.deleteMany({});
        await Inventory_1.default.deleteMany({});
        await SearchDocument_1.default.deleteMany({});
        console.log('[Seed Catalog] Cleaning done.');
    }
    // Load JSON files
    const categoriesPath = path_1.default.join(__dirname, 'data', 'categories.json');
    const subcategoriesPath = path_1.default.join(__dirname, 'data', 'subcategories.json');
    const productsPath = path_1.default.join(__dirname, 'data', 'products.json');
    const variantsPath = path_1.default.join(__dirname, 'data', 'variants.json');
    const rawCats = JSON.parse(fs_1.default.readFileSync(categoriesPath, 'utf8'));
    const rawSubs = JSON.parse(fs_1.default.readFileSync(subcategoriesPath, 'utf8'));
    const rawProds = JSON.parse(fs_1.default.readFileSync(productsPath, 'utf8'));
    const rawVars = JSON.parse(fs_1.default.readFileSync(variantsPath, 'utf8'));
    const catMap = {};
    const subMap = {};
    const prodMap = {};
    const varMap = {};
    // 1. Seed Categories
    for (const cat of rawCats) {
        if (dryRun) {
            console.log(`[Dry Run] Would seed Category: ${cat.name}`);
            catMap[cat.seedKey] = 'dry-run-cat-id';
            continue;
        }
        const doc = await Category_1.default.create({
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
            displayOrder: cat.displayOrder,
            isActive: cat.isActive,
            isFeatured: cat.isFeatured,
            isSeasonal: cat.isSeasonal,
            supportedItemTypes: cat.supportedItemTypes,
            seo: cat.seo,
        });
        catMap[cat.seedKey] = doc._id.toString();
        // Create SearchDocument for Category
        await SearchDocument_1.default.create({
            entityType: 'category',
            entityId: doc._id,
            title: cat.name,
            subtitle: cat.description,
            keywords: cat.seo?.keywords || [cat.slug],
            isActive: true,
            popularityScore: 10,
        });
    }
    console.log(`[Seed Catalog] Seeded ${Object.keys(catMap).length} categories.`);
    // 2. Seed Subcategories
    for (const sub of rawSubs) {
        const categoryId = catMap[sub.categorySeedKey];
        if (!categoryId)
            continue;
        if (dryRun) {
            console.log(`[Dry Run] Would seed Subcategory: ${sub.name}`);
            subMap[sub.seedKey] = 'dry-run-sub-id';
            continue;
        }
        const doc = await Subcategory_1.default.create({
            categoryId,
            name: sub.name,
            slug: sub.slug,
            displayOrder: sub.displayOrder,
            isActive: sub.isActive,
            isFeatured: sub.isFeatured,
        });
        subMap[sub.seedKey] = doc._id.toString();
        // Create SearchDocument for Subcategory
        await SearchDocument_1.default.create({
            entityType: 'subcategory',
            entityId: doc._id,
            title: sub.name,
            keywords: [sub.slug],
            categoryId,
            isActive: true,
            popularityScore: 5,
        });
    }
    console.log(`[Seed Catalog] Seeded ${Object.keys(subMap).length} subcategories.`);
    // 3. Find or Create default Vendor/Store
    let storeId = 'dry-run-store-id';
    if (!dryRun) {
        const vendorEmail = 'vendor@apexmarket.in';
        let user = await User_1.User.findOne({ email: vendorEmail });
        if (!user) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash('vendor123', salt);
            user = await User_1.User.create({
                name: 'ApexBee Local Store Manager',
                email: vendorEmail,
                passwordHash,
                phone: '8888888888',
                mobile: '8888888888',
                roles: ['vendor', 'customer'],
                status: 'active',
                isVerified: true,
            });
            console.log(`[Seed Catalog] Created default vendor User: ${vendorEmail}`);
        }
        let vendor = await Vendor_1.Vendor.findOne({ userId: user._id });
        if (!vendor) {
            vendor = await Vendor_1.Vendor.create({
                userId: user._id,
                businessName: 'ApexBee Local Superstore',
                ownerName: 'ApexBee Store Manager',
                mobile: '8888888888',
                email: vendorEmail,
                address: 'Downtown Market Street, Building 4B',
                pincode: '524001',
                status: 'active',
                marketplaceStatus: 'Approved',
                location: {
                    type: 'Point',
                    coordinates: [79.9865, 14.4426], // Nellore coordinates
                },
                deliveryMode: 'self_delivery',
                deliveryRadiusKm: 15,
                estimatedDeliveryMinutes: 25,
                minOrder: 150,
                deliveryCharge: 20,
                verifiedBadge: true,
                rating: { average: 4.8, totalReviews: 54 },
                liveStatus: 'open',
            });
            console.log('[Seed Catalog] Created default Vendor Store profile.');
        }
        storeId = vendor._id.toString();
        // Create SearchDocument for Store
        await SearchDocument_1.default.findOneAndUpdate({ entityId: vendor._id }, {
            $set: {
                entityType: 'store',
                entityId: vendor._id,
                title: vendor.businessName,
                subtitle: vendor.address,
                keywords: ['superstore', 'grocery', 'delivery', 'nearby'],
                location: vendor.location,
                serviceRadiusKm: vendor.deliveryRadiusKm,
                isActive: true,
            },
        }, { upsert: true });
    }
    // 4. Seed Products
    for (const prod of rawProds) {
        const subcategoryId = subMap[prod.subcategorySeedKey];
        if (!subcategoryId)
            continue;
        // Find parent category from subcategory map
        const subRaw = rawSubs.find((s) => s.seedKey === prod.subcategorySeedKey);
        const categoryId = catMap[subRaw?.categorySeedKey || ''];
        if (!categoryId)
            continue;
        if (dryRun) {
            console.log(`[Dry Run] Would seed Product: ${prod.name}`);
            prodMap[prod.seedKey] = 'dry-run-prod-id';
            continue;
        }
        const doc = await Product_1.default.create({
            name: prod.name,
            slug: prod.slug,
            description: prod.description,
            categoryId,
            subcategoryId,
            productType: prod.productType,
            specifications: prod.specifications || {},
            moderationStatus: 'approved',
            isActive: true,
            createdBy: new mongoose_1.default.Types.ObjectId(), // placeholder creator
        });
        prodMap[prod.seedKey] = doc._id.toString();
    }
    console.log(`[Seed Catalog] Seeded ${Object.keys(prodMap).length} master products.`);
    // 5. Seed Product Variants
    for (const vr of rawVars) {
        const productId = prodMap[vr.productSeedKey];
        if (!productId)
            continue;
        if (dryRun) {
            console.log(`[Dry Run] Would seed ProductVariant: ${vr.sku}`);
            varMap[vr.seedKey] = 'dry-run-var-id';
            continue;
        }
        const doc = await ProductVariant_1.default.create({
            productId,
            sku: vr.sku,
            barcode: vr.barcode,
            attributes: vr.attributes || {},
            weight: vr.weight,
            isActive: true,
        });
        varMap[vr.seedKey] = doc._id.toString();
        // Map store specific items
        // Define mock pricing based on item types
        let mrp = 100;
        let sellingPrice = 85;
        if (vr.sku.includes('MILK')) {
            mrp = 60;
            sellingPrice = 54;
        }
        else if (vr.sku.includes('WATER')) {
            mrp = 80;
            sellingPrice = 65;
        }
        else if (vr.sku.includes('TOMATO')) {
            mrp = 40;
            sellingPrice = 32;
        }
        else if (vr.sku.includes('SAREE')) {
            mrp = 4999;
            sellingPrice = 3999;
        }
        else if (vr.sku.includes('BOAT')) {
            mrp = 1999;
            sellingPrice = 1299;
        }
        else if (vr.sku.includes('JAS-FLW-100')) {
            mrp = 50;
            sellingPrice = 40;
        }
        else if (vr.sku.includes('JAS-FLW-250')) {
            mrp = 120;
            sellingPrice = 90;
        }
        // Seed StoreProduct
        const storeProduct = await StoreProduct_1.default.create({
            storeId,
            productId,
            variantId: doc._id,
            mrp,
            sellingPrice,
            minimumOrderQuantity: 1,
            preparationTimeMinutes: 15,
            deliveryTypes: ['express', 'same_day', 'standard'],
            subscriptionAvailable: vr.sku.includes('MILK') || vr.sku.includes('WATER'),
            scheduledDeliveryAvailable: true,
            isActive: true,
        });
        // Seed Inventory
        await Inventory_1.default.create({
            storeId,
            productId,
            variantId: doc._id,
            availableStock: 100,
            reservedStock: 0,
            damagedStock: 0,
            lowStockThreshold: 10,
        });
        // Create SearchDocument for Product Listing
        const parentProduct = await Product_1.default.findById(productId);
        await SearchDocument_1.default.create({
            entityType: 'product',
            entityId: storeProduct._id,
            title: parentProduct?.name || 'Product',
            subtitle: vr.sku,
            description: parentProduct?.description || '',
            keywords: [parentProduct?.slug || '', vr.sku, vr.barcode || ''],
            categoryId: parentProduct?.categoryId,
            subcategoryId: parentProduct?.subcategoryId,
            isActive: true,
            popularityScore: 1,
        });
    }
    console.log(`[Seed Catalog] Seeded StoreProducts, Inventory, and Search documents.`);
    return { success: true };
};
exports.seedCatalog = seedCatalog;
