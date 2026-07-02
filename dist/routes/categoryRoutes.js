"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const categoryController_1 = require("../controllers/categoryController");
const multer_1 = require("../middleware/multer");
const router = express_1.default.Router();
router.post('/', multer_1.categoryUpload, categoryController_1.createCategory);
router.get('/', categoryController_1.getCategories);
router.get('/tree', categoryController_1.getCategoryTree);
router.get('/dropdown', categoryController_1.getCategoryDropdown);
router.get('/:id', categoryController_1.getCategoryById);
router.put('/:id', multer_1.categoryUpload, categoryController_1.updateCategory);
router.delete('/:id', categoryController_1.deleteCategory);
exports.default = router;
