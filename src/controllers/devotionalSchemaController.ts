import { Request, Response } from 'express';
import { resolveCategorySchema } from '../services/devotional/schemaResolutionService';
import CategoryProductSchema from '../models/CategoryProductSchema';

// GET /api/category-schemas/:categoryId/resolved
export const getResolvedCategorySchema = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    if (!categoryId) {
      res.status(400).json({ success: false, message: 'Category ID is required' });
      return;
    }

    const resolvedSchema = await resolveCategorySchema(categoryId);
    res.status(200).json({
      success: true,
      data: resolvedSchema,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      message: 'Failed to resolve category product schema',
      error: error.message,
    });
  }
};

// GET /api/admin/category-schemas
export const getAllCategorySchemas = async (req: Request, res: Response): Promise<void> => {
  try {
    const schemas = await CategoryProductSchema.find().populate('categoryId', 'name slug level');
    res.status(200).json({
      success: true,
      data: schemas,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to fetch category schemas', error: error.message });
  }
};

// POST /api/admin/category-schemas
export const createOrUpdateCategorySchema = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, attributes, productMode, inventoryPolicy, deliveryPolicy, isChildOverride } = req.body;

    const schema = await CategoryProductSchema.findOneAndUpdate(
      { categoryId },
      {
        $set: {
          categoryId,
          attributes,
          productMode,
          inventoryPolicy,
          deliveryPolicy,
          isChildOverride: isChildOverride || false,
          schemaVersion: 1,
          isPublished: true,
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Category product schema saved successfully',
      data: schema,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to save category product schema', error: error.message });
  }
};
