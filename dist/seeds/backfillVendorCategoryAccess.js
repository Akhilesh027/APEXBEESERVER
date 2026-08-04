"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillVendorCategoryAccess = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Vendor_1 = require("../models/Vendor");
const Category_1 = __importDefault(require("../models/Category"));
const VendorCategoryAccess_1 = __importDefault(require("../models/VendorCategoryAccess"));
dotenv_1.default.config();
const backfillVendorCategoryAccess = async (isDryRun = false) => {
    console.log(`[BackfillVendorCategoryAccess] Running backfill (isDryRun: ${isDryRun})...`);
    const devotionalParent = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
    if (!devotionalParent) {
        throw new Error('Devotional parent category not found in DB! Run seedDevotionalTaxonomy first.');
    }
    // Find all vendors with primaryCategory = devotional or storeType = devotional or categories containing devotional
    const vendors = await Vendor_1.Vendor.find({
        $or: [
            { primaryCategory: 'devotional' },
            { storeType: 'devotional' },
            { categories: { $in: ['devotional', 'Devotional', 'Pooja', 'Puja'] } },
        ],
    });
    console.log(`Found ${vendors.length} existing Devotional vendors to inspect.`);
    let createdCount = 0;
    let skippedCount = 0;
    for (const vendor of vendors) {
        const existing = await VendorCategoryAccess_1.default.findOne({
            vendorId: vendor._id,
            parentCategoryId: devotionalParent._id,
        });
        if (existing) {
            skippedCount++;
            continue;
        }
        // Infer requested capabilities from businessName / storeTags
        const capabilities = ['pooja_store'];
        const nameLower = (vendor.businessName || '').toLowerCase();
        if (nameLower.includes('flower') || nameLower.includes('garland'))
            capabilities.push('flower_shop');
        if (nameLower.includes('coconut'))
            capabilities.push('coconut_shop');
        if (nameLower.includes('fruit'))
            capabilities.push('fruit_shop');
        if (nameLower.includes('sweet') || nameLower.includes('prasadam'))
            capabilities.push('sweet_shop', 'prasadam_partner');
        if (nameLower.includes('frame') || nameLower.includes('photo'))
            capabilities.push('photo_frame_shop', 'digital_printing_shop');
        if (nameLower.includes('brass') || nameLower.includes('copper'))
            capabilities.push('brass_copper_shop');
        if (nameLower.includes('book'))
            capabilities.push('spiritual_book_shop');
        if (nameLower.includes('priest') || nameLower.includes('pandit') || nameLower.includes('purohit'))
            capabilities.push('priest_pandit');
        if (!isDryRun) {
            await VendorCategoryAccess_1.default.create({
                vendorId: vendor._id,
                storeId: vendor._id,
                parentCategoryId: devotionalParent._id,
                requestedCapabilities: Array.from(new Set(capabilities)),
                approvedCapabilities: ['pooja_store'], // Default safe approval
                approvedSubcategoryIds: [],
                approvedChildCategoryIds: [],
                approvedItemTypes: ['product'],
                status: 'pending', // Requires explicit admin review
                restrictions: {
                    canCreateProducts: true,
                    canCreateServices: capabilities.includes('priest_pandit'),
                    canJoinFestivalCombos: true,
                    canAcceptBulkOrders: false,
                    canSellWholesale: false,
                    canOfferSubscriptions: false,
                },
                requestedAt: new Date(),
            });
        }
        createdCount++;
    }
    console.log(`[BackfillVendorCategoryAccess] Summary: ${vendors.length} inspected, ${createdCount} access records ${isDryRun ? 'would be created' : 'created'}, ${skippedCount} skipped.`);
    return { inspected: vendors.length, createdCount, skippedCount, isDryRun };
};
exports.backfillVendorCategoryAccess = backfillVendorCategoryAccess;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const isDry = process.argv.includes('--dry-run');
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            await mongoose_1.default.connect(mongoURI);
            await (0, exports.backfillVendorCategoryAccess)(isDry);
            process.exit(0);
        }
        catch (err) {
            console.error('Backfill error:', err);
            process.exit(1);
        }
    }
};
runDirect();
