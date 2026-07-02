import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Territory } from '../models/Territory';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function deleteTerritories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Territory.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} territories from the database.`);
  } catch (error) {
    console.error('Error deleting territories:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deleteTerritories();
