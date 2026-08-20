import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Vendor } from '../models/Vendor';
import Category from '../models/Category';
import Subcategory from '../models/Subcategory';
import Product from '../models/Product';
import StoreProduct from '../models/StoreProduct';

interface LocationVendorConfig {
  vendorKey: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  address: string;
  pincode: string;
  mandal: string;
  district: string;
  state: string;
  coordinates: [number, number]; // [lng, lat]
  deliveryRadiusKm: number;
}

const TEST_VENDORS_DATA: LocationVendorConfig[] = [
  {
    vendorKey: 'vendor_hyd_madhapur',
    name: 'Ramesh Reddy',
    email: 'ramesh.hyd.vendor@testapexbee.com',
    phone: '9848011001',
    businessName: 'Apex Madhapur Fresh & Artisan Hub',
    address: 'Plot 42, Hitech City Main Rd, Madhapur',
    pincode: '500081',
    mandal: 'Serilingampally',
    district: 'Hyderabad',
    state: 'Telangana',
    coordinates: [78.3847, 17.4483],
    deliveryRadiusKm: 12
  },
  {
    vendorKey: 'vendor_hyd_gachibowli',
    name: 'Suresh Kumar',
    email: 'suresh.gachi.vendor@testapexbee.com',
    phone: '9848011002',
    businessName: 'Gachibowli Organic Store & Bakes',
    address: 'Telecom Nagar, Gachibowli Financial District Rd',
    pincode: '500032',
    mandal: 'Serilingampally',
    district: 'Rangareddy',
    state: 'Telangana',
    coordinates: [78.3578, 17.4401],
    deliveryRadiusKm: 10
  },
  {
    vendorKey: 'vendor_blr_koramangala',
    name: 'Ananya Sharma',
    email: 'ananya.blr.vendor@testapexbee.com',
    phone: '9848011003',
    businessName: 'Koramangala Artisan Market & Farmcraft',
    address: '80 Feet Rd, 4th Block, Koramangala',
    pincode: '560034',
    mandal: 'Bengaluru South',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    coordinates: [77.6271, 12.9352],
    deliveryRadiusKm: 15
  },
  {
    vendorKey: 'vendor_blr_indiranagar',
    name: 'Karthik Rao',
    email: 'karthik.blr.vendor@testapexbee.com',
    phone: '9848011004',
    businessName: 'Indiranagar Gourmet & Crafts',
    address: '100 Feet Rd, HAL 2nd Stage, Indiranagar',
    pincode: '560038',
    mandal: 'Bengaluru East',
    district: 'Bengaluru Urban',
    state: 'Karnataka',
    coordinates: [77.6411, 12.9784],
    deliveryRadiusKm: 10
  },
  {
    vendorKey: 'vendor_mum_bandra',
    name: 'Farhan Merchant',
    email: 'farhan.mum.vendor@testapexbee.com',
    phone: '9848011005',
    businessName: 'Bandra Artisan Goods & Farm Collective',
    address: 'Hill Road, Near Bandra Station West',
    pincode: '400050',
    mandal: 'Bandra',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    coordinates: [72.8335, 19.0596],
    deliveryRadiusKm: 8
  }
];

export async function seedLocationTestCategoriesAndProducts() {
  const isAlreadyConnected = mongoose.connection.readyState === 1;
  if (!isAlreadyConnected) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment.');
    }
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(mongoUri);
    console.log(`Connected to database successfully.`);
  }

  try {
    // -------------------------------------------------------------
    // 1. SETUP VENDORS IN DISTINCT LOCATIONS
    // -------------------------------------------------------------
    console.log('\n--- 1. Setting up Localized Test Vendors ---');
    const vendorMap: Record<string, { user: any; vendor: any }> = {};
    const hashedPassword = await bcrypt.hash('TestVendor@123', 10);

    for (const vData of TEST_VENDORS_DATA) {
      let user = await User.findOne({ email: vData.email });
      if (!user) {
        user = await User.create({
          name: vData.name,
          email: vData.email,
          phone: vData.phone,
          mobile: vData.phone,
          passwordHash: hashedPassword,
          roles: ['vendor', 'customer'],
          status: 'Active',
          isVerified: true,
          sellerProfile: {
            businessName: vData.businessName,
            businessType: 'Vendor',
            kycStatus: 'Approved',
            addressText: vData.address
          }
        });
        console.log(` Created user: ${user.name} (${user.email})`);
      }

      let vendor = await Vendor.findOne({ userId: user._id });
      if (!vendor) {
        vendor = await Vendor.create({
          userId: user._id,
          businessName: vData.businessName,
          ownerName: vData.name,
          mobile: vData.phone,
          email: vData.email,
          state: vData.state,
          district: vData.district,
          mandal: vData.mandal,
          address: vData.address,
          pincode: vData.pincode,
          status: 'active',
          marketplaceStatus: 'Approved',
          isMarketplaceListed: true,
          deliveryMode: 'self_delivery',
          deliveryRadiusKm: vData.deliveryRadiusKm,
          estimatedDeliveryMinutes: 30,
          minOrder: 100,
          deliveryCharge: 25,
          verifiedBadge: true,
          location: {
            type: 'Point',
            coordinates: vData.coordinates
          },
          liveStatus: 'open'
        });
        console.log(` Created vendor: ${vendor.businessName} (Pincode: ${vendor.pincode}, Coords: ${vData.coordinates})`);
      } else {
        vendor.address = vData.address;
        vendor.pincode = vData.pincode;
        vendor.mandal = vData.mandal;
        vendor.district = vData.district;
        vendor.state = vData.state;
        vendor.location = {
          type: 'Point',
          coordinates: vData.coordinates
        };
        vendor.marketplaceStatus = 'Approved';
        vendor.status = 'active';
        vendor.isMarketplaceListed = true;
        await vendor.save();
        console.log(` Updated vendor: ${vendor.businessName} (Pincode: ${vendor.pincode})`);
      }

      vendorMap[vData.vendorKey] = { user, vendor };
    }

    const vendorKeys = Object.keys(vendorMap);

    // -------------------------------------------------------------
    // 2. SEED 3 CATEGORIES & SUB-CATEGORIES
    // -------------------------------------------------------------
    console.log('\n--- 2. Seeding 3 Categories & Subcategories ---');

    const categoriesDef = [
      {
        name: 'Fresh Farm Produce',
        slug: 'fresh-farm-produce-test',
        description: 'Locally grown pesticide-free farm vegetables and seasonal fruits.',
        displayOrder: 1,
        subcategories: [
          {
            name: 'Local Organic Vegetables',
            slug: 'local-organic-vegetables-test',
            description: 'Crisp, directly harvested farm veggies with same-day local delivery.'
          },
          {
            name: 'Seasonal Farm Fruits',
            slug: 'seasonal-farm-fruits-test',
            description: 'Fresh seasonal fruits picked at peak ripeness.'
          }
        ]
      },
      {
        name: 'Gourmet Artisan Bakery',
        slug: 'gourmet-artisan-bakery-test',
        description: 'Handmade sourdoughs, celebration cakes and artisanal pastries baked fresh daily.',
        displayOrder: 2,
        subcategories: [
          {
            name: 'Artisan Breads & Sourdough',
            slug: 'artisan-breads-sourdough-test',
            description: 'Fresh wood-fired sourdough loaves and rustic artisanal breads.'
          },
          {
            name: 'Pastries & Desserts',
            slug: 'pastries-desserts-test',
            description: 'Gourmet tarts, cakes, and hand-crafted sweet delicacies.'
          }
        ]
      },
      {
        name: 'Handcrafted Living & Decor',
        slug: 'handcrafted-living-decor-test',
        description: 'Authentic handcrafted studio ceramics, clayware and handwoven home accents.',
        displayOrder: 3,
        subcategories: [
          {
            name: 'Ceramics & Clay Pottery',
            slug: 'ceramics-clay-pottery-test',
            description: 'Studio handmade terracotta pots, bowls, mugs, and dining pottery.'
          },
          {
            name: 'Handwoven Home Accents',
            slug: 'handwoven-home-accents-test',
            description: 'Artisanal handwoven throws, cushion covers and table runners.'
          }
        ]
      }
    ];

    const seededCategories: any[] = [];

    for (const catDef of categoriesDef) {
      let category = await Category.findOne({ slug: catDef.slug });
      if (!category) {
        category = await Category.create({
          name: catDef.name,
          slug: catDef.slug,
          description: catDef.description,
          displayOrder: catDef.displayOrder,
          isActive: true,
          isFeatured: true,
          supportedItemTypes: ['product'],
          level: 1
        });
        console.log(` Created Category: ${category.name} (${category.slug})`);
      } else {
        category.name = catDef.name;
        category.isActive = true;
        await category.save();
        console.log(` Existing Category confirmed: ${category.name}`);
      }

      const subcatRecords: any[] = [];
      for (let i = 0; i < catDef.subcategories.length; i++) {
        const subDef = catDef.subcategories[i];
        let subcat = await Subcategory.findOne({ slug: subDef.slug });
        if (!subcat) {
          subcat = await Subcategory.create({
            categoryId: category._id,
            name: subDef.name,
            slug: subDef.slug,
            description: subDef.description,
            displayOrder: i + 1,
            isActive: true,
            isFeatured: true
          });
          console.log(`   Created Subcategory: ${subcat.name} (${subcat.slug})`);
        } else {
          subcat.categoryId = category._id as any;
          subcat.name = subDef.name;
          subcat.isActive = true;
          await subcat.save();
          console.log(`   Existing Subcategory confirmed: ${subcat.name}`);
        }
        subcatRecords.push(subcat);
      }

      seededCategories.push({
        category,
        subcategories: subcatRecords
      });
    }

    // -------------------------------------------------------------
    // 3. SEED 5 PRODUCTS FOR EVERY CATEGORY (WITH DIVERSE LOCATIONS & NO PAN-INDIA)
    // -------------------------------------------------------------
    console.log('\n--- 3. Seeding 5 Local Products for Each of the 3 Categories (15 Total) ---');

    // Category 1 Products (Fresh Farm Produce)
    const cat1 = seededCategories[0];
    const cat1Products = [
      {
        name: 'Farm-Fresh Hydroponic Spinach 250g',
        slug: 'hydroponic-spinach-250g-local-test',
        description: 'Crisp and nutrient-rich hydroponic spinach harvested early morning.',
        subIndex: 0,
        vendorIndex: 0, // Madhapur, Hyd (500081)
        baseMrp: 60,
        baseSellingPrice: 45,
        sku: 'VEG-HYD-SPIN-01',
        thumbnail: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500'
      },
      {
        name: 'Organic Heirloom Vine Tomatoes 500g',
        slug: 'heirloom-vine-tomatoes-500g-local-test',
        description: 'Juicy, farm-ripened organic tomatoes grown without synthetic fertilizers.',
        subIndex: 0,
        vendorIndex: 1, // Gachibowli, Hyd (500032)
        baseMrp: 80,
        baseSellingPrice: 55,
        sku: 'VEG-HYD-TOM-02',
        thumbnail: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=500'
      },
      {
        name: 'Bangalore Orchard Fresh Royal Gala Apples (4 Pcs)',
        slug: 'royal-gala-apples-4pcs-local-test',
        description: 'Sweet and crunchy apples sourced directly from regional orchards.',
        subIndex: 1,
        vendorIndex: 2, // Koramangala, BLR (560034)
        baseMrp: 180,
        baseSellingPrice: 140,
        sku: 'FRU-BLR-APP-03',
        thumbnail: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500'
      },
      {
        name: 'Karnataka Farm Fresh Alphonso Mangoes 1kg',
        slug: 'alphonso-mangoes-1kg-local-test',
        description: 'Naturally ripened, fragrant Alphonso mangoes delivered locally.',
        subIndex: 1,
        vendorIndex: 3, // Indiranagar, BLR (560038)
        baseMrp: 450,
        baseSellingPrice: 380,
        sku: 'FRU-BLR-MNG-04',
        thumbnail: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500'
      },
      {
        name: 'Maharashtra Sweet Dragon Fruit (2 Pcs)',
        slug: 'sweet-dragon-fruit-2pcs-local-test',
        description: 'Vibrant pink dragon fruit harvested fresh from coastal farms.',
        subIndex: 1,
        vendorIndex: 4, // Bandra, Mumbai (400050)
        baseMrp: 220,
        baseSellingPrice: 175,
        sku: 'FRU-MUM-DRG-05',
        thumbnail: 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=500'
      }
    ];

    // Category 2 Products (Gourmet Artisan Bakery)
    const cat2 = seededCategories[1];
    const cat2Products = [
      {
        name: 'Slow-Fermented Classic Sourdough Country Loaf',
        slug: 'classic-sourdough-country-loaf-local-test',
        description: '36-hour slow fermented artisan sourdough loaf with crunchy crust and open crumb.',
        subIndex: 0,
        vendorIndex: 0, // Madhapur, Hyd (500081)
        baseMrp: 220,
        baseSellingPrice: 180,
        sku: 'BAK-HYD-SRD-01',
        thumbnail: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500'
      },
      {
        name: 'Whole Wheat Olive & Rosemary Focaccia',
        slug: 'rosemary-olive-focaccia-local-test',
        description: 'Fluffy Italian focaccia topped with Kalamata olives, fresh rosemary and sea salt.',
        subIndex: 0,
        vendorIndex: 1, // Gachibowli, Hyd (500032)
        baseMrp: 240,
        baseSellingPrice: 195,
        sku: 'BAK-HYD-FOC-02',
        thumbnail: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500'
      },
      {
        name: 'Belgian Dark Chocolate Ganache Pastry',
        slug: 'belgian-dark-chocolate-pastry-local-test',
        description: 'Rich 70% dark Belgian chocolate layered pastry with silky smooth ganache.',
        subIndex: 1,
        vendorIndex: 2, // Koramangala, BLR (560034)
        baseMrp: 190,
        baseSellingPrice: 150,
        sku: 'BAK-BLR-PST-03',
        thumbnail: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500'
      },
      {
        name: 'Classic French Butter Croissants (Pack of 3)',
        slug: 'french-butter-croissants-3pack-local-test',
        description: 'Golden, ultra-flaky butter croissants made using traditional French lamination.',
        subIndex: 0,
        vendorIndex: 3, // Indiranagar, BLR (560038)
        baseMrp: 280,
        baseSellingPrice: 240,
        sku: 'BAK-BLR-CRO-04',
        thumbnail: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500'
      },
      {
        name: 'Fresh Blueberry Lemon Tart 150g',
        slug: 'fresh-blueberry-lemon-tart-local-test',
        description: 'Zesty lemon curd pastry shell topped with fresh wild blueberries.',
        subIndex: 1,
        vendorIndex: 4, // Bandra, Mumbai (400050)
        baseMrp: 210,
        baseSellingPrice: 165,
        sku: 'BAK-MUM-TRT-05',
        thumbnail: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=500'
      }
    ];

    // Category 3 Products (Handcrafted Living & Decor - PAN-INDIA + LOCAL)
    const cat3 = seededCategories[2];
    const cat3Products = [
      {
        name: 'Handcrafted Terracotta Chai Kulhad Set (Pack of 6)',
        slug: 'terracotta-chai-kulhad-6pack-local-test',
        description: 'Artisanal natural clay tea cups crafted by local studio potters.',
        subIndex: 0,
        vendorIndex: 0, // Madhapur, Hyd (500081)
        baseMrp: 350,
        baseSellingPrice: 280,
        sku: 'DEC-HYD-KUL-01',
        deliveryScope: 'both' as const,
        isPanIndia: true,
        thumbnail: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=500'
      },
      {
        name: 'Studio Glazed Ceramic Coffee Mug (Ochre Yellow)',
        slug: 'glazed-ceramic-coffee-mug-ochre-local-test',
        description: 'Hand-thrown stoneware ceramic mug with ergonomic handle and food-safe glaze.',
        subIndex: 0,
        vendorIndex: 1, // Gachibowli, Hyd (500032)
        baseMrp: 450,
        baseSellingPrice: 350,
        sku: 'DEC-HYD-MUG-02',
        deliveryScope: 'both' as const,
        isPanIndia: true,
        thumbnail: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500'
      },
      {
        name: 'Handwoven Natural Jute Table Runner (12x48 inch)',
        slug: 'handwoven-jute-table-runner-local-test',
        description: '100% natural braided jute runner with fringed edges for dining styling.',
        subIndex: 1,
        vendorIndex: 2, // Koramangala, BLR (560034)
        baseMrp: 650,
        baseSellingPrice: 499,
        sku: 'DEC-BLR-JUT-03',
        deliveryScope: 'both' as const,
        isPanIndia: true,
        thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500'
      },
      {
        name: 'Artisan Macrame Boho Wall Hanging',
        slug: 'artisan-macrame-wall-hanging-local-test',
        description: 'Intricately knotted organic cotton cord macrame on a natural driftwood rod.',
        subIndex: 1,
        vendorIndex: 3, // Indiranagar, BLR (560038)
        baseMrp: 899,
        baseSellingPrice: 699,
        sku: 'DEC-BLR-MAC-04',
        deliveryScope: 'both' as const,
        isPanIndia: true,
        thumbnail: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500'
      },
      {
        name: 'Handmade Rustic Ceramic Planter Bowl',
        slug: 'rustic-ceramic-planter-bowl-local-test',
        description: 'Textured stoneware succulent planter with bottom drainage hole.',
        subIndex: 0,
        vendorIndex: 4, // Bandra, Mumbai (400050)
        baseMrp: 550,
        baseSellingPrice: 420,
        sku: 'DEC-MUM-PLT-05',
        deliveryScope: 'both' as const,
        isPanIndia: true,
        thumbnail: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500'
      }
    ];

    const categoryBatches = [
      { catRecord: cat1, products: cat1Products },
      { catRecord: cat2, products: cat2Products },
      { catRecord: cat3, products: cat3Products }
    ];

    let totalProductsCreated = 0;
    const summaryList: any[] = [];

    for (const batch of categoryBatches) {
      console.log(`\n-- Seeding 5 products for category: "${batch.catRecord.category.name}" --`);

      for (const p of batch.products) {
        const subcategory = batch.catRecord.subcategories[p.subIndex];
        const vKey = vendorKeys[p.vendorIndex];
        const { user: vUser, vendor: vVendor } = vendorMap[vKey];

        const productPayload = {
          name: p.name,
          slug: p.slug,
          description: p.description,
          categoryId: batch.catRecord.category._id,
          subcategoryId: subcategory._id,
          subCategoryId: subcategory._id,
          productType: 'physical',
          itemType: 'PHYSICAL',
          sku: p.sku,
          baseMrp: p.baseMrp,
          baseSellingPrice: p.baseSellingPrice,
          stock: 100,
          moderationStatus: 'approved',
          status: 'Live',
          isActive: true,
          isArchived: false,
          createdBy: vUser._id,
          sellerId: vVendor._id,
          sellerType: 'vendor',
          vendorPincode: vVendor.pincode,
          deliveryScope: ((p as any).deliveryScope || 'local') as 'local' | 'pan_india' | 'both',
          isLocalDelivery: true,
          isPanIndia: (p as any).isPanIndia === true,
          isSelfPickup: true,
          thumbnail: p.thumbnail,
          images: [p.thumbnail],
          badges: [(p as any).isPanIndia ? 'PAN-India Delivery' : 'Local Fresh', 'Verified Seller'],
          liveAt: new Date()
        };

        const existingProd = await Product.findOne({ slug: p.slug });
        let savedProd;
        if (existingProd) {
          Object.assign(existingProd, productPayload);
          savedProd = await existingProd.save();
          console.log(` Updated Product: ${savedProd.name}`);
        } else {
          savedProd = await Product.create(productPayload);
          console.log(` Created Product: ${savedProd.name}`);
        }

        // Upsert StoreProduct for local vendor store listing
        await StoreProduct.findOneAndUpdate(
          { storeId: vVendor._id, productId: savedProd._id },
          {
            $set: {
              storeId: vVendor._id,
              productId: savedProd._id,
              mrp: p.baseMrp,
              sellingPrice: p.baseSellingPrice,
              minimumOrderQuantity: 1,
              preparationTimeMinutes: 20,
              deliveryTypes: ['express', 'same_day', 'standard'],
              isActive: true
            }
          },
          { upsert: true, new: true }
        );

        totalProductsCreated++;
        summaryList.push({
          category: batch.catRecord.category.name,
          subcategory: subcategory.name,
          productName: savedProd.name,
          slug: savedProd.slug,
          price: `Rs. ${savedProd.baseSellingPrice} (MRP: Rs. ${savedProd.baseMrp})`,
          deliveryScope: savedProd.deliveryScope,
          isPanIndia: savedProd.isPanIndia,
          vendor: vVendor.businessName,
          pincode: vVendor.pincode,
          city: `${vVendor.mandal}, ${vVendor.district}, ${vVendor.state}`,
          coordinates: vVendor.location?.coordinates
        });
      }
    }

    console.log('\n======================================================');
    console.log(`SUCCESS: Seeded 3 Categories, 6 Subcategories, and ${totalProductsCreated} Local Products!`);
    console.log('======================================================');
    console.table(summaryList);

    return {
      success: true,
      categoriesCount: seededCategories.length,
      productsCount: totalProductsCreated,
      summaryList
    };
  } catch (error) {
    console.error('Error during seeding location test data:', error);
    throw error;
  } finally {
    if (!isAlreadyConnected) {
      await mongoose.disconnect();
      console.log('MongoDB disconnected.');
    }
  }
}

if (require.main === module) {
  seedLocationTestCategoriesAndProducts()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
