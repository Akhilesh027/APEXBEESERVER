import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';
import CategoryProductSchema from '../models/CategoryProductSchema';

dotenv.config();

export const cleanDailyNeeds = async () => {
  const parent = await Category.findOne({ slug: 'daily-needs', level: 1 });
  if (!parent) {
    return { error: 'No daily-needs parent' };
  }

  const subcategories = await Category.find({ parentId: parent._id, level: 2 });
  const details: any[] = [];
  let deletedCount = 0;

  for (const sub of subcategories) {
    const children = await Category.find({ parentId: sub._id, level: 3 });
    const subDetails: any[] = [];
    for (const child of children) {
      const isLegacy = !child.slug.startsWith(sub.slug);
      subDetails.push({
        name: child.name,
        slug: child.slug,
        id: child._id,
        isLegacy,
      });

      if (isLegacy) {
        await CategoryProductSchema.deleteMany({ categoryId: child._id });
        await Category.deleteOne({ _id: child._id });
        deletedCount++;
      }
    }
    details.push({
      subName: sub.name,
      subSlug: sub.slug,
      children: subDetails,
    });
  }

  return { deletedCount, details };
};

const runDirect = async () => {
  if (require.main === module) {
    try {
      const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
      await mongoose.connect(mongoURI);
      await cleanDailyNeeds();
      process.exit(0);
    } catch (err: any) {
      console.error(err.message);
      process.exit(1);
    }
  }
};

runDirect();

