import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Vendor } from '../models/Vendor';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function cleanVendorLocations() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Vendor.updateMany(
      { 
        $or: [
          { 'location.coordinates': { $exists: false } },
          { 'location.coordinates': { $size: 0 } },
          { 'location.coordinates': null }
        ]
      },
      { $unset: { location: "" } }
    );
    console.log(`Cleaned ${result.modifiedCount} vendor documents by removing invalid location properties.`);
  } catch (error) {
    console.error('Error cleaning vendor locations:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanVendorLocations();
