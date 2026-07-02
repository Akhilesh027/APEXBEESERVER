import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "../config/db";
import { Vendor } from "../models/Vendor";
import Category from "../models/Category";
import Product from "../models/Product";

dotenv.config();

const createProduct = async () => {
  try {
    await connectDB();
    console.log("Connected to Database.");

    // Find the vendor "local milk shop" or any active vendor
    let vendor = await Vendor.findOne({ businessName: /milk/i });
    if (!vendor) {
      vendor = await Vendor.findOne({ status: "active" });
    }

    if (!vendor) {
      console.error("No active vendor found. Please register or seed a vendor first.");
      process.exit(1);
    }

    console.log(`Creating sample product for vendor: ${vendor.businessName} (ID: ${vendor._id})`);

    // Find or create a category "Dairy & Milk"
    let category = await Category.findOne({ name: /Dairy/i });
    if (!category) {
      category = await Category.create({
        name: "Dairy & Milk",
        slug: "dairy-milk",
        status: "active",
        order: 1
      });
      console.log(`Created new category: ${category.name}`);
    }

    // Define product attributes
    const productName = "Fresh Organic Milk (1L)";
    const slug = `fresh-organic-milk-${Date.now().toString().slice(-4)}`;
    const sku = `MILK-${Date.now().toString().slice(-5)}`;

    // Delete existing sample product if it exists
    await Product.deleteOne({ name: productName, sellerId: vendor._id });

    // Create the product
    const product = await Product.create({
      sellerId: vendor._id,
      sellerType: "vendor",
      name: productName,
      slug,
      description: "Creamy, farm-fresh organic milk pasteurized and packaged under absolute hygiene. Contains high proteins, vitamins, and calcium.",
      categoryId: category._id,
      sku,
      images: ["https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600"],
      thumbnail: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600",
      attributes: {
        weight: "1 Litre",
        packaging: "Tetrapack"
      },
      baseMrp: 65,
      discountPercent: 10,
      baseSellingPrice: 58.5,
      stock: 50,
      status: "Live",
      isActive: true,
      isStoreProduct: true,
      isSubscriptionAvailable: true,
      adminPricingApproved: true,
      sellerPricingAccepted: true,
      submittedAt: new Date(),
      liveAt: new Date(),
      variants: [
        {
          sku: `${sku}-V1`,
          attributes: { size: "1L" },
          mrp: 65,
          discountPercent: 10,
          sellingPrice: 58.5,
          stock: 50,
          images: ["https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=600"],
          isActive: true
        }
      ]
    });

    console.log(`\nSample Product Created Successfully!`);
    console.log(`Product Name: ${product.name}`);
    console.log(`SKU: ${product.sku}`);
    console.log(`Selling Price: ₹${product.baseSellingPrice}`);
    console.log(`Associated Vendor: ${vendor.businessName}`);
    console.log(`Category: ${category.name}`);

    process.exit(0);
  } catch (error) {
    console.error("Error creating sample product:", error);
    process.exit(1);
  }
};

createProduct();
