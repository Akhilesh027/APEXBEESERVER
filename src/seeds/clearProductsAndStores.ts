import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product';
import StoreProduct from '../models/StoreProduct';
import Inventory from '../models/Inventory';
import { Vendor } from '../models/Vendor';
import { BusinessApplication } from '../models/BusinessApplication';
import VendorCategoryAccess from '../models/VendorCategoryAccess';

dotenv.config();

async function clearProductsAndStores() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('Connecting to MongoDB:', mongoURI);

  await mongoose.connect(mongoURI);

  try {
    const prodRes = await Product.deleteMany({});
    console.log(`Deleted ${prodRes.deletedCount} products from Product collection.`);

    const storeProdRes = await StoreProduct.deleteMany({});
    console.log(`Deleted ${storeProdRes.deletedCount} store products from StoreProduct collection.`);

    const invRes = await Inventory.deleteMany({});
    console.log(`Deleted ${invRes.deletedCount} inventory records from Inventory collection.`);

    const vendorRes = await Vendor.deleteMany({});
    console.log(`Deleted ${vendorRes.deletedCount} vendor/store profiles from Vendor collection.`);

    const appRes = await BusinessApplication.deleteMany({});
    console.log(`Deleted ${appRes.deletedCount} applications from BusinessApplication collection.`);

    const accessRes = await VendorCategoryAccess.deleteMany({});
    console.log(`Deleted ${accessRes.deletedCount} access records from VendorCategoryAccess collection.`);

    console.log('All products, store products, inventory records, vendor stores, applications, and access rights have been completely removed!');
  } catch (error: any) {
    console.error('Error clearing products and stores:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

clearProductsAndStores();
