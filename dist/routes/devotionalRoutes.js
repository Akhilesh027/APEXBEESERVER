"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const devotionalVendorController_1 = require("../controllers/devotionalVendorController");
const devotionalSchemaController_1 = require("../controllers/devotionalSchemaController");
const router = express_1.default.Router();
// Vendor Access Routes
router.get('/vendor-access/me', auth_1.protect, devotionalVendorController_1.getMyCategoryAccess);
router.post('/vendor-access/request', auth_1.protect, devotionalVendorController_1.requestVendorCapabilities);
router.get('/allowed-categories', auth_1.protect, devotionalVendorController_1.getVendorAllowedCategories);
// Category Product Schemas
router.get('/category-schemas/:categoryId/resolved', devotionalSchemaController_1.getResolvedCategorySchema);
router.get('/admin/category-schemas', auth_1.protect, (0, auth_1.restrictTo)('admin'), devotionalSchemaController_1.getAllCategorySchemas);
router.post('/admin/category-schemas', auth_1.protect, (0, auth_1.restrictTo)('admin'), devotionalSchemaController_1.createOrUpdateCategorySchema);
// Admin Category Access Review & Management
router.post('/admin/vendors/:vendorId/category-access/review', auth_1.protect, (0, auth_1.restrictTo)('admin'), devotionalVendorController_1.reviewVendorCategoryAccess);
router.patch('/admin/vendor-category-access/:accessId', auth_1.protect, (0, auth_1.restrictTo)('admin'), devotionalVendorController_1.updateVendorCategoryAccess);
router.post('/admin/vendor-category-access/:accessId/suspend-capability', auth_1.protect, (0, auth_1.restrictTo)('admin'), devotionalVendorController_1.suspendVendorCapability);
// Seed Execution & Test Runner Endpoints
router.get('/seed-products/dry-run', async (req, res) => {
    try {
        const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
        const result = await seedDevotionalProducts({ dryRun: true });
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/seed-products', async (req, res) => {
    try {
        const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
        const result = await seedDevotionalProducts();
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/seed-vendor-products', async (req, res) => {
    try {
        const email = req.query.email || 'dev@gmail.com';
        const { seedVendorDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedVendorDevotionalProducts')));
        const result = await seedVendorDevotionalProducts(email);
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.all('/clear-products', async (req, res) => {
    try {
        const { removeSeededProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/removeSeededProducts')));
        await removeSeededProducts();
        res.json({ success: true, message: 'All seeded products, variants, and store listings removed successfully.' });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/run-tests', async (req, res) => {
    try {
        const { seedDevotionalProducts } = await Promise.resolve().then(() => __importStar(require('../seeds/seedDevotionalProducts')));
        const dryResult = await seedDevotionalProducts({ dryRun: true });
        const liveResult1 = await seedDevotionalProducts();
        const liveResult2 = await seedDevotionalProducts(); // Idempotency test
        res.json({
            success: true,
            dryResult,
            firstRun: liveResult1,
            secondRunIdempotent: liveResult2,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
