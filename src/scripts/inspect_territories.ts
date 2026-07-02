import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Territory } from '../models/Territory';
import { Franchise } from '../models/Franchise';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';

async function inspectTerritories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Register Franchise schema
    console.log('Franchise model registered:', Franchise.modelName);

    const territories = await Territory.find().populate('franchiseId', 'ownerName businessName');
    console.log('\n--- territories in DB ---');
    territories.forEach((t, idx) => {
      console.log(`[${idx}] Level: ${t.level}, Name: ${t.name}, State: ${t.state}, District: ${t.district}, Mandal: ${t.mandal}, Pincode: ${t.pincode}, franchiseId: ${t.franchiseId ? (t.franchiseId as any).businessName || (t.franchiseId as any).ownerName : 'null'}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectTerritories();
