import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import Category from '../models/Category';
import { User } from '../models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

const populateProduct = (query: any) => {
  return query
    .populate('sellerId', 'name email mobile phone roles sellerProfile')
    .populate('categoryId', 'name slug level brands attributes')
    .populate('subCategoryId', 'name slug level brands attributes')
    .populate('childCategoryId', 'name slug level brands attributes');
};

async function testQuery() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const sellerId = '6a44c7ec1b05eb2b5d6a3686'; // from the user's error trace

    console.log('Running query for sellerId:', sellerId);
    
    const query = Product.find({ sellerId });
    const populated = populateProduct(query);
    const sorted = populated.sort({ createdAt: -1 });
    
    const products = await sorted;
    console.log('Query succeeded! Found products count:', products.length);
  } catch (error: any) {
    console.error('Query failed with error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testQuery();
