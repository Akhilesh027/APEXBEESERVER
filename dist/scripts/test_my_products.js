"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Product_1 = __importDefault(require("../models/Product"));
dotenv_1.default.config();
const MONGODB_URI = process.env.MONGODB_URI || '';
const populateProduct = (query) => {
    return query
        .populate('sellerId', 'name email mobile phone roles sellerProfile')
        .populate('categoryId', 'name slug level brands attributes')
        .populate('subCategoryId', 'name slug level brands attributes')
        .populate('childCategoryId', 'name slug level brands attributes');
};
async function testQuery() {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
        const sellerId = '6a44c7ec1b05eb2b5d6a3686'; // from the user's error trace
        console.log('Running query for sellerId:', sellerId);
        const query = Product_1.default.find({ sellerId });
        const populated = populateProduct(query);
        const sorted = populated.sort({ createdAt: -1 });
        const products = await sorted;
        console.log('Query succeeded! Found products count:', products.length);
    }
    catch (error) {
        console.error('Query failed with error:', error);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
testQuery();
