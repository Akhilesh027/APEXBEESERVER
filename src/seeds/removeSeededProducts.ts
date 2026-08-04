import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import StoreProduct from '../models/StoreProduct';
import Inventory from '../models/Inventory';
import ProductVariant from '../models/ProductVariant';
import SearchDocument from '../models/SearchDocument';

dotenv.config();

export async function removeSeededProducts() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('Connecting to MongoDB:', mongoURI);

  await mongoose.connect(mongoURI);

  try {
    const deleteAll = process.argv.includes('--all');
    let filter: any = {
      $or: [
        { sku: /^SEED-/i },
        { sku: /^DEMO-SEED-/i },
        { sku: /^SKU-DEV-/i },
        { slug: /^seed-/i },
        { slug: /^dev-store-/i },
        { slug: /^store-/i },
        { seedKey: { $exists: true } },
        { catalogueSource: 'system' },
        { isCatalogueMaster: true },
        { brand: 'ApexBee Prime' },
        { name: /^Premium /i }
      ]
    };

    if (deleteAll) {
      filter = {};
      console.log('Mode: Deleting ALL products in database (--all specified)');
    } else {
      console.log('Mode: Deleting SEEDED products and catalogue masters');
    }

    const seededProducts = await Product.find(filter).select('_id');
    const productIds = seededProducts.map(p => p._id);

    console.log(`Found ${productIds.length} products to remove.`);

    if (productIds.length > 0) {
      const prodRes = await Product.deleteMany({ _id: { $in: productIds } });
      console.log(`Deleted ${prodRes.deletedCount} products from Product collection.`);

      const storeProdRes = await StoreProduct.deleteMany({ productId: { $in: productIds } });
      console.log(`Deleted ${storeProdRes.deletedCount} store products.`);

      const invRes = await Inventory.deleteMany({ productId: { $in: productIds } });
      console.log(`Deleted ${invRes.deletedCount} inventory records.`);

      const varRes = await ProductVariant.deleteMany({ productId: { $in: productIds } });
      console.log(`Deleted ${varRes.deletedCount} product variants.`);

      const searchRes = await SearchDocument.deleteMany({ entityId: { $in: productIds } });
      console.log(`Deleted ${searchRes.deletedCount} search documents.`);
    }

    console.log('Seeded products cleanup completed successfully!');
  } catch (error: any) {
    console.error('Error removing seeded products:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  removeSeededProducts();
}
