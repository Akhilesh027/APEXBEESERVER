"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAnyDisk = exports.localSingleImageUpload = exports.singleImageUpload = exports.productUpload = exports.categoryUpload = exports.uploadMemory = exports.uploadDisk = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(__dirname, '../../../public/uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
];
const imageFileFilter = (_req, file, cb) => {
    if (!allowedImageTypes.includes(file.mimetype)) {
        return cb(new Error('Only JPG, PNG, and WEBP image files are allowed'));
    }
    cb(null, true);
};
const diskStorage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const safeName = file.originalname
            .replace(path_1.default.extname(file.originalname), '')
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9-_]/g, '')
            .toLowerCase();
        cb(null, `${file.fieldname}-${safeName}-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
const memoryStorage = multer_1.default.memoryStorage();
exports.uploadDisk = (0, multer_1.default)({
    storage: diskStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024,
    },
});
exports.uploadMemory = (0, multer_1.default)({
    storage: memoryStorage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024,
    },
});
exports.categoryUpload = exports.uploadMemory.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
]);
exports.productUpload = exports.uploadMemory.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'images', maxCount: 10 },
]);
exports.singleImageUpload = exports.uploadMemory.single('image');
exports.localSingleImageUpload = exports.uploadDisk.single('image');
exports.uploadAnyDisk = (0, multer_1.default)({
    storage: diskStorage,
    limits: {
        fileSize: 25 * 1024 * 1024,
    },
});
