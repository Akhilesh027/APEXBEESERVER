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
  applyAttributePreset,
} from '../controllers/categoryController';
import { categoryUpload } from '../middleware/multer';

const router = express.Router();

router.get('/seed-vendor', seedVendorController);
router.post('/seed-vendor', seedVendorController);
router.get('/seed-full-mvp', seedFullMvpController);
router.post('/seed-full-mvp', seedFullMvpController);

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