"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Category_1 = __importDefault(require("../models/Category"));
const CategoryProductSchema_1 = __importDefault(require("../models/CategoryProductSchema"));
dotenv_1.default.config();
async function clearAllCategories() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    console.log('Connecting to MongoDB:', mongoURI);
    await mongoose_1.default.connect(mongoURI);
    try {
        const catResult = await Category_1.default.deleteMany({});
        console.log(`Successfully deleted ${catResult.deletedCount} category documents from Category collection.`);
        const schemaResult = await CategoryProductSchema_1.default.deleteMany({});
        console.log(`Successfully deleted ${schemaResult.deletedCount} category product schema documents from CategoryProductSchema collection.`);
        console.log('All categories and category product schemas have been completely removed from the database!');
    }
    catch (error) {
        console.error('Error removing categories:', error.message);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
clearAllCategories();
