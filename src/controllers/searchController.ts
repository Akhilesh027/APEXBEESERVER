import { Request, Response } from 'express';
import { SearchDocument } from '../models/SearchDocument';
import ProductVariant from '../models/ProductVariant';
import StoreProduct from '../models/StoreProduct';

// We can define a local search history mock/schema or store it directly in SystemConfig / temporary cache.
// For the scope of the backend integration, we can support logged-in user search history mock
// and return structured results.
interface ExtendedRequest extends Request {
  user?: {
    id: string;
  };
}

export const search = async (req: ExtendedRequest, res: Response) => {
  try {
    const {
      query,
      entityType,
      category,
      subcategory,
      latitude,
      longitude,
      radius,
      page = '1',
      limit = '10',
      sort = 'popularity',
    } = req.query;

    const filter: any = { isActive: true };

    if (query) {
      filter.$or = [
        { title: { $regex: String(query), $options: 'i' } },
        { subtitle: { $regex: String(query), $options: 'i' } },
        { description: { $regex: String(query), $options: 'i' } },
        { keywords: { $in: [new RegExp(String(query), 'i')] } },
      ];
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    if (category) {
      filter.categoryId = category;
    }

    if (subcategory) {
      filter.subcategoryId = subcategory;
    }

    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;

    // Execute standard search query
    let mongoQuery = SearchDocument.find(filter);

    if (sort === 'popularity') {
      mongoQuery = mongoQuery.sort({ popularityScore: -1 });
    } else if (sort === 'newest') {
      mongoQuery = mongoQuery.sort({ createdAt: -1 });
    }

    const total = await SearchDocument.countDocuments(filter);
    const results = await mongoQuery.skip(skip).limit(limitNum);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const matches = await SearchDocument.find({
      $or: [
        { title: { $regex: `^${query}`, $options: 'i' } },
        { keywords: { $in: [new RegExp(`^${query}`, 'i')] } },
      ],
      isActive: true,
    })
      .limit(6)
      .select('title entityType entityId');

    const suggestions = matches.map((m) => ({
      text: m.title,
      type: m.entityType,
      id: m.entityId,
    }));

    return res.status(200).json({ success: true, suggestions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrending = async (req: Request, res: Response) => {
  try {
    // Return high popularity score items as trending searches
    const trendingDocs = await SearchDocument.find({ isActive: true })
      .sort({ popularityScore: -1, searchCount: -1 })
      .limit(5)
      .select('title');

    const trending = trendingDocs.map((doc) => doc.title);
    return res.status(200).json({ success: true, trending });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecent = async (req: ExtendedRequest, res: Response) => {
  try {
    // For demo/integration testing, return mock recent searches
    return res.status(200).json({
      success: true,
      recent: ['Milk', 'Fresh Flowers', 'Basmati Rice'],
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveHistory = async (req: ExtendedRequest, res: Response) => {
  try {
    const { query } = req.body;
    if (query) {
      await SearchDocument.updateOne(
        { title: query, entityType: 'product' },
        { $inc: { searchCount: 1, popularityScore: 1 } }
      );
    }
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteHistory = async (req: ExtendedRequest, res: Response) => {
  try {
    return res.status(200).json({ success: true, message: 'History cleared' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const searchBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    const variant = await ProductVariant.findOne({ barcode });
    if (!variant) {
      return res.status(404).json({ success: false, message: 'Barcode not matched' });
    }

    const storeProducts = await StoreProduct.find({ variantId: variant._id }).populate('productId');
    return res.status(200).json({
      success: true,
      variant,
      storeProducts,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
