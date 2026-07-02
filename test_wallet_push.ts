import mongoose from "mongoose";
import dotenv from "dotenv";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    const wallets = await Wallet.find({});
    console.log(`Found ${wallets.length} wallets.`);
    for (const w of wallets) {
      console.log(`Wallet ID: ${w._id}, userId: ${w.userId}, userId constructor: ${w.userId?.constructor?.name}, type: ${typeof w.userId}`);
      if (w.userId && w.userId.toString() === "6a34ebbc35363fae65b72216") {
        console.log("Found matching wallet using toString() comparison!");
        
        // Let's try to query it using findOne with ObjectId
        const w2 = await Wallet.findOne({ userId: w.userId });
        console.log("Query with w.userId found:", !!w2);
        
        const w3 = await Wallet.findOne({ userId: new mongoose.Types.ObjectId("6a34ebbc35363fae65b72216") });
        console.log("Query with Types.ObjectId found:", !!w3);

        const w4 = await Wallet.findOne({ userId: "6a34ebbc35363fae65b72216" });
        console.log("Query with string found:", !!w4);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
