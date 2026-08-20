import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import Product from '../models/Product';
import StoreProduct from '../models/StoreProduct';

const panIndiaSlugs = [
  // Handcrafted Living & Decor items (Nationwide shipping)
  'rustic-ceramic-planter-bowl-local-test',
  'artisan-macrame-wall-hanging-local-test',
  'handwoven-jute-table-runner-local-test',
  'glazed-ceramic-coffee-mug-ochre-local-test',
  'terracotta-chai-kulhad-6pack-local-test',

  // Non-perishable Farm Commodities & Staples
  'adilabad-farm-fresh-red-chillies-250g',
  'fresh-stone-ground-wheat-atta-5kg'
];

async function updateToPanIndia() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set.');
    return;
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { dbName: process.env.DB_NAME || 'test' });
  console.log('Connected.');

  console.log('\n--- Updating Selected Products to PAN-INDIA (Both Local & Nationwide Delivery) ---');

  for (const slug of panIndiaSlugs) {
    const updatedProd = await Product.findOneAndUpdate(
      { slug },
      {
        $set: {
          deliveryScope: 'both',
          isPanIndia: true,
          isLocalDelivery: true
        }
      },
      { new: true }
    );

    if (updatedProd) {
      console.log(`✅ Updated Product: "${updatedProd.name}" -> isPanIndia: true, deliveryScope: both`);

      // Also update matching StoreProduct if exists
      await StoreProduct.updateMany(
        { productId: updatedProd._id },
        {
          $set: {
            deliveryScope: 'both',
            isPanIndia: true,
            isLocalDelivery: true
          }
        }
      );
    } else {
      console.log(`⚠️ Product with slug "${slug}" not found.`);
    }
  }

  console.log('\nPAN-India product updates applied successfully!');
  await mongoose.disconnect();
}

updateToPanIndia()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error updating products:', err);
    process.exit(1);
  });
