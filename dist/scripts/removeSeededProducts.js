"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeSeededProducts = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = __importDefault(require("../models/Product"));
const ProductVariant_1 = __importDefault(require("../models/ProductVariant"));
dotenv_1.default.config();
const removeSeededProducts = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
        if (mongoose_1.default.connection.readyState === 0) {
            await mongoose_1.default.connect(mongoURI);
            console.log('[removeSeededProducts] Connected to MongoDB.');
        }
        // Query seeded products matching seeded SKU patterns or attributes
        const query = {
            $or: [
                { sku: { $regex: /^DEV-/i } },
                { sku: { $regex: /^SEED-/i } },
                { sku: { $regex: /^MOCK-/i } },
                { 'attributes.isSeeded': true },
                { 'attributes.seedKey': { $exists: true } }
            ]
        };
        const seededProducts = await Product_1.default.find(query);
        const productIds = seededProducts.map(p => p._id);
        console.log(`[removeSeededProducts] Found ${seededProducts.length} seeded products to remove.`);
        if (productIds.length > 0) {
            const varResult = await ProductVariant_1.default.deleteMany({ productId: { $in: productIds } });
            console.log(`[removeSeededProducts] Removed ${varResult.deletedCount} associated product variants.`);
            const prodResult = await Product_1.default.deleteMany({ _id: { $in: productIds } });
            console.log(`[removeSeededProducts] Successfully removed ${prodResult.deletedCount} seeded products.`);
            return {
                success: true,
                removedProductsCount: prodResult.deletedCount,
                removedVariantsCount: varResult.deletedCount
            };
        }
        return {
            success: true,
            removedProductsCount: 0,
            removedVariantsCount: 0
        };
    }
    catch (err) {
        console.error('[removeSeededProducts Error]:', err);
        return { success: false, error: err.message };
    }
};
exports.removeSeededProducts = removeSeededProducts;
const runCLI = async () => {
    if (require.main === module) {
        const result = await (0, exports.removeSeededProducts)();
        console.log('[removeSeededProducts Summary]:', result);
        process.exit(0);
    }
};
runCLI();
