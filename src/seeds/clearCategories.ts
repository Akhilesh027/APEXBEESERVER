import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

dotenv.config();

async function clearAllCategories() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('Connecting to MongoDB:', mongoURI);

  await mongoose.connect(mongoURI);

  try {
    const catResult = await Category.deleteMany({});
    console.log(`Successfully deleted ${catResult.deletedCount} category documents from Category collection.`);

    const schemaResult = await CategoryProductSchema.deleteMany({});
    console.log(`Successfully deleted ${schemaResult.deletedCount} category product schema documents from CategoryProductSchema collection.`);

    console.log('All categories and category product schemas have been completely removed from the database!');
  } catch (error: any) {
    console.error('Error removing categories:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

clearAllCategories();
