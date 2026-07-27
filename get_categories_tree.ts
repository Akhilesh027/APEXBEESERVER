import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './src/models/Category';
import Subcategory from './src/models/Subcategory';

dotenv.config();

const getCategoriesTree = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB:', mongoURI);

    const categories = await Category.find().lean();
    const subcategories = await Subcategory.find().lean();

    console.log('\n========================================');
    console.log(`TOTAL CATEGORIES IN DB: ${categories.length}`);
    console.log(`TOTAL SUBCATEGORIES IN DB (Subcategory Model): ${subcategories.length}`);
    console.log('========================================\n');

    // Build hierarchy tree
    const categoryMap: Record<string, any> = {};
    categories.forEach((cat) => {
      categoryMap[cat._id.toString()] = {
        id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        level: cat.level,
        parentId: cat.parentId ? cat.parentId.toString() : null,
        image: cat.image || null,
        banner: cat.banner || null,
        supportedItemTypes: cat.supportedItemTypes || [],
        attributes: cat.attributes || [],
        children: [],
      };
    });

    const rootCategories: any[] = [];
    Object.values(categoryMap).forEach((cat) => {
      if (cat.parentId && categoryMap[cat.parentId]) {
        categoryMap[cat.parentId].children.push(cat);
      } else {
        rootCategories.push(cat);
      }
    });

    console.log('=== HIERARCHICAL CATEGORY TREE (Level 1 -> Level 2 -> Level 3) ===\n');
    const printNode = (node: any, indent = '') => {
      console.log(
        `${indent}• [Level ${node.level || 1}] ${node.name} (ID: ${node.id}, slug: ${node.slug})`
      );
      if (node.supportedItemTypes && node.supportedItemTypes.length > 0) {
        console.log(`${indent}  - Item Types: ${node.supportedItemTypes.join(', ')}`);
      }
      if (node.attributes && node.attributes.length > 0) {
        const attrNames = node.attributes.map((a: any) => a.name || a.key).join(', ');
        console.log(`${indent}  - Attributes: ${attrNames}`);
      }
      if (node.children && node.children.length > 0) {
        node.children.forEach((child: any) => printNode(child, indent + '    '));
      }
    };

    rootCategories.forEach((cat) => printNode(cat));

    if (subcategories.length > 0) {
      console.log('\n=== SUBCATEGORY COLLECTION ENTRIES ===');
      subcategories.forEach((sub) => {
        console.log(`- Subcategory: ${sub.name} (Category Ref: ${sub.categoryId})`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error fetching categories:', error);
    process.exit(1);
  }
};

getCategoriesTree();
