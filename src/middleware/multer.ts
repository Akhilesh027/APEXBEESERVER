import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../../public/uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedImageTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (!allowedImageTypes.includes(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP image files are allowed'));
  }

  cb(null, true);
};

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeName = file.originalname
      .replace(path.extname(file.originalname), '')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '')
      .toLowerCase();

    cb(
      null,
      `${file.fieldname}-${safeName}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});

const memoryStorage = multer.memoryStorage();

export const uploadDisk = multer({
  storage: diskStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export const uploadMemory = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

export const categoryUpload = uploadMemory.fields([
  { name: 'image', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);

export const productUpload = uploadMemory.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 10 },
]);

export const singleImageUpload = uploadMemory.single('image');

export const localSingleImageUpload = uploadDisk.single('image');

export const uploadAnyDisk = multer({
  storage: diskStorage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

