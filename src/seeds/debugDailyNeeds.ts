import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';

dotenv.config();

const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
  await mongoose.connect(mongoURI);

  const parent = await Category.findOne({ slug: 'daily-needs' });
  console.log('Daily Needs Parent:', parent);

  if (parent) {
    const subcategories = await Category.find({ parentId: parent._id, level: 2 });
    console.log(`Subcategories count: ${subcategories.length}`);
    for (const sub of subcategories) {
      const childDocs = await Category.find({ parentId: sub._id, level: 3 });
      console.log(`  Subcategory: ${sub.name} (ID: ${sub._id}, Slug: ${sub.slug}) has ${childDocs.length} children.`);
      for (const child of childDocs) {
        console.log(`    Child: ${child.name} (Slug: ${child.slug})`);
      }
    }
  }

  process.exit(0);
};

run();
