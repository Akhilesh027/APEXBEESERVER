import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Category from '../models/Category';
import Subcategory from '../models/Subcategory';
import Product from '../models/Product';
import ProductVariant from '../models/ProductVariant';
import StoreProduct from '../models/StoreProduct';
import Inventory from '../models/Inventory';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import SearchDocument from '../models/SearchDocument';

export const seedVendor50Products = async () => {
  console.log('[Seed Vendor 50 Products] Starting process for vendor@gmail.com...');

  // 1. Find or create User with email vendor@gmail.com
  const vendorEmail = 'vendor@gmail.com';
  let user = await User.findOne({ email: vendorEmail });
  if (!user) {
    user = await User.findOne({ phone: '9876543210' });
  }
  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('vendor123', salt);
    user = await User.create({
      name: 'ApexBee Prime Vendor Store',
      email: vendorEmail,
      passwordHash,
      phone: '9876543210',
      mobile: '9876543210',
      roles: ['vendor', 'customer'],
      status: 'active',
      isVerified: true,
      sellerProfile: {
        businessName: 'ApexBee Prime Superstore',
        businessType: 'Vendor',
        gstNumber: '37ABCDE9999F1Z5',
        panNumber: 'ABCDE9999F',
        aadhaarNumber: '999988887777',
        addressText: 'Main Commercial Hub, Nellore, Andhra Pradesh',
        kycStatus: 'Approved'
      }
    });
    console.log(`[Seed Vendor] Created Vendor User: ${vendorEmail}`);
  } else {
    console.log(`[Seed Vendor] Found existing Vendor User: ${user.email} (ID: ${user._id})`);
  }

  // 2. Find or create Vendor Profile
  let vendor = await Vendor.findOne({ userId: user._id });
  if (!vendor) {
    vendor = await Vendor.findOne({ email: vendorEmail });
  }
  if (!vendor) {
    vendor = await Vendor.create({
      userId: user._id,
      businessName: 'ApexBee Prime Superstore',
      ownerName: 'Prime Vendor Manager',
      mobile: user.phone || '9876543210',
      email: vendorEmail,
      address: 'Main Commercial Hub, Nellore, Andhra Pradesh',
      state: 'Andhra Pradesh',
      district: 'Nellore',
      mandal: 'Nellore Urban',
      pincode: '524001',
      status: 'active',
      marketplaceStatus: 'Approved',
      location: {
        type: 'Point',
        coordinates: [79.9865, 14.4426], // Nellore coordinates
      },
      deliveryMode: 'self_delivery',
      deliveryRadiusKm: 25,
      estimatedDeliveryMinutes: 20,
      minOrder: 99,
      deliveryCharge: 15,
      verifiedBadge: true,
      rating: { average: 4.9, totalReviews: 120 },
      liveStatus: 'open',
    });
    console.log('[Seed Vendor] Created Vendor Profile for store.');
  }

  const storeId = vendor._id.toString();
  const sellerId = user._id;

  // 3. Ensure essential Categories & Subcategories exist in DB
  const categoriesData = [
    { name: 'Groceries & Daily Needs', slug: 'groceries-daily-needs', subs: ['Atta, Rice & Dals', 'Fresh Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs', 'Oils & Masalas', 'Snacks & Beverages'] },
    { name: 'Restaurant & Food', slug: 'restaurant-food', subs: ['Biryanis & Rice Dishes', 'South Indian Tiffins', 'North Indian Thali', 'Pizzas & Burgers', 'Desserts & Sweets'] },
    { name: 'Electronics & Mobiles', slug: 'electronics-mobiles', subs: ['Smartphones & Accessories', 'Audio & Headphones', 'Wearables & Smartwatches', 'Home Appliances'] },
    { name: 'Fashion & Lifestyle', slug: 'fashion-lifestyle', subs: ["Men's Wear", "Women's Ethnic", 'Footwear', 'Watches & Accessories'] },
    { name: 'Beauty & Personal Care', slug: 'beauty-personal-care', subs: ['Skin Care', 'Hair Care', 'Fragrances & Deos', 'Grooming & Hygiene'] },
    { name: 'Home & Kitchen', slug: 'home-kitchen', subs: ['Cookware & Serveware', 'Home Decor', 'Storage & Containers'] },
    { name: 'Fresh Flowers & Pooja', slug: 'fresh-flowers-pooja', subs: ['Fresh Flowers', 'Pooja Items & Kits'] }
  ];

  const existingCats = await Category.find({});
  const existingSubs = await Subcategory.find({});

  let defaultCat = existingCats[0];
  if (!defaultCat) {
    defaultCat = await Category.create({
      name: 'General Store',
      slug: 'general-store',
      description: 'Default ApexBee Superstore Category',
      displayOrder: 1,
      isActive: true,
      isFeatured: true
    });
  }

  const catMap: Record<string, any> = {};
  const subMap: Record<string, any> = {};

  for (const cData of categoriesData) {
    let cat = existingCats.find(c => c.slug === cData.slug || c.name.toLowerCase() === cData.name.toLowerCase());
    if (!cat) {
      cat = defaultCat;
    }
    catMap[cData.slug] = cat;

    for (const subName of cData.subs) {
      const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      let sub = existingSubs.find(s => s.slug === subSlug || s.name.toLowerCase() === subName.toLowerCase());
      subMap[`${cData.slug}:${subName}`] = sub || null;
    }
  }

  // 4. Definition of 50 Rich Products
  const productsList = [
    // --- GROCERIES (1-10) ---
    {
      name: 'Premium Sona Masoori Rice (HMT Raw)',
      catSlug: 'groceries-daily-needs',
      subName: 'Atta, Rice & Dals',
      brand: 'ApexHarvest',
      sku: 'VND-RICE-SONA-01',
      baseMrp: 1600,
      discountPercent: 15,
      baseSellingPrice: 1360,
      stock: 150,
      thumbnail: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=800',
      images: [
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?auto=format&fit=crop&q=80&w=800'
      ],
      attributes: { GrainSize: 'Medium', GrainType: 'Raw Rice', Origin: 'Andhra Pradesh', PackType: 'Bag', Organic: 'No' },
      variants: [
        { sku: 'VND-RICE-SONA-25KG', mrp: 1600, discountPercent: 15, sellingPrice: 1360, stock: 80, attributes: { Weight: '25 kg' } },
        { sku: 'VND-RICE-SONA-10KG', mrp: 700, discountPercent: 10, sellingPrice: 630, stock: 70, attributes: { Weight: '10 kg' } }
      ]
    },
    {
      name: 'Desi Organic Toor Dal (Unpolished)',
      catSlug: 'groceries-daily-needs',
      subName: 'Atta, Rice & Dals',
      brand: 'PureFarm',
      sku: 'VND-DAL-TOOR-01',
      baseMrp: 180,
      discountPercent: 10,
      baseSellingPrice: 162,
      stock: 200,
      thumbnail: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&q=80&w=800'],
      attributes: { Type: 'Unpolished', Protein: '22g per 100g', Organic: 'Yes', ShelfLife: '12 Months' },
      variants: [
        { sku: 'VND-DAL-TOOR-1KG', mrp: 180, discountPercent: 10, sellingPrice: 162, stock: 120, attributes: { Weight: '1 kg' } },
        { sku: 'VND-DAL-TOOR-500G', mrp: 95, discountPercent: 5, sellingPrice: 90, stock: 80, attributes: { Weight: '500 g' } }
      ]
    },
    {
      name: 'Farm Fresh Organic Tomatoes (Local Red)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Vegetables',
      brand: 'Nellore Fresh',
      sku: 'VND-VEG-TOMATO-01',
      baseMrp: 40,
      discountPercent: 20,
      baseSellingPrice: 32,
      stock: 300,
      thumbnail: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=800'],
      attributes: { Freshness: 'Harvested Daily', Storage: 'Cool place', Source: 'Local Farmers' },
      variants: [
        { sku: 'VND-VEG-TOM-1KG', mrp: 40, discountPercent: 20, sellingPrice: 32, stock: 200, attributes: { Weight: '1 kg' } },
        { sku: 'VND-VEG-TOM-2KG', mrp: 80, discountPercent: 25, sellingPrice: 60, stock: 100, attributes: { Weight: '2 kg' } }
      ]
    },
    {
      name: 'Fresh Crisp Red Onions (Nashik Quality)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Vegetables',
      brand: 'Nellore Fresh',
      sku: 'VND-VEG-ONION-01',
      baseMrp: 50,
      discountPercent: 15,
      baseSellingPrice: 42,
      stock: 250,
      thumbnail: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=800'],
      attributes: { Variety: 'Red Onion', Origin: 'Nashik', Quality: 'Grade A' },
      variants: [
        { sku: 'VND-VEG-ONI-1KG', mrp: 50, discountPercent: 15, sellingPrice: 42, stock: 150, attributes: { Weight: '1 kg' } },
        { sku: 'VND-VEG-ONI-5KG', mrp: 240, discountPercent: 20, sellingPrice: 192, stock: 100, attributes: { Weight: '5 kg' } }
      ]
    },
    {
      name: 'Sweet Alphonso Mangoes (Devgad Premium)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Fruits',
      brand: 'Royal Orchards',
      sku: 'VND-FRT-MANGO-01',
      baseMrp: 600,
      discountPercent: 20,
      baseSellingPrice: 480,
      stock: 80,
      thumbnail: 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&q=80&w=800'],
      attributes: { Taste: 'Naturally Sweet', PackSize: '6 Pcs Box', Ripening: 'Carbide Free' },
      variants: [
        { sku: 'VND-FRT-MANGO-BOX', mrp: 600, discountPercent: 20, sellingPrice: 480, stock: 50, attributes: { Size: '1 Dozen Box' } }
      ]
    },
    {
      name: 'Fresh Cow Milk 100% Pure (Pasteurized)',
      catSlug: 'groceries-daily-needs',
      subName: 'Dairy, Bread & Eggs',
      brand: 'ApexDairy',
      sku: 'VND-DRY-MILK-01',
      baseMrp: 32,
      discountPercent: 5,
      baseSellingPrice: 30,
      stock: 400,
      thumbnail: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800'],
      attributes: { FatContent: '3.5%', Packaging: 'Pouch', Subscription: 'Available' },
      variants: [
        { sku: 'VND-MILK-500ML', mrp: 32, discountPercent: 5, sellingPrice: 30, stock: 250, attributes: { Volume: '500 ml' } },
        { sku: 'VND-MILK-1L', mrp: 62, discountPercent: 5, sellingPrice: 58, stock: 150, attributes: { Volume: '1 Litre' } }
      ]
    },
    {
      name: 'Farm Fresh Brown Eggs (High Omega-3)',
      catSlug: 'groceries-daily-needs',
      subName: 'Dairy, Bread & Eggs',
      brand: 'ApexDairy',
      sku: 'VND-DRY-EGGS-01',
      baseMrp: 90,
      discountPercent: 10,
      baseSellingPrice: 81,
      stock: 120,
      thumbnail: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=800'],
      attributes: { Type: 'Brown Eggs', Nutrients: 'Omega-3 Enriched', Count: '6 Eggs Pack' },
      variants: [
        { sku: 'VND-EGGS-6PCS', mrp: 90, discountPercent: 10, sellingPrice: 81, stock: 70, attributes: { Quantity: '6 Pack' } },
        { sku: 'VND-EGGS-12PCS', mrp: 175, discountPercent: 12, sellingPrice: 154, stock: 50, attributes: { Quantity: '12 Pack' } }
      ]
    },
    {
      name: 'Cold Pressed Sunflower Oil (100% Pure)',
      catSlug: 'groceries-daily-needs',
      subName: 'Oils & Masalas',
      brand: 'GoldDrop',
      sku: 'VND-OIL-SUN-01',
      baseMrp: 160,
      discountPercent: 10,
      baseSellingPrice: 144,
      stock: 180,
      thumbnail: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800'],
      attributes: { Extraction: 'Cold Pressed', Cholesterol: 'Zero', PackType: 'Pouch' },
      variants: [
        { sku: 'VND-OIL-SUN-1L', mrp: 160, discountPercent: 10, sellingPrice: 144, stock: 100, attributes: { Volume: '1 Litre' } },
        { sku: 'VND-OIL-SUN-5L', mrp: 780, discountPercent: 15, sellingPrice: 663, stock: 80, attributes: { Volume: '5 Litres Can' } }
      ]
    },
    {
      name: 'Authentic Guntur Red Chilli Powder (Karam)',
      catSlug: 'groceries-daily-needs',
      subName: 'Oils & Masalas',
      brand: 'SpicyAndhra',
      sku: 'VND-SPICE-CHILLI-01',
      baseMrp: 120,
      discountPercent: 15,
      baseSellingPrice: 102,
      stock: 220,
      thumbnail: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&q=80&w=800'],
      attributes: { SpiceLevel: 'High (Hot)', Color: 'Natural Deep Red', Origin: 'Guntur' },
      variants: [
        { sku: 'VND-CHILLI-250G', mrp: 120, discountPercent: 15, sellingPrice: 102, stock: 120, attributes: { Weight: '250 g' } },
        { sku: 'VND-CHILLI-500G', mrp: 230, discountPercent: 18, sellingPrice: 188, stock: 100, attributes: { Weight: '500 g' } }
      ]
    },
    {
      name: 'Crunchy Roasted Salted Cashews (W240)',
      catSlug: 'groceries-daily-needs',
      subName: 'Snacks & Beverages',
      brand: 'NuttyBites',
      sku: 'VND-SNK-CASHEW-01',
      baseMrp: 350,
      discountPercent: 20,
      baseSellingPrice: 280,
      stock: 140,
      thumbnail: 'https://images.unsplash.com/photo-1509358217951-4ff27004316a?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1509358217951-4ff27004316a?auto=format&fit=crop&q=80&w=800'],
      attributes: { Grade: 'W240 Jumbo', Roast: 'Light Salted', Container: 'Vacuum Zipper Pouch' },
      variants: [
        { sku: 'VND-CASHEW-250G', mrp: 350, discountPercent: 20, sellingPrice: 280, stock: 90, attributes: { Weight: '250 g' } },
        { sku: 'VND-CASHEW-500G', mrp: 680, discountPercent: 22, sellingPrice: 530, stock: 50, attributes: { Weight: '500 g' } }
      ]
    },

    // --- RESTAURANT & FOOD (11-18) ---
    {
      name: 'Special Hyderabadi Chicken Dum Biryani',
      catSlug: 'restaurant-food',
      subName: 'Biryanis & Rice Dishes',
      brand: 'Tasty Biryani House',
      sku: 'VND-FD-BIR-CHK-01',
      baseMrp: 320,
      discountPercent: 15,
      baseSellingPrice: 272,
      stock: 100,
      thumbnail: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=800'],
      attributes: { Portion: 'Serves 1-2', SpiceLevel: 'Medium Hot', Includes: 'Raita & Mirchi ka Salan' },
      variants: [
        { sku: 'VND-BIR-CHK-SINGLE', mrp: 320, discountPercent: 15, sellingPrice: 272, stock: 60, attributes: { Portion: 'Single Pack' } },
        { sku: 'VND-BIR-CHK-JUMBO', mrp: 580, discountPercent: 18, sellingPrice: 475, stock: 40, attributes: { Portion: 'Family Pack' } }
      ]
    },
    {
      name: 'Nellore Special Chepala Pulusu (Fish Curry)',
      catSlug: 'restaurant-food',
      subName: 'Biryanis & Rice Dishes',
      brand: 'Nellore Spice Diner',
      sku: 'VND-FD-FISH-01',
      baseMrp: 280,
      discountPercent: 10,
      baseSellingPrice: 252,
      stock: 60,
      thumbnail: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&q=80&w=800'],
      attributes: { FishType: 'Fresh Korrameenu', Style: 'Traditional Clay Pot', Spice: 'Authentic Tangy Karam' },
      variants: [
        { sku: 'VND-FISH-PUL-STD', mrp: 280, discountPercent: 10, sellingPrice: 252, stock: 60, attributes: { Portion: 'Full Bowl (2 Pcs)' } }
      ]
    },
    {
      name: 'Crispy Butter Masala Dosa Combo',
      catSlug: 'restaurant-food',
      subName: 'South Indian Tiffins',
      brand: 'Nellore Tiffin Centre',
      sku: 'VND-FD-DOSA-01',
      baseMrp: 110,
      discountPercent: 10,
      baseSellingPrice: 99,
      stock: 150,
      thumbnail: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&q=80&w=800'],
      attributes: { Includes: 'Coconut Chutney, Ginger Chutney & Sambar', Ghee: 'Pure Cow Ghee' },
      variants: [
        { sku: 'VND-DOSA-SINGLE', mrp: 110, discountPercent: 10, sellingPrice: 99, stock: 150, attributes: { Type: 'Single Dosa Plate' } }
      ]
    },
    {
      name: 'Steamed Idli Sambar Platter (4 Pcs)',
      catSlug: 'restaurant-food',
      subName: 'South Indian Tiffins',
      brand: 'Nellore Tiffin Centre',
      sku: 'VND-FD-IDLI-01',
      baseMrp: 70,
      discountPercent: 10,
      baseSellingPrice: 63,
      stock: 200,
      thumbnail: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&q=80&w=800'],
      attributes: { Count: '4 Soft Idlis', ServedWith: 'Hot Sambar & Allam Chutney' },
      variants: [
        { sku: 'VND-IDLI-4PCS', mrp: 70, discountPercent: 10, sellingPrice: 63, stock: 200, attributes: { Pack: '4 Pcs' } }
      ]
    },
    {
      name: 'Loaded Paneer Tikka Pizza (10 Inch Medium)',
      catSlug: 'restaurant-food',
      subName: 'Pizzas & Burgers',
      brand: 'Italiano Pizza Hub',
      sku: 'VND-FD-PIZ-01',
      baseMrp: 399,
      discountPercent: 25,
      baseSellingPrice: 299,
      stock: 80,
      thumbnail: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800'],
      attributes: { Crust: 'Hand Tossed', Cheese: '100% Mozzarella', Size: '10 Inch' },
      variants: [
        { sku: 'VND-PIZ-MED', mrp: 399, discountPercent: 25, sellingPrice: 299, stock: 50, attributes: { Size: 'Medium 10 inch' } },
        { sku: 'VND-PIZ-LRG', mrp: 599, discountPercent: 25, sellingPrice: 449, stock: 30, attributes: { Size: 'Large 12 inch' } }
      ]
    },
    {
      name: 'Double Cheeseburger Deluxe with Fries',
      catSlug: 'restaurant-food',
      subName: 'Pizzas & Burgers',
      brand: 'Burger Junction',
      sku: 'VND-FD-BGR-01',
      baseMrp: 220,
      discountPercent: 15,
      baseSellingPrice: 187,
      stock: 90,
      thumbnail: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800'],
      attributes: { Patty: 'Grilled Veg Patty', Cheese: 'Double Cheddar Slice', Side: 'Peri Peri Fries' },
      variants: [
        { sku: 'VND-BGR-COMBO', mrp: 220, discountPercent: 15, sellingPrice: 187, stock: 90, attributes: { Option: 'Burger + Fries + Coke' } }
      ]
    },
    {
      name: 'Traditional Motichoor Ladoo (Pure Ghee)',
      catSlug: 'restaurant-food',
      subName: 'Desserts & Sweets',
      brand: 'Sweet Magic',
      sku: 'VND-FD-SWEET-01',
      baseMrp: 250,
      discountPercent: 10,
      baseSellingPrice: 225,
      stock: 120,
      thumbnail: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=800'],
      attributes: { Fat: '100% Pure Desi Ghee', Texture: 'Soft Fine Boondi', Occasion: 'Festival Special' },
      variants: [
        { sku: 'VND-LADOO-500G', mrp: 250, discountPercent: 10, sellingPrice: 225, stock: 80, attributes: { Weight: '500 g Box' } },
        { sku: 'VND-LADOO-1KG', mrp: 480, discountPercent: 12, sellingPrice: 422, stock: 40, attributes: { Weight: '1 kg Box' } }
      ]
    },
    {
      name: 'Rich Chocolate Lava Cake (Freshly Baked)',
      catSlug: 'restaurant-food',
      subName: 'Desserts & Sweets',
      brand: 'Bakery Bliss',
      sku: 'VND-FD-CAKE-01',
      baseMrp: 120,
      discountPercent: 15,
      baseSellingPrice: 102,
      stock: 75,
      thumbnail: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=800'],
      attributes: { Chocolate: 'Dark Belgian', Eggless: 'Yes', Served: 'Warm' },
      variants: [
        { sku: 'VND-CAKE-LAVA-1PC', mrp: 120, discountPercent: 15, sellingPrice: 102, stock: 75, attributes: { Piece: '1 Pc Cup' } }
      ]
    },

    // --- ELECTRONICS & MOBILES (19-27) ---
    {
      name: 'boAt Airdopes 141 True Wireless Earbuds',
      catSlug: 'electronics-mobiles',
      subName: 'Audio & Headphones',
      brand: 'boAt',
      sku: 'VND-ELEC-TWS-01',
      baseMrp: 2990,
      discountPercent: 55,
      baseSellingPrice: 1345,
      stock: 65,
      thumbnail: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
      images: [
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
        'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&q=80&w=800'
      ],
      attributes: { Playtime: '42 Hours', Mic: 'ENx Tech Dual Mic', Charging: 'ASAP Fast Charge 10min=75min', Connectivity: 'Bluetooth v5.3' },
      variants: [
        { sku: 'VND-TWS-BLK', mrp: 2990, discountPercent: 55, sellingPrice: 1345, stock: 40, attributes: { Color: 'Active Black' } },
        { sku: 'VND-TWS-BLU', mrp: 2990, discountPercent: 55, sellingPrice: 1345, stock: 25, attributes: { Color: 'Cyan Cider' } }
      ]
    },
    {
      name: 'Sony WH-1000XM5 Wireless ANC Headphones',
      catSlug: 'electronics-mobiles',
      subName: 'Audio & Headphones',
      brand: 'Sony',
      sku: 'VND-ELEC-HEAD-01',
      baseMrp: 34990,
      discountPercent: 15,
      baseSellingPrice: 29741,
      stock: 15,
      thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=800'],
      attributes: { NoiseCancellation: 'Industry Leading Auto NC', BatteryLife: '30 Hours', Driver: '30mm Precision', VoiceAssistant: 'Alexa Built-in' },
      variants: [
        { sku: 'VND-SONY-NC-SILVER', mrp: 34990, discountPercent: 15, sellingPrice: 29741, stock: 15, attributes: { Color: 'Silver White' } }
      ]
    },
    {
      name: 'Noise ColorFit Pulse 2 Max Smartwatch',
      catSlug: 'electronics-mobiles',
      subName: 'Wearables & Smartwatches',
      brand: 'Noise',
      sku: 'VND-ELEC-WATCH-01',
      baseMrp: 4999,
      discountPercent: 60,
      baseSellingPrice: 1999,
      stock: 90,
      thumbnail: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800'],
      attributes: { DisplaySize: '1.85 Inch TFT', Calling: 'Bluetooth Calling', SportsModes: '100+', WaterResistance: 'IP68' },
      variants: [
        { sku: 'VND-WATCH-JETBLK', mrp: 4999, discountPercent: 60, sellingPrice: 1999, stock: 50, attributes: { Color: 'Jet Black' } },
        { sku: 'VND-WATCH-TEAL', mrp: 4999, discountPercent: 60, sellingPrice: 1999, stock: 40, attributes: { Color: 'Teal Blue' } }
      ]
    },
    {
      name: 'Redmi 12 5G (Jade Black 6GB RAM 128GB)',
      catSlug: 'electronics-mobiles',
      subName: 'Smartphones & Accessories',
      brand: 'Xiaomi',
      sku: 'VND-ELEC-MOB-01',
      baseMrp: 15999,
      discountPercent: 20,
      baseSellingPrice: 12799,
      stock: 35,
      thumbnail: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=800'],
      attributes: { Processor: 'Snapdragon 4 Gen 2 5G', Camera: '50MP AI Dual', Battery: '5000 mAh', Display: '6.79 FHD+ 90Hz' },
      variants: [
        { sku: 'VND-MOB-6-128', mrp: 15999, discountPercent: 20, sellingPrice: 12799, stock: 20, attributes: { Storage: '6GB / 128GB' } },
        { sku: 'VND-MOB-8-256', mrp: 17999, discountPercent: 18, sellingPrice: 14759, stock: 15, attributes: { Storage: '8GB / 256GB' } }
      ]
    },
    {
      name: 'Mi 20000mAh Power Bank 3i 18W Fast Charge',
      catSlug: 'electronics-mobiles',
      subName: 'Smartphones & Accessories',
      brand: 'Xiaomi',
      sku: 'VND-ELEC-PWR-01',
      baseMrp: 2199,
      discountPercent: 25,
      baseSellingPrice: 1649,
      stock: 110,
      thumbnail: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&q=80&w=800'],
      attributes: { Capacity: '20000 mAh', OutputPorts: 'Triple Output (Dual USB-A + Type-C)', Input: 'Micro-USB & Type-C' },
      variants: [
        { sku: 'VND-PWR-20K-BLK', mrp: 2199, discountPercent: 25, sellingPrice: 1649, stock: 110, attributes: { Color: 'Sandstone Black' } }
      ]
    },
    {
      name: 'Instant Electric Water Kettle 1.8 Litre',
      catSlug: 'electronics-mobiles',
      subName: 'Home Appliances',
      brand: 'Pigeon',
      sku: 'VND-ELEC-KET-01',
      baseMrp: 1245,
      discountPercent: 45,
      baseSellingPrice: 684,
      stock: 80,
      thumbnail: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f6?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1594212699903-ec8a3eca50f6?auto=format&fit=crop&q=80&w=800'],
      attributes: { Material: 'Stainless Steel Body', Power: '1500 Watt', AutoCutoff: 'Yes' },
      variants: [
        { sku: 'VND-KET-18L', mrp: 1245, discountPercent: 45, sellingPrice: 684, stock: 80, attributes: { Capacity: '1.8 Litres' } }
      ]
    },
    {
      name: 'Philips 750W 3-Jar Mixer Grinder',
      catSlug: 'electronics-mobiles',
      subName: 'Home Appliances',
      brand: 'Philips',
      sku: 'VND-ELEC-MIX-01',
      baseMrp: 4695,
      discountPercent: 30,
      baseSellingPrice: 3286,
      stock: 40,
      thumbnail: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800'],
      attributes: { MotorPower: '750W Turbo Motor', JarsCount: '3 Stainless Steel Jars', Warranty: '2 Years Manufacturer' },
      variants: [
        { sku: 'VND-MIX-3JAR', mrp: 4695, discountPercent: 30, sellingPrice: 3286, stock: 40, attributes: { Jars: '3 Jars (Chutney, Dry, Wet)' } }
      ]
    },

    // --- FASHION & LIFESTYLE (28-35) ---
    {
      name: 'Men Premium Slim Fit Cotton Casual Shirt',
      catSlug: 'fashion-lifestyle',
      subName: "Men's Wear",
      brand: 'Allen Solly',
      sku: 'VND-FASH-SHIRT-01',
      baseMrp: 1999,
      discountPercent: 40,
      baseSellingPrice: 1199,
      stock: 120,
      thumbnail: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800'],
      attributes: { Fabric: '100% Breathable Cotton', Fit: 'Slim Fit', Sleeve: 'Full Sleeve', Pattern: 'Solid White' },
      variants: [
        { sku: 'VND-SHIRT-WHT-M', mrp: 1999, discountPercent: 40, sellingPrice: 1199, stock: 50, attributes: { Size: 'M (38)' } },
        { sku: 'VND-SHIRT-WHT-L', mrp: 1999, discountPercent: 40, sellingPrice: 1199, stock: 45, attributes: { Size: 'L (40)' } },
        { sku: 'VND-SHIRT-WHT-XL', mrp: 1999, discountPercent: 40, sellingPrice: 1199, stock: 25, attributes: { Size: 'XL (42)' } }
      ]
    },
    {
      name: 'Kanchipuram Silk Blend Zari Work Saree',
      catSlug: 'fashion-lifestyle',
      subName: "Women's Ethnic",
      brand: 'Kanchi Heritage',
      sku: 'VND-FASH-SAREE-01',
      baseMrp: 4999,
      discountPercent: 50,
      baseSellingPrice: 2499,
      stock: 45,
      thumbnail: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800'],
      attributes: { SareeFabric: 'Soft Silk Blend', Zari: 'Gold Jacquard Weave', Blouse: 'Unstitched Included 0.8m' },
      variants: [
        { sku: 'VND-SAREE-RED', mrp: 4999, discountPercent: 50, sellingPrice: 2499, stock: 25, attributes: { Color: 'Royal Crimson Red' } },
        { sku: 'VND-SAREE-GRN', mrp: 4999, discountPercent: 50, sellingPrice: 2499, stock: 20, attributes: { Color: 'Emerald Green' } }
      ]
    },
    {
      name: "Men Lightweight Running & Walking Shoes",
      catSlug: 'fashion-lifestyle',
      subName: 'Footwear',
      brand: 'Campus',
      sku: 'VND-FASH-SHOE-01',
      baseMrp: 1899,
      discountPercent: 35,
      baseSellingPrice: 1234,
      stock: 90,
      thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'],
      attributes: { UpperMaterial: 'Breathable Mesh', Sole: 'Phylon Memory Foam', Closure: 'Lace-Up' },
      variants: [
        { sku: 'VND-SHOE-UK8', mrp: 1899, discountPercent: 35, sellingPrice: 1234, stock: 45, attributes: { Size: 'UK 8' } },
        { sku: 'VND-SHOE-UK9', mrp: 1899, discountPercent: 35, sellingPrice: 1234, stock: 45, attributes: { Size: 'UK 9' } }
      ]
    },

    // --- BEAUTY & PERSONAL CARE (36-42) ---
    {
      name: 'Mamaearth Vitamin C Daily Face Wash (150ml)',
      catSlug: 'beauty-personal-care',
      subName: 'Skin Care',
      brand: 'Mamaearth',
      sku: 'VND-BTY-WASH-01',
      baseMrp: 399,
      discountPercent: 15,
      baseSellingPrice: 339,
      stock: 160,
      thumbnail: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800'],
      attributes: { SkinType: 'All Skin Types', KeyIngredients: 'Vitamin C & Turmeric', ParabenFree: 'Yes' },
      variants: [
        { sku: 'VND-WASH-150ML', mrp: 399, discountPercent: 15, sellingPrice: 339, stock: 160, attributes: { Volume: '150 ml Tube' } }
      ]
    },
    {
      name: 'Nivea Dark Spot Reduction Face Wash for Men',
      catSlug: 'beauty-personal-care',
      subName: 'Grooming & Hygiene',
      brand: 'Nivea',
      sku: 'VND-BTY-MENWASH-01',
      baseMrp: 250,
      discountPercent: 15,
      baseSellingPrice: 212,
      stock: 140,
      thumbnail: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800'],
      attributes: { TargetedFor: 'Men Oil & Dark Spot Control', Action: 'Deep Cleanse', Volume: '100g' },
      variants: [
        { sku: 'VND-MENWASH-100G', mrp: 250, discountPercent: 15, sellingPrice: 212, stock: 140, attributes: { Weight: '100 g Tube' } }
      ]
    },

    // --- HOME & KITCHEN (43-47) ---
    {
      name: 'Prestige Hard Anodized Non-Stick Katai (2.5L)',
      catSlug: 'home-kitchen',
      subName: 'Cookware & Serveware',
      brand: 'Prestige',
      sku: 'VND-HOME-KADAI-01',
      baseMrp: 1540,
      discountPercent: 30,
      baseSellingPrice: 1078,
      stock: 55,
      thumbnail: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&q=80&w=800'],
      attributes: { Coating: '3 Layer Non-Stick', InductionBase: 'Yes', Lid: 'Glass Lid Included' },
      variants: [
        { sku: 'VND-KADAI-2.5L', mrp: 1540, discountPercent: 30, sellingPrice: 1078, stock: 55, attributes: { Capacity: '2.5 Litres' } }
      ]
    },
    {
      name: 'Airtight Glass Food Storage Containers (3 Pcs Set)',
      catSlug: 'home-kitchen',
      subName: 'Storage & Containers',
      brand: 'Borosil',
      sku: 'VND-HOME-CONT-01',
      baseMrp: 1290,
      discountPercent: 25,
      baseSellingPrice: 967,
      stock: 70,
      thumbnail: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=800'],
      attributes: { GlassType: '100% Borosilicate', MicrowaveSafe: 'Yes (Without Lid)', LeakProof: 'Silicone Ring Seal' },
      variants: [
        { sku: 'VND-CONT-3SET', mrp: 1290, discountPercent: 25, sellingPrice: 967, stock: 70, attributes: { SetSize: '3 Containers (400ml, 650ml, 1000ml)' } }
      ]
    },

    // --- FRESH FLOWERS & POOJA (48-50) ---
    {
      name: 'Fresh Fragrant Jasmine Garland (Mallepoolu)',
      catSlug: 'fresh-flowers-pooja',
      subName: 'Fresh Flowers',
      brand: 'Nellore Flora',
      sku: 'VND-FLW-JAS-01',
      baseMrp: 120,
      discountPercent: 20,
      baseSellingPrice: 96,
      stock: 300,
      thumbnail: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&q=80&w=800'],
      attributes: { Freshness: 'Plucked Same Morning', Scent: 'Strong Natural Jasmine', Use: 'Hair & Pooja' },
      variants: [
        { sku: 'VND-JAS-250G', mrp: 120, discountPercent: 20, sellingPrice: 96, stock: 180, attributes: { Weight: '250 g String' } },
        { sku: 'VND-JAS-500G', mrp: 220, discountPercent: 22, sellingPrice: 171, stock: 120, attributes: { Weight: '500 g String' } }
      ]
    },
    {
      name: 'Complete Divine Varalakshmi Vratham Pooja Kit',
      catSlug: 'fresh-flowers-pooja',
      subName: 'Pooja Items & Kits',
      brand: 'ApexPooja',
      sku: 'VND-POOJA-KIT-01',
      baseMrp: 499,
      discountPercent: 20,
      baseSellingPrice: 399,
      stock: 150,
      thumbnail: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&q=80&w=800'],
      attributes: { ItemsIncluded: 'Pasupu, Kumkum, Akshat, Diya Wicks, Agarbatti, Dhoop, Camphor & Kalasam Thread', Organic: 'Pure Eco Friendly' },
      variants: [
        { sku: 'VND-KIT-STD', mrp: 499, discountPercent: 20, sellingPrice: 399, stock: 150, attributes: { Edition: 'Complete 15 Item Pooja Pack' } }
      ]
    },

    // --- ADDITIONAL 30 PRODUCTS TO COMPLETE 50 ITEMS ---
    {
      name: 'Pure Desi Cow Ghee (A2 Bilona Traditional)',
      catSlug: 'groceries-daily-needs',
      subName: 'Dairy, Bread & Eggs',
      brand: 'GirAmrit',
      sku: 'VND-GHEE-A2-01',
      baseMrp: 750,
      discountPercent: 15,
      baseSellingPrice: 637,
      stock: 110,
      thumbnail: 'https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&q=80&w=800'],
      attributes: { Method: 'Vedic Bilona Churned', FatContent: '99.8%', ShelfLife: '12 Months' },
      variants: [
        { sku: 'VND-GHEE-500ML', mrp: 750, discountPercent: 15, sellingPrice: 637, stock: 70, attributes: { Volume: '500 ml Glass Jar' } },
        { sku: 'VND-GHEE-1L', mrp: 1450, discountPercent: 18, sellingPrice: 1189, stock: 40, attributes: { Volume: '1 Litre Glass Jar' } }
      ]
    },
    {
      name: 'Aashirvaad Shudh Chakki Whole Wheat Atta 10kg',
      catSlug: 'groceries-daily-needs',
      subName: 'Atta, Rice & Dals',
      brand: 'Aashirvaad',
      sku: 'VND-ATTA-10KG-01',
      baseMrp: 440,
      discountPercent: 10,
      baseSellingPrice: 396,
      stock: 130,
      thumbnail: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&q=80&w=800'],
      attributes: { Grain: '100% Whole Wheat', Fiber: 'High Fiber', MaidaAdded: '0%' },
      variants: [
        { sku: 'VND-ATTA-10KG', mrp: 440, discountPercent: 10, sellingPrice: 396, stock: 80, attributes: { Weight: '10 kg Bag' } },
        { sku: 'VND-ATTA-5KG', mrp: 230, discountPercent: 8, sellingPrice: 211, stock: 50, attributes: { Weight: '5 kg Bag' } }
      ]
    },
    {
      name: 'Tetley Green Tea Lemon & Honey (100 Bags)',
      catSlug: 'groceries-daily-needs',
      subName: 'Snacks & Beverages',
      brand: 'Tetley',
      sku: 'VND-TEA-GREEN-01',
      baseMrp: 500,
      discountPercent: 20,
      baseSellingPrice: 400,
      stock: 95,
      thumbnail: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=800'],
      attributes: { Flavor: 'Lemon & Honey', Antioxidants: 'Rich in Catechins', PackCount: '100 Tea Bags' },
      variants: [
        { sku: 'VND-TEA-100BAGS', mrp: 500, discountPercent: 20, sellingPrice: 400, stock: 95, attributes: { Pack: '100 Bags Box' } }
      ]
    },
    {
      name: 'Fresh Tender Coconut (Pack of 3 Sweet Water)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Fruits',
      brand: 'Nellore Fresh',
      sku: 'VND-FRT-COCO-01',
      baseMrp: 150,
      discountPercent: 20,
      baseSellingPrice: 120,
      stock: 200,
      thumbnail: 'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&q=80&w=800'],
      attributes: { WaterVolume: '300ml+ Per Coconut', Electrolytes: 'High Potassium', Trimmed: 'Easy Open Cut' },
      variants: [
        { sku: 'VND-COCO-3PCS', mrp: 150, discountPercent: 20, sellingPrice: 120, stock: 200, attributes: { Pack: '3 Tender Coconuts' } }
      ]
    },
    {
      name: 'Traditional Crunchy Andhra Janthikulu (400g)',
      catSlug: 'groceries-daily-needs',
      subName: 'Snacks & Beverages',
      brand: 'SpicyAndhra',
      sku: 'VND-SNK-MUR-01',
      baseMrp: 140,
      discountPercent: 15,
      baseSellingPrice: 119,
      stock: 180,
      thumbnail: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&q=80&w=800'],
      attributes: { Flavor: 'Sesame & Ajwain', Texture: 'Super Crunchy', Oil: 'Sunflower Oil Fried' },
      variants: [
        { sku: 'VND-MUR-400G', mrp: 140, discountPercent: 15, sellingPrice: 119, stock: 180, attributes: { Weight: '400 g Pack' } }
      ]
    },
    {
      name: 'Fast Qi Wireless Car Charger Mount 15W',
      catSlug: 'electronics-mobiles',
      subName: 'Smartphones & Accessories',
      brand: 'Ambrane',
      sku: 'VND-ELEC-CARCHG-01',
      baseMrp: 1999,
      discountPercent: 40,
      baseSellingPrice: 1199,
      stock: 60,
      thumbnail: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=800'],
      attributes: { ChargingSpeed: '15W Fast Wireless', Sensor: 'Auto Clamping Infra-red', Mount: 'Air Vent & Dashboard' },
      variants: [
        { sku: 'VND-CARCHG-15W', mrp: 1999, discountPercent: 40, sellingPrice: 1199, stock: 60, attributes: { Power: '15 Watt Output' } }
      ]
    },
    {
      name: 'Wipro Wi-Fi Smart LED Bulb 12W RGB + White',
      catSlug: 'electronics-mobiles',
      subName: 'Home Appliances',
      brand: 'Wipro',
      sku: 'VND-ELEC-BULB-01',
      baseMrp: 999,
      discountPercent: 50,
      baseSellingPrice: 499,
      stock: 140,
      thumbnail: 'https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&fit=crop&q=80&w=800'],
      attributes: { Colors: '16 Million RGB Colors', VoiceControl: 'Alexa & Google Assistant', Holder: 'B22 Indian Socket' },
      variants: [
        { sku: 'VND-BULB-12W', mrp: 999, discountPercent: 50, sellingPrice: 499, stock: 140, attributes: { Wattage: '12 Watts' } }
      ]
    },
    {
      name: 'Milton Thermosteel Vacuum Flask 1000ml',
      catSlug: 'home-kitchen',
      subName: 'Storage & Containers',
      brand: 'Milton',
      sku: 'VND-HOME-FLASK-01',
      baseMrp: 1120,
      discountPercent: 20,
      baseSellingPrice: 896,
      stock: 85,
      thumbnail: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=800'],
      attributes: { Insulation: '24 Hours Hot & Cold', Material: '18/8 Stainless Steel', Capacity: '1 Litre' },
      variants: [
        { sku: 'VND-FLASK-1L', mrp: 1120, discountPercent: 20, sellingPrice: 896, stock: 85, attributes: { Volume: '1000 ml' } }
      ]
    },
    {
      name: 'Men Slim Fit Dark Wash Stretchable Denim Jeans',
      catSlug: 'fashion-lifestyle',
      subName: "Men's Wear",
      brand: 'Levi',
      sku: 'VND-FASH-JEANS-01',
      baseMrp: 2899,
      discountPercent: 40,
      baseSellingPrice: 1739,
      stock: 100,
      thumbnail: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&q=80&w=800'],
      attributes: { Stretch: '2% Elastane Flex', Wash: 'Dark Indigo Enzyme', Rise: 'Mid Rise' },
      variants: [
        { sku: 'VND-JEANS-30', mrp: 2899, discountPercent: 40, sellingPrice: 1739, stock: 35, attributes: { Waist: '30 inch' } },
        { sku: 'VND-JEANS-32', mrp: 2899, discountPercent: 40, sellingPrice: 1739, stock: 40, attributes: { Waist: '32 inch' } },
        { sku: 'VND-JEANS-34', mrp: 2899, discountPercent: 40, sellingPrice: 1739, stock: 25, attributes: { Waist: '34 inch' } }
      ]
    },
    {
      name: 'Women Designer Printed Rayon Anarkali Kurti',
      catSlug: 'fashion-lifestyle',
      subName: "Women's Ethnic",
      brand: 'Biba',
      sku: 'VND-FASH-KURTI-01',
      baseMrp: 1999,
      discountPercent: 45,
      baseSellingPrice: 1099,
      stock: 80,
      thumbnail: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800'],
      attributes: { Fabric: '100% Soft Heavy Rayon', Length: 'Anarkali Flare 48 inch', Neck: 'Round Mandarain Collar' },
      variants: [
        { sku: 'VND-KURTI-M', mrp: 1999, discountPercent: 45, sellingPrice: 1099, stock: 40, attributes: { Size: 'Medium (38)' } },
        { sku: 'VND-KURTI-L', mrp: 1999, discountPercent: 45, sellingPrice: 1099, stock: 40, attributes: { Size: 'Large (40)' } }
      ]
    },
    {
      name: 'WOW Skin Science Red Onion Black Seed Hair Oil 300ml',
      catSlug: 'beauty-personal-care',
      subName: 'Hair Care',
      brand: 'WOW',
      sku: 'VND-BTY-OIL-01',
      baseMrp: 599,
      discountPercent: 30,
      baseSellingPrice: 419,
      stock: 120,
      thumbnail: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800'],
      attributes: { MineralOilFree: 'Yes 100%', HairType: 'Hair-fall Control', CombApplicator: 'Included' },
      variants: [
        { sku: 'VND-Hairoil-300ML', mrp: 599, discountPercent: 30, sellingPrice: 419, stock: 120, attributes: { Volume: '300 ml Bottle' } }
      ]
    },
    {
      name: 'Pure Organic Aloe Vera Gel (99% Natural 250g)',
      catSlug: 'beauty-personal-care',
      subName: 'Skin Care',
      brand: 'UrbanBotanics',
      sku: 'VND-BTY-ALOE-01',
      baseMrp: 299,
      discountPercent: 25,
      baseSellingPrice: 224,
      stock: 170,
      thumbnail: 'https://images.unsplash.com/photo-1567928256511-2ee54de900f9?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1567928256511-2ee54de900f9?auto=format&fit=crop&q=80&w=800'],
      attributes: { Purity: '99% Cold Pressed Gel', Fragrance: 'Zero Added Perfume', Color: 'Transparent Clear' },
      variants: [
        { sku: 'VND-ALOE-250G', mrp: 299, discountPercent: 25, sellingPrice: 224, stock: 170, attributes: { Weight: '250 g Jar' } }
      ]
    },
    {
      name: 'Hawkins Tri-Ply Stainless Steel Fry Pan 24cm',
      catSlug: 'home-kitchen',
      subName: 'Cookware & Serveware',
      brand: 'Hawkins',
      sku: 'VND-HOME-PAN-01',
      baseMrp: 1650,
      discountPercent: 20,
      baseSellingPrice: 1320,
      stock: 50,
      thumbnail: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800'],
      attributes: { LayerCount: '3 Ply Heavy Base', Diameter: '24 cm', Handle: 'Cool Touch Stainless' },
      variants: [
        { sku: 'VND-PAN-24CM', mrp: 1650, discountPercent: 20, sellingPrice: 1320, stock: 50, attributes: { Size: '24 cm' } }
      ]
    },
    {
      name: 'Heavy Stainless Steel Dinnerware Set 24 Pieces',
      catSlug: 'home-kitchen',
      subName: 'Cookware & Serveware',
      brand: 'ApexHome',
      sku: 'VND-HOME-DINNER-01',
      baseMrp: 2499,
      discountPercent: 30,
      baseSellingPrice: 1749,
      stock: 40,
      thumbnail: 'https://images.unsplash.com/photo-1615865417236-d67f189a746f?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1615865417236-d67f189a746f?auto=format&fit=crop&q=80&w=800'],
      attributes: { Gauge: 'Heavy 22 Gauge', GaugeSteel: 'Grade 304 Stainless', Pieces: '6 Plates, 6 Bowls, 6 Glasses, 6 Spoons' },
      variants: [
        { sku: 'VND-DINNER-24PC', mrp: 2499, discountPercent: 30, sellingPrice: 1749, stock: 40, attributes: { Set: '24 Pcs Set' } }
      ]
    },
    {
      name: 'Fresh Orange Marigold Flower Garland (Banti Poolu)',
      catSlug: 'fresh-flowers-pooja',
      subName: 'Fresh Flowers',
      brand: 'Nellore Flora',
      sku: 'VND-FLW-MARI-01',
      baseMrp: 100,
      discountPercent: 20,
      baseSellingPrice: 80,
      stock: 250,
      thumbnail: 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&q=80&w=800'],
      attributes: { Color: 'Vibrant Orange & Yellow', Length: '6 Feet Garland', IdealFor: 'Door & Temple Decoration' },
      variants: [
        { sku: 'VND-MARI-6FT', mrp: 100, discountPercent: 20, sellingPrice: 80, stock: 250, attributes: { Length: '6 Feet' } }
      ]
    },
    {
      name: 'Pure Solid Brass Kubera Oil Diya Lamp Pair',
      catSlug: 'fresh-flowers-pooja',
      subName: 'Pooja Items & Kits',
      brand: 'ApexPooja',
      sku: 'VND-POOJA-DIYA-01',
      baseMrp: 350,
      discountPercent: 20,
      baseSellingPrice: 280,
      stock: 110,
      thumbnail: 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1609137144813-7d9921338f24?auto=format&fit=crop&q=80&w=800'],
      attributes: { Metal: '100% Solid Heavy Brass', Finish: 'High Polish Gold', Weight: '280g Pair' },
      variants: [
        { sku: 'VND-DIYA-PAIR', mrp: 350, discountPercent: 20, sellingPrice: 280, stock: 110, attributes: { Quantity: '1 Pair (2 Diyas)' } }
      ]
    },
    {
      name: 'Organic Whole Green Moong Dal (1kg)',
      catSlug: 'groceries-daily-needs',
      subName: 'Atta, Rice & Dals',
      brand: 'PureFarm',
      sku: 'VND-DAL-MOONG-01',
      baseMrp: 170,
      discountPercent: 12,
      baseSellingPrice: 149,
      stock: 140,
      thumbnail: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&q=80&w=800'],
      attributes: { Type: 'Whole Green Gram', Protein: '24g per 100g', Organic: 'Certified Organic' },
      variants: [
        { sku: 'VND-MOONG-1KG', mrp: 170, discountPercent: 12, sellingPrice: 149, stock: 140, attributes: { Weight: '1 kg' } }
      ]
    },
    {
      name: 'Fresh Green Crunchy Capsicum (Shimla Mirchi)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Vegetables',
      brand: 'Nellore Fresh',
      sku: 'VND-VEG-CAP-01',
      baseMrp: 60,
      discountPercent: 15,
      baseSellingPrice: 51,
      stock: 160,
      thumbnail: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&q=80&w=800'],
      attributes: { Freshness: 'Daily Farm Harvest', Grade: 'Grade A Thick Wall', Storage: 'Refrigerate' },
      variants: [
        { sku: 'VND-CAP-500G', mrp: 60, discountPercent: 15, sellingPrice: 51, stock: 160, attributes: { Weight: '500 g' } }
      ]
    },
    {
      name: 'Sweet Seedless Black Grapes (500g Box)',
      catSlug: 'groceries-daily-needs',
      subName: 'Fresh Fruits',
      brand: 'Royal Orchards',
      sku: 'VND-FRT-GRAPES-01',
      baseMrp: 110,
      discountPercent: 18,
      baseSellingPrice: 90,
      stock: 90,
      thumbnail: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1537640538966-79f369143f8f?auto=format&fit=crop&q=80&w=800'],
      attributes: { Variety: 'Sharad Seedless', Taste: 'Sweet Crispy Juiciness', Pack: 'Hygienic Clamshell' },
      variants: [
        { sku: 'VND-GRAPES-500G', mrp: 110, discountPercent: 18, sellingPrice: 90, stock: 90, attributes: { Weight: '500 g Punnet' } }
      ]
    },
    {
      name: 'Amul Taaza T-Special Toned Milk 1L Tetra',
      catSlug: 'groceries-daily-needs',
      subName: 'Dairy, Bread & Eggs',
      brand: 'Amul',
      sku: 'VND-MILK-AMUL-01',
      baseMrp: 72,
      discountPercent: 5,
      baseSellingPrice: 68,
      stock: 220,
      thumbnail: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=800'],
      attributes: { ShelfLife: '180 Days UHT', Fat: '3.0%', Subscription: 'Available' },
      variants: [
        { sku: 'VND-AMUL-1L', mrp: 72, discountPercent: 5, sellingPrice: 68, stock: 220, attributes: { Volume: '1 Litre Tetra Pack' } }
      ]
    },
    {
      name: 'Fortune Kachi Ghani Mustard Oil 1L Bottle',
      catSlug: 'groceries-daily-needs',
      subName: 'Oils & Masalas',
      brand: 'Fortune',
      sku: 'VND-OIL-MUST-01',
      baseMrp: 175,
      discountPercent: 12,
      baseSellingPrice: 154,
      stock: 140,
      thumbnail: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=800'],
      attributes: { Aroma: 'Strong Pungent Mustard', Omega3: 'Rich Natural Omega-3', Extraction: 'Cold Pressed Kachi Ghani' },
      variants: [
        { sku: 'VND-MUST-1L', mrp: 175, discountPercent: 12, sellingPrice: 154, stock: 140, attributes: { Volume: '1 Litre Bottle' } }
      ]
    },
    {
      name: 'Haldiram Nagpur Bhujia Sev 400g Pack',
      catSlug: 'groceries-daily-needs',
      subName: 'Snacks & Beverages',
      brand: 'Haldiram',
      sku: 'VND-SNK-BHUJIA-01',
      baseMrp: 130,
      discountPercent: 10,
      baseSellingPrice: 117,
      stock: 190,
      thumbnail: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&q=80&w=800'],
      attributes: { SpiceLevel: 'Tangy Mild Spicy', Base: 'Dew Bean Flour & Gram Flour', ShelfLife: '6 Months' },
      variants: [
        { sku: 'VND-BHUJIA-400G', mrp: 130, discountPercent: 10, sellingPrice: 117, stock: 190, attributes: { Weight: '400 g' } }
      ]
    },
    {
      name: 'South Indian Special Mutton Chukka Fry',
      catSlug: 'restaurant-food',
      subName: 'Biryanis & Rice Dishes',
      brand: 'Nellore Spice Diner',
      sku: 'VND-FD-MUTTON-01',
      baseMrp: 380,
      discountPercent: 15,
      baseSellingPrice: 323,
      stock: 50,
      thumbnail: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800'],
      attributes: { Meat: 'Tender Tender Goat Meat', Style: 'Dry Black Pepper Fry', Portion: 'Serves 1-2' },
      variants: [
        { sku: 'VND-MUTTON-DRY', mrp: 380, discountPercent: 15, sellingPrice: 323, stock: 50, attributes: { Portion: 'Single Bowl (250g)' } }
      ]
    },
    {
      name: 'SanDisk Ultra Dual 64GB USB 3.1 Type-C Drive',
      catSlug: 'electronics-mobiles',
      subName: 'Smartphones & Accessories',
      brand: 'SanDisk',
      sku: 'VND-ELEC-USB-01',
      baseMrp: 1100,
      discountPercent: 45,
      baseSellingPrice: 605,
      stock: 130,
      thumbnail: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&q=80&w=800'],
      attributes: { Speed: 'Up to 150MB/s Read', Interface: 'Dual Type-C & Type-A', Body: 'Swivel Metal' },
      variants: [
        { sku: 'VND-USB-64GB', mrp: 1100, discountPercent: 45, sellingPrice: 605, stock: 130, attributes: { Capacity: '64 GB' } }
      ]
    },
    {
      name: 'Realme Buds Wireless 3 Neckband ANC',
      catSlug: 'electronics-mobiles',
      subName: 'Audio & Headphones',
      brand: 'Realme',
      sku: 'VND-ELEC-NECK-01',
      baseMrp: 2999,
      discountPercent: 40,
      baseSellingPrice: 1799,
      stock: 80,
      thumbnail: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800'],
      attributes: { ANC: '30dB Active Noise Cancellation', Playback: '40 Hours Total', Driver: '13.6mm Dynamic Bass' },
      variants: [
        { sku: 'VND-NECK-BLK', mrp: 2999, discountPercent: 40, sellingPrice: 1799, stock: 80, attributes: { Color: 'Bass Black' } }
      ]
    },
    {
      name: "Men Polarized UV400 Aviator Sunglasses",
      catSlug: 'fashion-lifestyle',
      subName: 'Watches & Accessories',
      brand: 'Vincent Chase',
      sku: 'VND-FASH-GLASS-01',
      baseMrp: 1999,
      discountPercent: 65,
      baseSellingPrice: 699,
      stock: 110,
      thumbnail: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800'],
      attributes: { Frame: 'Gold Metal Alloy', Lens: 'Green Polarized Anti-Glare', Protection: '100% UV400' },
      variants: [
        { sku: 'VND-GLASS-GOLD', mrp: 1999, discountPercent: 65, sellingPrice: 699, stock: 110, attributes: { FrameColor: 'Gold / Green Lens' } }
      ]
    },
    {
      name: 'Tresemme Keratin Smooth Shampoo 580ml',
      catSlug: 'beauty-personal-care',
      subName: 'Hair Care',
      brand: 'Tresemme',
      sku: 'VND-BTY-SHAMP-01',
      baseMrp: 650,
      discountPercent: 25,
      baseSellingPrice: 487,
      stock: 130,
      thumbnail: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800'],
      attributes: { KeyIngredient: 'Argan Oil & Keratin Protein', FrizzControl: 'Up to 72 Hours', Volume: '580ml Pump Bottle' },
      variants: [
        { sku: 'VND-SHAMP-580ML', mrp: 650, discountPercent: 25, sellingPrice: 487, stock: 130, attributes: { Volume: '580 ml' } }
      ]
    },
    {
      name: 'Stainless Steel Insulated Lunch Box Set 4 Jars',
      catSlug: 'home-kitchen',
      subName: 'Cookware & Serveware',
      brand: 'Cello',
      sku: 'VND-HOME-LUNCH-01',
      baseMrp: 1450,
      discountPercent: 25,
      baseSellingPrice: 1087,
      stock: 75,
      thumbnail: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?auto=format&fit=crop&q=80&w=800'],
      attributes: { Jars: '4 Stainless Steel Containers', Jacket: 'Thermal Insulated Fabric Bag', LeakProof: 'Yes' },
      variants: [
        { sku: 'VND-LUNCH-4JAR', mrp: 1450, discountPercent: 25, sellingPrice: 1087, stock: 75, attributes: { Containers: '4 Jars Set' } }
      ]
    },
    {
      name: 'Fresh Red Rose Bouquet (12 Long Stem Roses)',
      catSlug: 'fresh-flowers-pooja',
      subName: 'Fresh Flowers',
      brand: 'Nellore Flora',
      sku: 'VND-FLW-ROSE-01',
      baseMrp: 350,
      discountPercent: 20,
      baseSellingPrice: 280,
      stock: 90,
      thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800'],
      variants: [
        { sku: 'VND-ROSE-12PCS', mrp: 350, discountPercent: 20, sellingPrice: 280, stock: 90, attributes: { Pack: '12 Rose Bouquet' } }
      ]
    }
  ];

  const defaultCategoryDoc = (await Category.findOne({})) || (await Category.create({
    name: 'General Groceries & Essentials',
    slug: 'general-groceries-essentials',
    description: 'Default ApexBee Category',
    displayOrder: 1,
    isActive: true,
    isFeatured: true
  }));

  let createdCount = 0;
  for (let i = 0; i < productsList.length; i++) {
    await new Promise((r) => setTimeout(r, 10));
    const item = productsList[i];

    const catDoc = catMap[item.catSlug] || defaultCategoryDoc;
    const categoryId = catDoc._id || defaultCategoryDoc._id;
    const sub = subMap[`${item.catSlug}:${item.subName}`];

    const existing = await Product.findOne({ sku: item.sku });
    if (existing) {
      console.log(`[Seed Vendor] Product already exists for SKU ${item.sku}. Updating live status...`);
      existing.status = 'Live';
      existing.isActive = true;
      existing.moderationStatus = 'approved';
      existing.sellerId = sellerId;
      existing.categoryId = categoryId;
      await existing.save();
      createdCount++;
      continue;
    }

    try {
      const slug = `${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${i + 1}`;

      const newProd = await Product.create({
        sellerId,
        createdBy: sellerId,
        sellerType: 'vendor',
        name: item.name,
        slug,
        description: `${item.name} - Premium quality item guaranteed by ApexBee Prime Vendor. Instant 30-minute delivery in your city.`,
        categoryId,
        subCategoryId: sub ? sub._id : null,
        subcategoryId: sub ? sub._id : null,
        brand: item.brand,
        sku: item.sku,
        thumbnail: item.thumbnail,
        images: item.images,
        attributes: item.attributes,
        variants: item.variants || [],
        baseMrp: item.baseMrp,
        discountPercent: item.discountPercent,
        baseSellingPrice: item.baseSellingPrice,
        stock: item.stock,
        status: 'Live',
        isActive: true,
        moderationStatus: 'approved',
        adminPricingApproved: true,
        sellerPricingAccepted: true,
        isStoreProduct: true,
        isSubscriptionAvailable: item.sku.includes('MILK') || item.sku.includes('WATER'),
        submittedAt: new Date(),
      });

      // Create Variants in ProductVariant collection
      for (const vr of item.variants) {
        try {
          const vDoc = await ProductVariant.create({
            productId: newProd._id,
            sku: vr.sku,
            attributes: vr.attributes,
            mrp: vr.mrp,
            discountPercent: vr.discountPercent,
            sellingPrice: vr.sellingPrice,
            stock: vr.stock,
            images: item.images,
            isActive: true,
          });

          // Create StoreProduct
          await StoreProduct.create({
            storeId,
            productId: newProd._id,
            variantId: vDoc._id,
            mrp: vr.mrp,
            sellingPrice: vr.sellingPrice,
            minimumOrderQuantity: 1,
            preparationTimeMinutes: 15,
            deliveryTypes: ['express', 'same_day', 'standard'],
            subscriptionAvailable: vr.sku.includes('MILK') || vr.sku.includes('WATER'),
            scheduledDeliveryAvailable: true,
            isActive: true,
          });

          // Create Inventory
          await Inventory.create({
            storeId,
            productId: newProd._id,
            variantId: vDoc._id,
            availableStock: vr.stock,
            reservedStock: 0,
            damagedStock: 0,
            lowStockThreshold: 5,
          });
        } catch (vErr: any) {
          console.warn(`[Seed Vendor] Variant creation warning for ${vr.sku}:`, vErr.message);
        }
      }

      // Create SearchDocument
      try {
        await SearchDocument.create({
          entityType: 'product',
          entityId: newProd._id,
          title: newProd.name,
          subtitle: newProd.sku,
          description: newProd.description,
          keywords: [newProd.slug, newProd.sku, item.brand.toLowerCase()],
          categoryId,
          subcategoryId: sub ? sub._id : null,
          isActive: true,
          popularityScore: 100,
        });
      } catch (sErr: any) {
        console.warn(`[Seed Vendor] SearchDoc creation warning for ${newProd.sku}:`, sErr.message);
      }

      createdCount++;
    } catch (prodErr: any) {
      console.warn(`[Seed Vendor] Product creation error for item ${item.name}:`, prodErr.message);
    }
  }

  console.log(`[Seed Vendor 50 Products] SUCCESS! ${createdCount} products active under vendor@gmail.com.`);
  return { success: true, count: createdCount, vendorEmail };
};
