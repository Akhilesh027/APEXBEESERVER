import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './src/models/User';
import { DeliveryPartner } from './src/models/DeliveryPartner';
import { Wallet } from './src/models/Wallet';

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('MONGODB_URI not set');
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log('Connected to DB');

    const phoneNumbers = ['9550379505', '9908587023', '9705757757'];

    for (const phone of phoneNumbers) {
      const user = await User.findOne({ phone });
      if (!user) {
        console.log(`User not found for phone ${phone}`);
        continue;
      }
      
      console.log(`Found user ${user.name} (${user.email}) for phone ${phone}`);

      let partner = await DeliveryPartner.findOne({ userId: user._id });
      if (!partner) {
        console.log(`DeliveryPartner profile not found for user ${user.name}. Creating one...`);
        partner = new DeliveryPartner({
          userId: user._id,
          name: user.name,
          mobile: user.phone,
          email: user.email,
          status: 'offline',
          partnerType: 'Freelancer',
          vehicle: {
            type: 'Bike',
            number: 'MH-12-AB-' + Math.floor(1000 + Math.random() * 9000),
            rcNumber: 'RC-' + Math.floor(100000 + Math.random() * 900000),
            drivingLicense: 'DL-' + Math.floor(100000 + Math.random() * 900000)
          },
          ratings: {
            customerRating: 4.8,
            vendorRating: 4.9,
            adminRating: 4.7,
            averageRating: 4.8
          },
          fixedSalary: 0,
          dailyTarget: 8,
          deliveriesCount: 15
        });
        await partner.save();
        console.log(`DeliveryPartner profile created for ${user.name}`);
      } else {
        console.log(`DeliveryPartner profile already exists for ${user.name}. Status: ${partner.status}`);
        // Ensure status is offline or active so it's not suspended
        if (partner.status === 'suspended') {
          partner.status = 'offline';
          await partner.save();
          console.log(`Updated status of suspended partner ${user.name} to offline.`);
        }
      }

      // Check if wallet exists
      let wallet = await Wallet.findOne({ userId: user._id });
      if (!wallet) {
        console.log(`Creating wallet for user ${user.name}`);
        wallet = new Wallet({
          userId: user._id,
          availableBalance: 750.00,
          pendingBalance: 0,
          withdrawnBalance: 0,
          totalCredits: 750.00,
          totalDebits: 0,
          ledgerEntries: [
            {
              transactionId: new mongoose.Types.ObjectId().toString(),
              type: 'credit',
              amount: 750.00,
              description: 'Initial Wallet Balance',
              status: 'released',
              referenceType: 'SYSTEM',
              createdAt: new Date()
            }
          ]
        });
        await wallet.save();
        console.log(`Wallet created for user ${user.name}`);
      } else {
        console.log(`Wallet already exists for user ${user.name}. Balance: ₹${wallet.availableBalance}`);
      }
      console.log('------------------------------------');
    }

    await mongoose.disconnect();
    console.log('Disconnected from DB. Done!');
    process.exit(0);
  } catch (err) {
    console.error('Error running script:', err);
    process.exit(1);
  }
};

run();
