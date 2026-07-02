import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./src/models/Product";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    const product = await Product.findOne({});
    console.log(JSON.stringify(product?.adminPricing, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
