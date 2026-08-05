"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/categoryController");
const multer_1 = require("../middleware/multer");
const seedCoreTaxonomies_1 = require("../seeds/seedCoreTaxonomies");
const router = express_1.default.Router();
router.get('/seed-vendor', categoryController_1.seedVendorController);
router.post('/seed-vendor', categoryController_1.seedVendorController);
router.get('/seed-full-mvp', categoryController_1.seedFullMvpController);
router.post('/seed-full-mvp', categoryController_1.seedFullMvpController);
router.get('/seed-catalogue-core', categoryController_1.seedCatalogueCoreController);
router.post('/seed-catalogue-core', categoryController_1.seedCatalogueCoreController);
router.get('/verify-catalogue-core', async (_req, res) => {
    try {
        const result = await (0, seedCoreTaxonomies_1.verifyCoreTaxonomies)();
        res.status(200).json({ success: true, message: 'Catalogue Core verification completed', result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get('/seed-daily-needs', categoryController_1.seedDailyNeedsController);
router.post('/seed-daily-needs', categoryController_1.seedDailyNeedsController);
router.get('/verify-daily-needs', categoryController_1.verifyDailyNeedsController);
router.get('/seed-shopping', categoryController_1.seedShoppingController);
router.post('/seed-shopping', categoryController_1.seedShoppingController);
router.get('/verify-shopping', categoryController_1.verifyShoppingController);
router.get('/seed-services', categoryController_1.seedServicesController);
router.post('/seed-services', categoryController_1.seedServicesController);
router.get('/verify-services', categoryController_1.verifyServicesController);
router.get('/seed-academy', categoryController_1.seedAcademyController);
router.post('/seed-academy', categoryController_1.seedAcademyController);
router.get('/verify-academy', categoryController_1.verifyAcademyController);
router.post('/', multer_1.categoryUpload, categoryController_1.createCategory);
router.get('/', categoryController_1.getCategories);
router.get('/tree', categoryController_1.getCategoryTree);
router.get('/dropdown', categoryController_1.getCategoryDropdown);
router.get('/attribute-presets', categoryController_1.getAttributePresets);
router.get('/:id', categoryController_1.getCategoryById);
router.get('/:id/subcategories', categoryController_1.getCategorySubcategories);
router.get('/:id/merged-attributes', categoryController_1.getMergedCategoryAttributes);
router.get('/:id/product-schema', categoryController_1.getCategoryProductSchema);
router.put('/:id/product-schema', categoryController_1.upsertCategoryProductSchema);
router.post('/:id/apply-preset', categoryController_1.applyAttributePreset);
router.put('/:id', multer_1.categoryUpload, categoryController_1.updateCategory);
router.delete('/:id', categoryController_1.deleteCategory);
exports.default = router;
