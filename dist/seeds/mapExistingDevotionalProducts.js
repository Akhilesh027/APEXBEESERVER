"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapExistingDevotionalProducts = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = __importDefault(require("../models/Product"));
const Category_1 = __importDefault(require("../models/Category"));
dotenv_1.default.config();
const mapExistingDevotionalProducts = async (isDryRun = false) => {
    console.log(`[MapExistingDevotionalProducts] Running product mapping (isDryRun: ${isDryRun})...`);
    const devotionalParent = await Category_1.default.findOne({ slug: 'devotional', level: 1 });
    if (!devotionalParent) {
        throw new Error('Devotional parent category not found in DB!');
    }
    // Find all products assigned to Devotional parent or subcategories
    const products = await Product_1.default.find({
        $or: [
            { categoryId: devotionalParent._id },
            { category: 'devotional' },
        ],
    });
    console.log(`Found ${products.length} Devotional products to inspect.`);
    const defaultChild = await Category_1.default.findOne({ slug: 'devotional-pooja-essentials-daily-pooja-packs' });
    let updatedCount = 0;
    for (const prod of products) {
        let targetChild = prod.childCategoryId ? await Category_1.default.findById(prod.childCategoryId) : null;
        if (!targetChild && defaultChild) {
            targetChild = defaultChild;
        }
        if (!isDryRun) {
            prod.childCategoryId = targetChild ? targetChild._id : prod.childCategoryId;
            prod.subCategoryId = targetChild?.parentId ? targetChild.parentId : prod.subCategoryId;
            prod.schemaVersion = 1;
            await prod.save();
        }
        updatedCount++;
    }
    console.log(`[MapExistingDevotionalProducts] Completed! Inspected: ${products.length}, Updated: ${updatedCount} (isDryRun: ${isDryRun}).`);
    return { inspected: products.length, updatedCount, isDryRun };
};
exports.mapExistingDevotionalProducts = mapExistingDevotionalProducts;
const runDirect = async () => {
    if (require.main === module) {
        try {
            const isDry = process.argv.includes('--dry-run');
            const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
            await mongoose_1.default.connect(mongoURI);
            await (0, exports.mapExistingDevotionalProducts)(isDry);
            process.exit(0);
        }
        catch (err) {
            console.error('Product map error:', err);
            process.exit(1);
        }
    }
};
runDirect();
