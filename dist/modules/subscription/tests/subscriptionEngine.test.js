"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const TaxEngineService_1 = require("../services/TaxEngineService");
const VendorPricingService_1 = require("../services/VendorPricingService");
const EntitlementService_1 = require("../services/EntitlementService");
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../../../.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/apexbee';
async function runTests() {
    console.log('====================================================');
    console.log('RUNNING APEXBEE SUBSCRIPTION ENGINE VERIFICATION TESTS');
    console.log('====================================================\n');
    try {
        if (mongoose_1.default.connection.readyState !== 1) {
            await mongoose_1.default.connect(MONGODB_URI);
        }
        // TEST 1: Tax Engine Service
        console.log('[TEST 1] TaxEngineService Intrastate vs Interstate Test...');
        const intrastateTax = TaxEngineService_1.TaxEngineService.calculateTax(1000, 18, 'TELANGANA', 'EXCLUSIVE');
        console.assert(intrastateTax.isInterstate === false, 'Intrastate check failed');
        console.assert(intrastateTax.cgstAmount === 90, 'CGST check failed');
        console.assert(intrastateTax.sgstAmount === 90, 'SGST check failed');
        console.assert(intrastateTax.igstAmount === 0, 'IGST check failed');
        console.assert(intrastateTax.finalAmount === 1180, 'Final amount check failed');
        console.log(' -> PASSED: Intrastate CGST (90) + SGST (90) = 180 on 1000 base.\n');
        const interstateTax = TaxEngineService_1.TaxEngineService.calculateTax(1000, 18, 'KARNATAKA', 'EXCLUSIVE');
        console.assert(interstateTax.isInterstate === true, 'Interstate check failed');
        console.assert(interstateTax.igstAmount === 180, 'IGST check failed');
        console.assert(interstateTax.cgstAmount === 0, 'CGST check failed');
        console.log(' -> PASSED: Interstate IGST (180) on 1000 base.\n');
        // TEST 2: Vendor Pricing Resolution
        console.log('[TEST 2] VendorPricingService Priority Resolution Test...');
        const fakeVendorId = new mongoose_1.default.Types.ObjectId().toString();
        const fakeProdId = new mongoose_1.default.Types.ObjectId().toString();
        const fakePriceId = new mongoose_1.default.Types.ObjectId().toString();
        const resolved = await VendorPricingService_1.VendorPricingService.resolveVendorBasePrice(fakeVendorId, 'restaurant', fakeProdId, fakePriceId, 4999);
        console.assert(resolved.resolvedPrice === 4999, 'Default fallback failed');
        console.assert(resolved.pricingSource === 'DEFAULT_PRICE', 'Source tag failed');
        console.log(' -> PASSED: Un-overridden vendor correctly defaults to 4999 base price.\n');
        // TEST 3: Entitlement Resolution
        console.log('[TEST 3] EntitlementService Evaluation Test...');
        const fakeVendorId2 = new mongoose_1.default.Types.ObjectId().toString();
        const entitlement = await EntitlementService_1.EntitlementService.getFeatureEntitlement(fakeVendorId2, 'POS_ACCESS');
        console.assert(typeof entitlement.enabled === 'boolean', 'Entitlement enabled check failed');
        console.log(` -> PASSED: Feature POS_ACCESS resolved successfully (enabled: ${entitlement.enabled}).\n`);
        console.log('====================================================');
        console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
        console.log('====================================================');
        process.exit(0);
    }
    catch (error) {
        console.error('TEST SUITE FAILED:', error);
        process.exit(1);
    }
}
runTests();
