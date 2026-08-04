"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = __importDefault(require("../models/Product"));
const StoreProduct_1 = __importDefault(require("../models/StoreProduct"));
const Inventory_1 = __importDefault(require("../models/Inventory"));
const Vendor_1 = require("../models/Vendor");
const BusinessApplication_1 = require("../models/BusinessApplication");
const VendorCategoryAccess_1 = __importDefault(require("../models/VendorCategoryAccess"));
dotenv_1.default.config();
async function clearProductsAndStores() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    console.log('Connecting to MongoDB:', mongoURI);
    await mongoose_1.default.connect(mongoURI);
    try {
        const prodRes = await Product_1.default.deleteMany({});
        console.log(`Deleted ${prodRes.deletedCount} products from Product collection.`);
        const storeProdRes = await StoreProduct_1.default.deleteMany({});
        console.log(`Deleted ${storeProdRes.deletedCount} store products from StoreProduct collection.`);
        const invRes = await Inventory_1.default.deleteMany({});
        console.log(`Deleted ${invRes.deletedCount} inventory records from Inventory collection.`);
        const vendorRes = await Vendor_1.Vendor.deleteMany({});
        console.log(`Deleted ${vendorRes.deletedCount} vendor/store profiles from Vendor collection.`);
        const appRes = await BusinessApplication_1.BusinessApplication.deleteMany({});
        console.log(`Deleted ${appRes.deletedCount} applications from BusinessApplication collection.`);
        const accessRes = await VendorCategoryAccess_1.default.deleteMany({});
        console.log(`Deleted ${accessRes.deletedCount} access records from VendorCategoryAccess collection.`);
        console.log('All products, store products, inventory records, vendor stores, applications, and access rights have been completely removed!');
    }
    catch (error) {
        console.error('Error clearing products and stores:', error.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
clearProductsAndStores();
