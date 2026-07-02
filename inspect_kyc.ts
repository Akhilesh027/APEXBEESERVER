import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ServiceProviderKyc } from './src/models/ServiceProviderKyc';
import { ServiceProvider } from './src/models/ServiceProvider';

dotenv.config();

const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  console.log('Connecting to:', mongoURI);
  await mongoose.connect(mongoURI);
  console.log('Connected.');

  const kycs = await ServiceProviderKyc.find();
  console.log(`Found ${kycs.length} KYC records.`);
  for (const kyc of kycs) {
    console.log('KYC ID:', kyc._id);
    console.log('providerId:', kyc.providerId);
    console.log('verificationStatus:', kyc.verificationStatus);
    console.log('aadhaarFront:', kyc.aadhaarFront);
    console.log('panCard:', kyc.panCard);
    console.log('documents:', JSON.stringify(kyc.documents, null, 2));
    console.log('----------------------------');
  }

  const providers = await ServiceProvider.find();
  console.log(`Found ${providers.length} ServiceProvider records.`);
  for (const p of providers) {
    console.log('Provider Code:', p.providerCode);
    console.log('UserId:', p.userId);
    console.log('BusinessName:', p.businessName);
    console.log('Documents:', JSON.stringify(p.documents, null, 2));
    console.log('============================');
  }

  await mongoose.disconnect();
};

run();
