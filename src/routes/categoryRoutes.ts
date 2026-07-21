import express from 'express';
import {
  createCategory,
  getCategories,
  getCategoryTree,
  getCategoryDropdown,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategorySubcategories
} from '../controllers/categoryController';
import { categoryUpload  } from '../middleware/multer';

const router = express.Router();

router.post('/', categoryUpload, createCategory);

router.get('/', getCategories);
router.get('/tree', getCategoryTree);
router.get('/dropdown', getCategoryDropdown);
router.get('/:id', getCategoryById);
router.get('/:id/subcategories', getCategorySubcategories);

router.put('/:id', categoryUpload, updateCategory);

router.delete('/:id', deleteCategory);

export default router;