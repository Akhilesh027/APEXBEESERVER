"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = __importDefault(require("../models/Product"));
const StoreProduct_1 = __importDefault(require("../models/StoreProduct"));
const panIndiaSlugs = [
    // Handcrafted Living & Decor items (Nationwide shipping)
    'rustic-ceramic-planter-bowl-local-test',
    'artisan-macrame-wall-hanging-local-test',
    'handwoven-jute-table-runner-local-test',
    'glazed-ceramic-coffee-mug-ochre-local-test',
    'terracotta-chai-kulhad-6pack-local-test',
    // Non-perishable Farm Commodities & Staples
    'adilabad-farm-fresh-red-chillies-250g',
    'fresh-stone-ground-wheat-atta-5kg'
];
async function updateToPanIndia() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI is not set.');
        return;
    }
    console.log('Connecting to MongoDB Atlas...');
    await mongoose_1.default.connect(mongoUri, { dbName: process.env.DB_NAME || 'test' });
    console.log('Connected.');
    console.log('\n--- Updating Selected Products to PAN-INDIA (Both Local & Nationwide Delivery) ---');
    for (const slug of panIndiaSlugs) {
        const updatedProd = await Product_1.default.findOneAndUpdate({ slug }, {
            $set: {
                deliveryScope: 'both',
                isPanIndia: true,
                isLocalDelivery: true
            }
        }, { new: true });
        if (updatedProd) {
            console.log(`✅ Updated Product: "${updatedProd.name}" -> isPanIndia: true, deliveryScope: both`);
            // Also update matching StoreProduct if exists
            await StoreProduct_1.default.updateMany({ productId: updatedProd._id }, {
                $set: {
                    deliveryScope: 'both',
                    isPanIndia: true,
                    isLocalDelivery: true
                }
            });
        }
        else {
            console.log(`⚠️ Product with slug "${slug}" not found.`);
        }
    }
    console.log('\nPAN-India product updates applied successfully!');
    await mongoose_1.default.disconnect();
}
updateToPanIndia()
    .then(() => process.exit(0))
    .catch(err => {
    console.error('Error updating products:', err);
    process.exit(1);
});
