import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryDropdown,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategorySubcategories,
  getMergedCategoryAttributes,
  seedVendorController,
  seedFullMvpController,
  seedCatalogueCoreController,
  verifyCatalogueCoreController,
  seedDailyNeedsController,
  verifyDailyNeedsController,
  seedShoppingController,
  verifyShoppingController,
  seedServicesController,
  verifyServicesController,
  seedAcademyController,
  verifyAcademyController,
  applyAttributePreset,
} from '../controllers/categoryController';
import { categoryUpload } from '../middleware/multer';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

import { verifyCoreTaxonomies } from '../seeds/seedCoreTaxonomies';

const router = express.Router();

router.get('/seed-vendor', seedVendorController);
router.post('/seed-vendor', seedVendorController);
router.get('/seed-full-mvp', seedFullMvpController);
router.post('/seed-full-mvp', seedFullMvpController);
router.get('/seed-catalogue-core', seedCatalogueCoreController);
router.post('/seed-catalogue-core', seedCatalogueCoreController);
router.get('/verify-catalogue-core', async (_req, res) => {
  try {
    const result = await verifyCoreTaxonomies();
    res.status(200).json({ success: true, message: 'Catalogue Core verification completed', result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/seed-daily-needs', seedDailyNeedsController);
router.post('/seed-daily-needs', seedDailyNeedsController);
router.get('/verify-daily-needs', verifyDailyNeedsController);

router.get('/seed-shopping', seedShoppingController);
router.post('/seed-shopping', seedShoppingController);
router.get('/verify-shopping', verifyShoppingController);

router.get('/seed-services', seedServicesController);
router.post('/seed-services', seedServicesController);
router.get('/verify-services', verifyServicesController);

router.get('/seed-academy', seedAcademyController);
router.post('/seed-academy', seedAcademyController);
router.get('/verify-academy', verifyAcademyController);


router.post('/', categoryUpload, createCategory);

router.get('/', getCategories);
router.get('/tree', getCategoryTree);
router.get('/dropdown', getCategoryDropdown);
router.get('/:id', getCategoryById);
router.get('/:id/subcategories', getCategorySubcategories);
router.get('/:id/merged-attributes', getMergedCategoryAttributes);

router.post('/:id/apply-preset', applyAttributePreset);

router.put('/:id', categoryUpload, updateCategory);

router.delete('/:id', deleteCategory);

export default router;