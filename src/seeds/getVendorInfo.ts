import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Vendor } from '../models/Vendor';
import { User } from '../models/User';
import { VendorSubscription } from '../modules/subscription/models/VendorSubscription';

dotenv.config();

async function getVendorInfo() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  await mongoose.connect(mongoURI);

  try {
    const email = 'akhil@gmail.com';
    console.log(`Searching for email: ${email}`);

    const user = await User.findOne({ email });
    console.log('\n--- USER RECORD ---');
    console.log(user ? JSON.stringify(user, null, 2) : 'User not found in User collection');

    let vendor = null;
    if (user) {
      vendor = await Vendor.findOne({ $or: [{ userId: user._id }, { email }] });
    } else {
      vendor = await Vendor.findOne({ email });
    }

    console.log('\n--- VENDOR RECORD ---');
    console.log(vendor ? JSON.stringify(vendor, null, 2) : 'Vendor not found in Vendor collection');

    if (vendor) {
      const sub = await VendorSubscription.findOne({ vendorId: vendor._id });
      console.log('\n--- SUBSCRIPTION RECORD ---');
      console.log(sub ? JSON.stringify(sub, null, 2) : 'No VendorSubscription record found');
    }
  } catch (err: any) {
    console.error('Error fetching vendor info:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

getVendorInfo();
