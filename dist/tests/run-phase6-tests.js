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
const User_1 = require("../models/User");
const Product_1 = __importDefault(require("../models/Product"));
const NotificationJob_1 = require("../modules/notifications/models/NotificationJob");
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';
async function runPhase6Tests() {
    console.log('Starting Phase 6 Pagination & Index Verification Tests...');
    console.log('Connecting to database:', MONGO_URI);
    await mongoose_1.default.connect(MONGO_URI);
    console.log('Database connected.');
    try {
        // ----------------------------------------------------
        // TEST 1: Schema Indexes verification
        // ----------------------------------------------------
        console.log('\n1. Checking index configurations on core schemas...');
        // 1. Product Indexes
        const productIndexes = Product_1.default.schema.indexes();
        const productHasTextIndex = productIndexes.some((idx) => idx[0] && idx[0].name === 'text' && idx[0].description === 'text');
        assert_1.default.ok(productHasTextIndex, 'Product schema must define a text index on name/description');
        console.log('Product schema indexes: PASS');
        // 2. User Indexes
        const userIndexes = User_1.User.schema.indexes();
        const userHasCompoundTerritoryIndex = userIndexes.some((idx) => idx[0] &&
            idx[0].roles === 1 &&
            idx[0]['territory.state'] === 1 &&
            idx[0]['territory.district'] === 1 &&
            idx[0]['territory.mandal'] === 1);
        assert_1.default.ok(userHasCompoundTerritoryIndex, 'User schema must define a roles/territory compound index');
        console.log('User schema indexes: PASS');
        // 3. NotificationJob Indexes
        const jobIndexes = NotificationJob_1.NotificationJob.schema.indexes();
        const jobHasCompoundIndex = jobIndexes.some((idx) => idx[0] &&
            idx[0].status === 1 &&
            idx[0].attempts === 1 &&
            idx[0].scheduledAt === 1);
        assert_1.default.ok(jobHasCompoundIndex, 'NotificationJob schema must define status/attempts/scheduledAt compound index');
        console.log('NotificationJob schema indexes: PASS');
        console.log('\n=======================================');
        console.log('ALL PHASE 6 TESTS PASSED SUCCESSFULLY! (100%)');
        console.log('=======================================');
        process.exit(0);
    }
    catch (err) {
        console.error('\n❌ TEST RUN ENCOUNTERED CRITICAL FAILURE:');
        console.error(err);
        process.exit(1);
    }
}
runPhase6Tests();
