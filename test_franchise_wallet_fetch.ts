import mongoose from "mongoose";
import dotenv from "dotenv";
import { Franchise } from "./src/models/Franchise";
import { WalletEngine } from "./src/services/WalletEngine";

dotenv.config();

const testFetch = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("Connected to MongoDB!");

    // Test for a state franchise
    const franchise = await Franchise.findOne({ franchiseLevel: "state" });
    if (!franchise) {
      console.log("State franchise profile not found.");
      process.exit(1);
    }
    console.log(`\nFound Franchise Profile: ${franchise.ownerName} (${franchise._id}), User ID: ${franchise.userId}`);

    // Call getOrCreateWallet using Franchise Profile ID
    const wallet = await WalletEngine.getOrCreateWallet(franchise._id);
    console.log(`Retrieved Wallet details using Franchise Profile ID:`);
    console.log(`  Available Balance: ₹${wallet.availableBalance}`);
    console.log(`  Pending Balance:   ₹${wallet.pendingBalance}`);
    console.log(`  Ledger Entries:    ${wallet.ledgerEntries?.length}`);

    if (wallet.availableBalance > 0) {
      console.log("\nSuccess: Available Balance is non-zero (verified)!");
    } else {
      console.log("\nError: Available Balance is still 0.");
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

testFetch();
