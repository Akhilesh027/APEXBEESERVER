"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const multer_1 = require("../middleware/multer");
const auth_1 = require("../middleware/auth");
const vendorCategoryAccessMiddleware_1 = require("../middleware/vendorCategoryAccessMiddleware");
const router = express_1.default.Router();
// Public routes & specific endpoints
router.all('/seed-all-categories', productController_1.seedProductsForAllCategories);
router.get('/', productController_1.getAllProducts);
router.get('/buy-again', productController_1.getBuyAgainProducts);
router.get('/my-products', auth_1.protect, productController_1.getMyProducts);
router.get('/vendor/:vendorId', productController_1.getProductsByVendor);
router.get('/inventory/movements', auth_1.protect, productController_1.getInventoryMovements);
router.post('/inventory/movements', auth_1.protect, productController_1.createInventoryMovement);
router.post('/bulk-update', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), productController_1.bulkUpdateProducts);
router.post('/ai-generator', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), productController_1.getAiProductSuggestions);
router.get('/sku/:sku', productController_1.getProductBySku);
router.get('/:id', productController_1.getProductById);
// Seller/Admin only routes for product creation & edit
router.post('/', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), multer_1.productUpload, vendorCategoryAccessMiddleware_1.assertVendorCategoryAccess, vendorCategoryAccessMiddleware_1.validateCategoryProductPayload, productController_1.createProduct);
router.put('/:id', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), multer_1.productUpload, vendorCategoryAccessMiddleware_1.assertVendorCategoryAccess, vendorCategoryAccessMiddleware_1.validateCategoryProductPayload, productController_1.updateProduct);
router.post('/:id/duplicate', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), vendorCategoryAccessMiddleware_1.assertVendorCategoryAccess, productController_1.duplicateProduct);
router.patch('/:id/archive', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), productController_1.archiveProduct);
router.delete('/:id', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), productController_1.deleteProduct);
router.post('/bulk-update', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer', 'admin'), productController_1.bulkUpdateProducts);
router.get('/inventory/movements', auth_1.protect, productController_1.getInventoryMovements);
router.post('/inventory/movements', auth_1.protect, productController_1.createInventoryMovement);
// Admin-only pricing & approval actions
router.post('/admin/bulk-approve', auth_1.protect, (0, auth_1.restrictTo)('admin'), productController_1.bulkApproveProducts);
router.post('/admin/bulk-reject', auth_1.protect, (0, auth_1.restrictTo)('admin'), productController_1.bulkRejectProducts);
router.patch('/:id/admin-pricing', auth_1.protect, (0, auth_1.restrictTo)('admin'), productController_1.configureAdminPricing);
router.patch('/:id/quick-approve-edit', auth_1.protect, (0, auth_1.restrictTo)('admin'), productController_1.quickApproveVendorEdit);
router.patch('/:id/reject', auth_1.protect, (0, auth_1.restrictTo)('admin'), productController_1.rejectProduct);
// Seller-specific pricing acceptance/negotiation
router.patch('/:id/seller-accept-pricing', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer'), productController_1.sellerAcceptPricing);
router.patch('/:id/seller-negotiate-pricing', auth_1.protect, (0, auth_1.restrictTo)('vendor', 'wholesaler', 'manufacturer'), productController_1.sellerNegotiatePricing);
exports.default = router;
