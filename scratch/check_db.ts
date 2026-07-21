import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../src/models/Category";
import { Course } from "../src/models/Course";
import { ServiceProvider } from "../src/models/ServiceProvider";

dotenv.config();

const check = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
  await mongoose.connect(uri);
  const categories = await Category.find({});
  console.log(`[Check DB] Categories Count: ${categories.length}`);
  categories.forEach(c => console.log(`- ${c.name} (${c.slug})`));

  const courses = await Course.find({});
  console.log(`[Check DB] Courses Count: ${courses.length}`);
  
  const providers = await ServiceProvider.find({});
  console.log(`[Check DB] Service Providers Count: ${providers.length}`);

  await mongoose.disconnect();
};

check();
