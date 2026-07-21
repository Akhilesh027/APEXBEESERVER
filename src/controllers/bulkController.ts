import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import ProductVariant from '../models/ProductVariant';
import StoreProduct from '../models/StoreProduct';
import Inventory from '../models/Inventory';
import Category from '../models/Category';
import Subcategory from '../models/Subcategory';
import { Vendor } from '../models/Vendor';
import { User } from '../models/User';

// 1. GET /api/admin/bulk/products/export
export const exportProductsCSV = async (req: Request, res: Response) => {
  try {
    const products = await Product.find()
      .populate('categoryId', 'name')
      .populate('subcategoryId', 'name');

    const headers = [
      'Product ID',
      'Name',
      'Slug',
      'Description',
      'Category Name',
      'Subcategory Name',
      'Brand',
      'Is Active'
    ];

    let csvContent = headers.join(',') + '\n';

    for (const prod of products) {
      const categoryName = (prod.categoryId as any)?.name || 'N/A';
      const subcategoryName = (prod.subcategoryId as any)?.name || 'N/A';

      const row = [
        prod._id.toString(),
        `"${prod.name.replace(/"/g, '""')}"`,
        `"${prod.slug}"`,
        `"${(prod.description || '').replace(/"/g, '""')}"`,
        `"${categoryName}"`,
        `"${subcategoryName}"`,
        `"${prod.brand || ''}"`,
        prod.isActive ? 'TRUE' : 'FALSE'
      ];

      csvContent += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=ApexBee_Products_Export.csv');
    return res.status(200).send(csvContent);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to parse simple CSV line
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// 2. POST /api/admin/bulk/products/import
export const importProductsCSV = async (req: Request, res: Response) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ success: false, message: 'CSV raw string data is required in csvData parameter.' });
    }

    const lines = csvData.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, message: 'CSV data must contain header row and at least one item row.' });
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_]+/g, ''));
    
    // Expect columns: name, description, category, subcategory, price, stock
    const nameIndex = headers.indexOf('name');
    const descIndex = headers.indexOf('description');
    const categoryIndex = headers.indexOf('category');
    const subcategoryIndex = headers.indexOf('subcategory');
    const priceIndex = headers.indexOf('price');
    const stockIndex = headers.indexOf('stock');

    if (nameIndex === -1 || categoryIndex === -1 || subcategoryIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'CSV headers must contain at least "name", "category", and "subcategory". Available headers: ' + lines[0]
      });
    }

    let createdCount = 0;
    const errors: string[] = [];

    // Find default store for seeding listings
    let defaultStore = await Vendor.findOne({});
    if (!defaultStore) {
      const seller = await User.findOne({ roles: 'customer' });
      const sellerId = seller ? seller._id : new mongoose.Types.ObjectId();

      defaultStore = await Vendor.create({
        userId: sellerId,
        businessName: 'ApexBee Nellore Superstore',
        businessType: 'retailer',
        panNumber: 'ABCDE1234F',
        gstNumber: '37ABCDE1234F1Z5',
        address: '12/34 Main Bazaar Road, Nellore',
        pincode: '524001',
        marketplaceStatus: 'Approved',
        location: {
          type: 'Point',
          coordinates: [79.9865, 14.4426],
        },
        deliveryMode: 'self_delivery',
        deliveryRadiusKm: 15,
        estimatedDeliveryMinutes: 25,
        minOrder: 150,
        deliveryCharge: 20,
        verifiedBadge: true,
        rating: { average: 4.8, totalReviews: 54 },
        liveStatus: 'open',
      });
    }

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      if (row.length < 3) continue;

      const name = row[nameIndex];
      const description = descIndex > -1 ? row[descIndex] : '';
      const categoryName = row[categoryIndex];
      const subcategoryName = row[subcategoryIndex];
      const price = priceIndex > -1 ? Number(row[priceIndex]) || 100 : 100;
      const stock = stockIndex > -1 ? Number(row[stockIndex]) || 50 : 50;

      if (!name || !categoryName || !subcategoryName) {
        errors.push(`Row ${i}: Missing name, category name, or subcategory name.`);
        continue;
      }

      // Find Category or create
      let category = await Category.findOne({ name: { $regex: new RegExp(`^${categoryName}$`, 'i') } });
      if (!category) {
        const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        category = await Category.create({ name: categoryName, slug, isActive: true, displayOrder: 0 });
      }

      // Find Subcategory or create
      let subcategory = await Subcategory.findOne({ name: { $regex: new RegExp(`^${subcategoryName}$`, 'i') }, categoryId: category._id });
      if (!subcategory) {
        const slug = subcategoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        subcategory = await Subcategory.create({ name: subcategoryName, slug, categoryId: category._id, isActive: true, displayOrder: 0 });
      }

      // Create Product
      const productSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
      const product = new Product({
        categoryId: category._id,
        subcategoryId: subcategory._id,
        name,
        slug: productSlug,
        description,
        isActive: true,
        createdBy: (defaultStore as any).userId || new mongoose.Types.ObjectId(),
        sku: 'SKU-' + name.slice(0, 3).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000)
      });

      await product.save();

      // Create Variant
      const variantSku = 'SKU-' + name.slice(0, 3).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
      const variant = new ProductVariant({
        productId: product._id,
        sku: variantSku,
        name: 'Standard Unit',
        price,
        compareAtPrice: price + Math.round(price * 0.15),
        isActive: true
      });
      await variant.save();

      // Link Store Listing
      await StoreProduct.create({
        productId: product._id,
        storeId: defaultStore._id,
        variantId: variant._id,
        mrp: price + Math.round(price * 0.15),
        sellingPrice: price,
        availableStock: stock,
        isActive: true
      });

      // Create Inventory records
      await Inventory.create({
        storeId: defaultStore._id,
        productId: product._id,
        variantId: variant._id,
        sku: variantSku,
        availableStock: stock,
        reservedStock: 0,
        damagedStock: 0
      });

      createdCount++;
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${createdCount} products from CSV data.`,
      createdCount,
      errors
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
