import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../models/User';
import { Franchise } from '../models/Franchise';
import { Wallet } from '../models/Wallet';
import { CommissionSettlement } from '../models/CommissionSettlement';

dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI in env");
    process.exit(1);
  }

  console.log("Connecting to database...");
  await mongoose.connect(uri);
  console.log("Connected successfully.");

  // Check state franchise user (tamsi@gmail.com)
  const user = await User.findOne({ email: 'tamsi@gmail.com' });
  if (!user) {
    console.log("User tamsi@gmail.com not found!");
  } else {
    console.log("User:", {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles
    });

    const franchise = await Franchise.findOne({ userId: user._id });
    if (!franchise) {
      console.log("Franchise profile not found for user!");
    } else {
      console.log("Franchise Profile:", {
        _id: franchise._id.toString(),
        businessName: franchise.businessName,
        ownerName: franchise.ownerName,
        franchiseLevel: franchise.franchiseLevel,
        status: franchise.status
      });

      const wallet = await Wallet.findOne({ userId: franchise._id });
      if (!wallet) {
        console.log("No wallet found for franchise profile ID:", franchise._id.toString());
        // Check if there is a wallet under User._id instead
        const userWallet = await Wallet.findOne({ userId: user._id });
        if (userWallet) {
          console.log("Found wallet under User ID instead!", {
            _id: userWallet._id.toString(),
            availableBalance: userWallet.availableBalance,
            pendingBalance: userWallet.pendingBalance,
            ledgerEntriesCount: userWallet.ledgerEntries.length
          });
        }
      } else {
        console.log("Found wallet under Franchise Profile ID:", {
          _id: wallet._id.toString(),
          availableBalance: wallet.availableBalance,
          pendingBalance: wallet.pendingBalance,
          ledgerEntriesCount: wallet.ledgerEntries.length,
          ledgerEntries: wallet.ledgerEntries.map(e => ({
            id: e.transactionId,
            type: e.type,
            amount: e.amount,
            category: e.category,
            status: e.status
          }))
        });
      }

      const settlements = await CommissionSettlement.find({ recipientId: franchise._id });
      console.log(`Settlements for Franchise Profile ID: ${settlements.length}`, settlements.map(s => ({
        _id: s._id.toString(),
        amount: s.amount,
        status: s.status,
        walletCredited: s.walletCredited
      })));
    }
  }

  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(console.error);
