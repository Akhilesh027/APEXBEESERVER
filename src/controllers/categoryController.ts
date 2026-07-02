import { Request, Response } from 'express';
import streamifier from 'streamifier';
import Category from '../models/Category';
import cloudinary from '../config/cloudinary';

const makeSlug = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const parseArray = (value: any): string[] => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const parseAttributes = (value: any) => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const uploadToCloudinary = async (
  buffer: Buffer,
  folder: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error || !result) return reject(error);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

const buildTree = (categories: any[]) => {
  const map: Record<string, any> = {};
  const tree: any[] = [];

  categories.forEach((cat) => {
    map[cat._id.toString()] = {
      ...cat,
      id: cat._id.toString(),
      children: [],
    };
  });

  categories.forEach((cat) => {
    const parentId = cat.parentId?.toString();
    const id = cat._id.toString();

    if (parentId && map[parentId]) {
      map[parentId].children.push(map[id]);
    } else {
      tree.push(map[id]);
    }
  });

  return tree;
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      parentId,
      isActive,
      sortOrder,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    let level: 1 | 2 | 3 = 1;

    if (parentId) {
      const parent = await Category.findById(parentId);

      if (!parent) {
        return res.status(404).json({ message: 'Parent category not found' });
      }

      if (parent.level >= 3) {
        return res.status(400).json({
          message: 'Only 3 levels allowed: Category, SubCategory, ChildCategory',
        });
      }

      level = (parent.level + 1) as 1 | 2 | 3;
    }

    const slugBase = makeSlug(name);
    let slug = slugBase;
    let count = 1;

    while (await Category.exists({ slug })) {
      slug = `${slugBase}-${count}`;
      count++;
    }

    const files = req.files as {
      image?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    };

    let image = '';
    let banner = '';

    if (files?.image?.[0]) {
      image = await uploadToCloudinary(
        files.image[0].buffer,
        'apexbee/categories/images'
      );
    }

    if (files?.banner?.[0]) {
      banner = await uploadToCloudinary(
        files.banner[0].buffer,
        'apexbee/categories/banners'
      );
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description || '',
      parentId: parentId || null,
      level,
      image,
      banner,
      brands: parseArray(req.body.brands),
      attributes: parseAttributes(req.body.attributes),
      isActive: isActive === 'false' ? false : true,
      sortOrder: Number(sortOrder) || 0,
    });

    res.status(201).json({
      message: 'Category created successfully',
      category,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to create category',
      error: error.message,
    });
  }
};

export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find()
      .populate('parentId', 'name slug level')
      .sort({ level: 1, sortOrder: 1, createdAt: -1 });

    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch categories',
      error: error.message,
    });
  }
};

export const getCategoryTree = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    res.json({ categories: buildTree(categories) });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch category tree',
      error: error.message,
    });
  }
};

export const getCategoryDropdown = async (_req: Request, res: Response) => {
  try {
    const categories = await Category.find({ isActive: true })
      .select('name slug parentId level image attributes brands')
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    res.json({ categories: buildTree(categories) });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch dropdown categories',
      error: error.message,
    });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      'parentId',
      'name slug level'
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ category });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch category',
      error: error.message,
    });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const {
      name,
      description,
      parentId,
      isActive,
      sortOrder,
    } = req.body;

    let level = category.level;

    if (parentId && parentId !== String(category.parentId)) {
      if (parentId === req.params.id) {
        return res.status(400).json({
          message: 'Category cannot be its own parent',
        });
      }

      const parent = await Category.findById(parentId);

      if (!parent) {
        return res.status(404).json({ message: 'Parent category not found' });
      }

      if (parent.level >= 3) {
        return res.status(400).json({
          message: 'Only 3 category levels are allowed',
        });
      }

      level = (parent.level + 1) as 1 | 2 | 3;
    }

    const files = req.files as {
      image?: Express.Multer.File[];
      banner?: Express.Multer.File[];
    };

    if (files?.image?.[0]) {
      category.image = await uploadToCloudinary(
        files.image[0].buffer,
        'apexbee/categories/images'
      );
    }

    if (files?.banner?.[0]) {
      category.banner = await uploadToCloudinary(
        files.banner[0].buffer,
        'apexbee/categories/banners'
      );
    }

    if (name && name.trim() !== category.name) {
      const slugBase = makeSlug(name);
      let slug = slugBase;
      let count = 1;

      while (
        await Category.exists({
          slug,
          _id: { $ne: category._id },
        })
      ) {
        slug = `${slugBase}-${count}`;
        count++;
      }

      category.name = name.trim();
      category.slug = slug;
    }

    category.description = description ?? category.description;
    category.parentId = parentId || null;
    category.level = level;
    category.brands = req.body.brands !== undefined ? parseArray(req.body.brands) : category.brands;
    category.attributes =
      req.body.attributes !== undefined
        ? parseAttributes(req.body.attributes)
        : category.attributes;
    category.isActive =
      isActive === undefined ? category.isActive : isActive === 'true' || isActive === true;
    category.sortOrder =
      sortOrder === undefined ? category.sortOrder : Number(sortOrder) || 0;

    await category.save();

    res.json({
      message: 'Category updated successfully',
      category,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update category',
      error: error.message,
    });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const hasChildren = await Category.exists({
      parentId: req.params.id,
    });

    if (hasChildren) {
      return res.status(400).json({
        message: 'Delete subcategories first before deleting this category',
      });
    }

    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to delete category',
      error: error.message,
    });
  }
};