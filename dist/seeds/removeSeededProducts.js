"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeSeededProducts = removeSeededProducts;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = __importDefault(require("../models/Product"));
const StoreProduct_1 = __importDefault(require("../models/StoreProduct"));
const Inventory_1 = __importDefault(require("../models/Inventory"));
const ProductVariant_1 = __importDefault(require("../models/ProductVariant"));
const SearchDocument_1 = __importDefault(require("../models/SearchDocument"));
dotenv_1.default.config();
async function removeSeededProducts() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    console.log('Connecting to MongoDB:', mongoURI);
    await mongoose_1.default.connect(mongoURI);
    try {
        const deleteAll = process.argv.includes('--all');
        let filter = {
            $or: [
                { sku: /^SEED-/i },
                { sku: /^DEMO-SEED-/i },
                { sku: /^SKU-DEV-/i },
                { slug: /^seed-/i },
                { slug: /^dev-store-/i },
                { slug: /^store-/i },
                { seedKey: { $exists: true } },
                { catalogueSource: 'system' },
                { isCatalogueMaster: true },
                { brand: 'ApexBee Prime' },
                { name: /^Premium /i }
            ]
        };
        if (deleteAll) {
            filter = {};
            console.log('Mode: Deleting ALL products in database (--all specified)');
        }
        else {
            console.log('Mode: Deleting SEEDED products and catalogue masters');
        }
        const seededProducts = await Product_1.default.find(filter).select('_id');
        const productIds = seededProducts.map(p => p._id);
        console.log(`Found ${productIds.length} products to remove.`);
        if (productIds.length > 0) {
            const prodRes = await Product_1.default.deleteMany({ _id: { $in: productIds } });
            console.log(`Deleted ${prodRes.deletedCount} products from Product collection.`);
            const storeProdRes = await StoreProduct_1.default.deleteMany({ productId: { $in: productIds } });
            console.log(`Deleted ${storeProdRes.deletedCount} store products.`);
            const invRes = await Inventory_1.default.deleteMany({ productId: { $in: productIds } });
            console.log(`Deleted ${invRes.deletedCount} inventory records.`);
            const varRes = await ProductVariant_1.default.deleteMany({ productId: { $in: productIds } });
            console.log(`Deleted ${varRes.deletedCount} product variants.`);
            const searchRes = await SearchDocument_1.default.deleteMany({ entityId: { $in: productIds } });
            console.log(`Deleted ${searchRes.deletedCount} search documents.`);
        }
        console.log('Seeded products cleanup completed successfully!');
    }
    catch (error) {
        console.error('Error removing seeded products:', error.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
if (require.main === module) {
    removeSeededProducts();
}
