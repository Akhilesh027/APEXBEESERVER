import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import ProductVariant from '../models/ProductVariant';

dotenv.config();

export const removeSeededProducts = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoURI);
      console.log('[removeSeededProducts] Connected to MongoDB.');
    }

    // Query seeded products matching seeded SKU patterns or attributes
    const query = {
      $or: [
        { sku: { $regex: /^DEV-/i } },
        { sku: { $regex: /^SEED-/i } },
        { sku: { $regex: /^MOCK-/i } },
        { 'attributes.isSeeded': true },
        { 'attributes.seedKey': { $exists: true } }
      ]
    };

    const seededProducts = await Product.find(query);
    const productIds = seededProducts.map(p => p._id);

    console.log(`[removeSeededProducts] Found ${seededProducts.length} seeded products to remove.`);

    if (productIds.length > 0) {
      const varResult = await ProductVariant.deleteMany({ productId: { $in: productIds } });
      console.log(`[removeSeededProducts] Removed ${varResult.deletedCount} associated product variants.`);

      const prodResult = await Product.deleteMany({ _id: { $in: productIds } });
      console.log(`[removeSeededProducts] Successfully removed ${prodResult.deletedCount} seeded products.`);

      return {
        success: true,
        removedProductsCount: prodResult.deletedCount,
        removedVariantsCount: varResult.deletedCount
      };
    }

    return {
      success: true,
      removedProductsCount: 0,
      removedVariantsCount: 0
    };
  } catch (err: any) {
    console.error('[removeSeededProducts Error]:', err);
    return { success: false, error: err.message };
  }
};

const runCLI = async () => {
  if (require.main === module) {
    const result = await removeSeededProducts();
    console.log('[removeSeededProducts Summary]:', result);
    process.exit(0);
  }
};

runCLI();
