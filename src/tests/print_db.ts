import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { CommissionSettlement } from '../models/CommissionSettlement';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to DB.");

  const settlements = await CommissionSettlement.find();
  console.log("\n=== DETAILED COMMISSION SETTLEMENTS ===");
  settlements.forEach(s => {
    console.log(JSON.stringify(s.toObject(), null, 2));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
