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
    const parentCategories = await Category_1.default.find({ level: 1 });
    if (parentCategories.length === 0) {
        console.warn('[BackfillVendorCategoryAccess] No Level 1 parent categories found in DB!');
        return { inspected: 0, createdCount: 0, updatedCount: 0, skippedCount: 0, isDryRun };
    }
    const vendors = await Vendor_1.Vendor.find({});
    console.log(`Found ${vendors.length} total vendors to inspect.`);
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    for (const vendor of vendors) {
        const vendorPrimaryStr = (vendor.primaryCategory || vendor.category || vendor.storeType || '').toLowerCase();
        // Find matching parent category, or default to Devotional/Shopping/first available
        let targetParent = parentCategories.find(p => p.slug.toLowerCase().includes(vendorPrimaryStr) ||
            vendorPrimaryStr.includes(p.slug.toLowerCase()) ||
            p.name.toLowerCase().includes(vendorPrimaryStr) ||
            vendorPrimaryStr.includes(p.name.toLowerCase()));
        if (!targetParent) {
            targetParent = parentCategories.find(p => p.slug === 'devotional') || parentCategories[0];
        }
        if (!targetParent)
            continue;
        const existing = await VendorCategoryAccess_1.default.findOne({
            vendorId: vendor._id,
            parentCategoryId: targetParent._id,
        });
        if (existing && (existing.status === 'approved' || existing.status === 'partially_approved') && existing.restrictions?.canCreateProducts) {
            skippedCount++;
            continue;
        }
        // Infer requested capabilities from businessName
        const capabilities = ['pooja_store', 'general_store', 'retail_store'];
        const nameLower = (vendor.businessName || '').toLowerCase();
        if (nameLower.includes('flower') || nameLower.includes('garland'))
            capabilities.push('flower_shop');
        if (nameLower.includes('coconut'))
            capabilities.push('coconut_shop');
        if (nameLower.includes('fruit'))
            capabilities.push('fruit_shop');
        if (nameLower.includes('sweet') || nameLower.includes('prasadam'))
            capabilities.push('sweet_shop', 'prasadam_partner');
        if (nameLower.includes('priest') || nameLower.includes('pandit') || nameLower.includes('purohit'))
            capabilities.push('priest_pandit');
        if (!isDryRun) {
            await VendorCategoryAccess_1.default.findOneAndUpdate({ vendorId: vendor._id, parentCategoryId: targetParent._id }, {
                $set: {
                    vendorId: vendor._id,
                    storeId: vendor._id,
                    parentCategoryId: targetParent._id,
                    requestedCapabilities: Array.from(new Set(capabilities)),
                    approvedCapabilities: Array.from(new Set(capabilities)),
                    approvedItemTypes: ['product', 'service'],
                    status: 'approved',
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
        if (existing) {
            updatedCount++;
        }
        else {
            createdCount++;
        }
    }
    console.log(`[BackfillVendorCategoryAccess] Summary: ${vendors.length} inspected, ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped.`);
    return { inspected: vendors.length, createdCount, updatedCount, skippedCount, isDryRun };
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
