import mongoose from "mongoose";
import dotenv from "dotenv";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    const wallet = await Wallet.findOne({ userId: "6a38ef418e32ff38d7cc4503" });
    console.log(JSON.stringify(wallet, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
