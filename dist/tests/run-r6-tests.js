"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const assert_1 = __importDefault(require("assert"));
const Product_1 = __importDefault(require("../models/Product"));
const Category_1 = __importDefault(require("../models/Category"));
const User_1 = require("../models/User");
const productController_1 = require("../controllers/productController");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runR6Tests() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    const suffix = `_test_${Date.now()}`;
    const seller = new User_1.User({
        name: 'Browse Seller',
        email: `seller_${suffix}@browse.com`,
        passwordHash: 'hash',
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        roles: ['vendor'],
        isVerified: true,
    });
    await seller.save();
    const category = new Category_1.default({
        name: `Electronics-${suffix}`,
        slug: `electronics-${suffix}`,
        level: 1,
        isActive: true,
    });
    await category.save();
    // Create 25 products
    const productsToCreate = Array.from({ length: 25 }, (_, i) => ({
        name: `Product ${i}`,
        sku: `SKU-BROWSE-${i}-${suffix}`,
        slug: `product-${i}-${suffix}`,
        sellerId: seller._id,
        sellerType: 'vendor',
        categoryId: category._id,
        baseMrp: 100,
        baseSellingPrice: 80,
        stock: 10,
        status: 'Live',
        isActive: true,
    }));
    await Product_1.default.create(productsToCreate);
    console.log('Seeded 25 test products.');
    try {
        // ----------------------------------------------------
        // TEST 1: Collation case-insensitive category lookup
        // ----------------------------------------------------
        console.log('\n1. Testing Collation case-insensitive category lookup...');
        const mockReqCollation = {
            query: { category: `electronics-${suffix}` },
            headers: {},
        };
        let resBody;
        const mockResCollation = {
            json(data) {
                resBody = data;
            }
        };
        await (0, productController_1.getAllProducts)(mockReqCollation, mockResCollation);
        assert_1.default.ok(resBody.success);
        assert_1.default.strictEqual(resBody.products.length, 20, 'Default page limit should fetch 20 items');
        assert_1.default.strictEqual(resBody.pagination.totalProducts, 25, 'Total products count should equal 25');
        console.log('Collation category lookup: PASS');
        // ----------------------------------------------------
        // TEST 2: Pagination limits (page 2, limit 10)
        // ----------------------------------------------------
        console.log('\n2. Testing Pagination limits...');
        const mockReqPage = {
            query: { category: `electronics-${suffix}`, page: '2', limit: '10' },
            headers: {},
        };
        let resBodyPage;
        const mockResPage = {
            json(data) {
                resBodyPage = data;
            }
        };
        await (0, productController_1.getAllProducts)(mockReqPage, mockResPage);
        assert_1.default.ok(resBodyPage.success);
        assert_1.default.strictEqual(resBodyPage.products.length, 10, 'Page size 10 must fetch 10 items');
        assert_1.default.strictEqual(resBodyPage.pagination.page, 2, 'Page field in pagination must equal 2');
        assert_1.default.strictEqual(resBodyPage.pagination.totalPages, 3, 'Total pages for 25 items with limit 10 must equal 3');
        console.log('Pagination limits: PASS');
        // Cleanup
        await User_1.User.deleteOne({ _id: seller._id });
        await Category_1.default.deleteOne({ _id: category._id });
        await Product_1.default.deleteMany({ sku: { $regex: `-${suffix}$` } });
        console.log('\n=======================================');
        console.log('ALL RELEASE R6 TESTS PASSED! (100%)');
        console.log('=======================================');
        await mongoose_1.default.disconnect();
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        try {
            await mongoose_1.default.disconnect();
        }
        catch { }
        process.exit(1);
    }
}
runR6Tests();
