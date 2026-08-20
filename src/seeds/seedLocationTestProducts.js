const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TEST_VENDORS_DATA = [
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

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in .env');
  }

  console.log('Connecting to database:', mongoUri.replace(/:[^:@]+@/, ':***@'));
  await mongoose.connect(mongoUri);
  console.log('Successfully connected to MongoDB test database.');

  const db = mongoose.connection.db;
  const usersColl = db.collection('users');
  const vendorsColl = db.collection('vendors');
  const categoriesColl = db.collection('categories');
  const subcategoriesColl = db.collection('subcategories');
  const productsColl = db.collection('products');
  const storeProductsColl = db.collection('storeproducts');

  // 1. VENDORS
  console.log('\n--- 1. Upserting Local Vendors in 5 Distinct Locations ---');
  const hashedPassword = await bcrypt.hash('TestVendor@123', 10);
  const vendorMap = {};

  for (const vData of TEST_VENDORS_DATA) {
    let user = await usersColl.findOne({ email: vData.email });
    if (!user) {
      const res = await usersColl.insertOne({
        name: vData.name,
        email: vData.email,
        phone: vData.phone,
        mobile: vData.phone,
        passwordHash: hashedPassword,
        roles: ['vendor', 'customer'],
        status: 'Active',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      user = { _id: res.insertedId, ...vData };
      console.log(` Created User: ${vData.name}`);
    }

    let vendor = await vendorsColl.findOne({ userId: user._id });
    const vendorDoc = {
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
      liveStatus: 'open',
      updatedAt: new Date()
    };

    if (!vendor) {
      vendorDoc.createdAt = new Date();
      const res = await vendorsColl.insertOne(vendorDoc);
      vendor = { _id: res.insertedId, ...vendorDoc };
      console.log(` Created Vendor: ${vData.businessName} [Pincode: ${vData.pincode}, Coords: ${vData.coordinates.join(', ')}]`);
    } else {
      await vendorsColl.updateOne({ _id: vendor._id }, { $set: vendorDoc });
      vendor = { ...vendor, ...vendorDoc };
      console.log(` Updated Vendor: ${vData.businessName} [Pincode: ${vData.pincode}]`);
    }

    vendorMap[vData.vendorKey] = { user, vendor };
  }

  const vendorKeys = Object.keys(vendorMap);

  // 2. CATEGORIES & SUBCATEGORIES
  console.log('\n--- 2. Upserting 3 Categories & Subcategories ---');
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

  const seededCategories = [];

  for (const catDef of categoriesDef) {
    let cat = await categoriesColl.findOne({ slug: catDef.slug });
    const catData = {
      name: catDef.name,
      slug: catDef.slug,
      description: catDef.description,
      displayOrder: catDef.displayOrder,
      isActive: true,
      isFeatured: true,
      supportedItemTypes: ['product'],
      level: 1,
      updatedAt: new Date()
    };

    if (!cat) {
      catData.createdAt = new Date();
      const res = await categoriesColl.insertOne(catData);
      cat = { _id: res.insertedId, ...catData };
      console.log(` Created Category: ${cat.name} (${cat.slug})`);
    } else {
      await categoriesColl.updateOne({ _id: cat._id }, { $set: catData });
      console.log(` Updated Category: ${cat.name}`);
    }

    const subcatRecords = [];
    for (let i = 0; i < catDef.subcategories.length; i++) {
      const subDef = catDef.subcategories[i];
      let subcat = await subcategoriesColl.findOne({ slug: subDef.slug });
      const subData = {
        categoryId: cat._id,
        name: subDef.name,
        slug: subDef.slug,
        description: subDef.description,
        displayOrder: i + 1,
        isActive: true,
        isFeatured: true,
        updatedAt: new Date()
      };

      if (!subcat) {
        subData.createdAt = new Date();
        const res = await subcategoriesColl.insertOne(subData);
        subcat = { _id: res.insertedId, ...subData };
        console.log(`   Created Subcategory: ${subcat.name} (${subcat.slug})`);
      } else {
        await subcategoriesColl.updateOne({ _id: subcat._id }, { $set: subData });
        console.log(`   Updated Subcategory: ${subcat.name}`);
      }
      subcatRecords.push(subcat);
    }

    seededCategories.push({ category: cat, subcategories: subcatRecords });
  }

  // 3. PRODUCTS (5 for each Category = 15 total)
  console.log('\n--- 3. Upserting 5 Location-Restricted Products per Category (15 Total) ---');

  const productsPlan = [
    // Category 1: Fresh Farm Produce
    {
      catIdx: 0,
      subIdx: 0,
      vIdx: 0, // Madhapur, Hyd (500081)
      name: 'Farm-Fresh Hydroponic Spinach 250g',
      slug: 'hydroponic-spinach-250g-local-test',
      description: 'Crisp and nutrient-rich hydroponic spinach harvested early morning.',
      sku: 'VEG-HYD-SPIN-01',
      baseMrp: 60,
      baseSellingPrice: 45,
      thumbnail: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500'
    },
    {
      catIdx: 0,
      subIdx: 0,
      vIdx: 1, // Gachibowli, Hyd (500032)
      name: 'Organic Heirloom Vine Tomatoes 500g',
      slug: 'heirloom-vine-tomatoes-500g-local-test',
      description: 'Juicy, farm-ripened organic tomatoes grown without synthetic fertilizers.',
      sku: 'VEG-HYD-TOM-02',
      baseMrp: 80,
      baseSellingPrice: 55,
      thumbnail: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=500'
    },
    {
      catIdx: 0,
      subIdx: 1,
      vIdx: 2, // Koramangala, BLR (560034)
      name: 'Bangalore Orchard Fresh Royal Gala Apples (4 Pcs)',
      slug: 'royal-gala-apples-4pcs-local-test',
      description: 'Sweet and crunchy apples sourced directly from regional orchards.',
      sku: 'FRU-BLR-APP-03',
      baseMrp: 180,
      baseSellingPrice: 140,
      thumbnail: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500'
    },
    {
      catIdx: 0,
      subIdx: 1,
      vIdx: 3, // Indiranagar, BLR (560038)
      name: 'Karnataka Farm Fresh Alphonso Mangoes 1kg',
      slug: 'alphonso-mangoes-1kg-local-test',
      description: 'Naturally ripened, fragrant Alphonso mangoes delivered locally.',
      sku: 'FRU-BLR-MNG-04',
      baseMrp: 450,
      baseSellingPrice: 380,
      thumbnail: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=500'
    },
    {
      catIdx: 0,
      subIdx: 1,
      vIdx: 4, // Bandra, Mumbai (400050)
      name: 'Maharashtra Sweet Dragon Fruit (2 Pcs)',
      slug: 'sweet-dragon-fruit-2pcs-local-test',
      description: 'Vibrant pink dragon fruit harvested fresh from coastal farms.',
      sku: 'FRU-MUM-DRG-05',
      baseMrp: 220,
      baseSellingPrice: 175,
      thumbnail: 'https://images.unsplash.com/photo-1527325678964-54921661f888?w=500'
    },

    // Category 2: Gourmet Artisan Bakery
    {
      catIdx: 1,
      subIdx: 0,
      vIdx: 0, // Madhapur, Hyd (500081)
      name: 'Slow-Fermented Classic Sourdough Country Loaf',
      slug: 'classic-sourdough-country-loaf-local-test',
      description: '36-hour slow fermented artisan sourdough loaf with crunchy crust and open crumb.',
      sku: 'BAK-HYD-SRD-01',
      baseMrp: 220,
      baseSellingPrice: 180,
      thumbnail: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500'
    },
    {
      catIdx: 1,
      subIdx: 0,
      vIdx: 1, // Gachibowli, Hyd (500032)
      name: 'Whole Wheat Olive & Rosemary Focaccia',
      slug: 'rosemary-olive-focaccia-local-test',
      description: 'Fluffy Italian focaccia topped with Kalamata olives, fresh rosemary and sea salt.',
      sku: 'BAK-HYD-FOC-02',
      baseMrp: 240,
      baseSellingPrice: 195,
      thumbnail: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=500'
    },
    {
      catIdx: 1,
      subIdx: 1,
      vIdx: 2, // Koramangala, BLR (560034)
      name: 'Belgian Dark Chocolate Ganache Pastry',
      slug: 'belgian-dark-chocolate-pastry-local-test',
      description: 'Rich 70% dark Belgian chocolate layered pastry with silky smooth ganache.',
      sku: 'BAK-BLR-PST-03',
      baseMrp: 190,
      baseSellingPrice: 150,
      thumbnail: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500'
    },
    {
      catIdx: 1,
      subIdx: 0,
      vIdx: 3, // Indiranagar, BLR (560038)
      name: 'Classic French Butter Croissants (Pack of 3)',
      slug: 'french-butter-croissants-3pack-local-test',
      description: 'Golden, ultra-flaky butter croissants made using traditional French lamination.',
      sku: 'BAK-BLR-CRO-04',
      baseMrp: 280,
      baseSellingPrice: 240,
      thumbnail: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=500'
    },
    {
      catIdx: 1,
      subIdx: 1,
      vIdx: 4, // Bandra, Mumbai (400050)
      name: 'Fresh Blueberry Lemon Tart 150g',
      slug: 'fresh-blueberry-lemon-tart-local-test',
      description: 'Zesty lemon curd pastry shell topped with fresh wild blueberries.',
      sku: 'BAK-MUM-TRT-05',
      baseMrp: 210,
      baseSellingPrice: 165,
      thumbnail: 'https://images.unsplash.com/photo-1519869325930-281384150729?w=500'
    },

    // Category 3: Handcrafted Living & Decor
    {
      catIdx: 2,
      subIdx: 0,
      vIdx: 0, // Madhapur, Hyd (500081)
      name: 'Handcrafted Terracotta Chai Kulhad Set (Pack of 6)',
      slug: 'terracotta-chai-kulhad-6pack-local-test',
      description: 'Artisanal natural clay tea cups crafted by local studio potters.',
      sku: 'DEC-HYD-KUL-01',
      baseMrp: 350,
      baseSellingPrice: 280,
      thumbnail: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=500'
    },
    {
      catIdx: 2,
      subIdx: 0,
      vIdx: 1, // Gachibowli, Hyd (500032)
      name: 'Studio Glazed Ceramic Coffee Mug (Ochre Yellow)',
      slug: 'glazed-ceramic-coffee-mug-ochre-local-test',
      description: 'Hand-thrown stoneware ceramic mug with ergonomic handle and food-safe glaze.',
      sku: 'DEC-HYD-MUG-02',
      baseMrp: 450,
      baseSellingPrice: 350,
      thumbnail: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500'
    },
    {
      catIdx: 2,
      subIdx: 1,
      vIdx: 2, // Koramangala, BLR (560034)
      name: 'Handwoven Natural Jute Table Runner (12x48 inch)',
      slug: 'handwoven-jute-table-runner-local-test',
      description: '100% natural braided jute runner with fringed edges for dining styling.',
      sku: 'DEC-BLR-JUT-03',
      baseMrp: 650,
      baseSellingPrice: 499,
      thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500'
    },
    {
      catIdx: 2,
      subIdx: 1,
      vIdx: 3, // Indiranagar, BLR (560038)
      name: 'Artisan Macrame Boho Wall Hanging',
      slug: 'artisan-macrame-wall-hanging-local-test',
      description: 'Intricately knotted organic cotton cord macrame on a natural driftwood rod.',
      sku: 'DEC-BLR-MAC-04',
      baseMrp: 899,
      baseSellingPrice: 699,
      thumbnail: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=500'
    },
    {
      catIdx: 2,
      subIdx: 0,
      vIdx: 4, // Bandra, Mumbai (400050)
      name: 'Handmade Rustic Ceramic Planter Bowl',
      slug: 'rustic-ceramic-planter-bowl-local-test',
      description: 'Textured stoneware succulent planter with bottom drainage hole.',
      sku: 'DEC-MUM-PLT-05',
      baseMrp: 550,
      baseSellingPrice: 420,
      thumbnail: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500'
    }
  ];

  const summary = [];

  for (const item of productsPlan) {
    const catGroup = seededCategories[item.catIdx];
    const category = catGroup.category;
    const subcategory = catGroup.subcategories[item.subIdx];
    const vKey = vendorKeys[item.vIdx];
    const { user: vUser, vendor: vVendor } = vendorMap[vKey];

    const prodDoc = {
      name: item.name,
      slug: item.slug,
      description: item.description,
      categoryId: category._id,
      subcategoryId: subcategory._id,
      subCategoryId: subcategory._id,
      productType: 'physical',
      itemType: 'PHYSICAL',
      sku: item.sku,
      baseMrp: item.baseMrp,
      baseSellingPrice: item.baseSellingPrice,
      stock: 100,
      moderationStatus: 'approved',
      status: 'Live',
      isActive: true,
      isArchived: false,
      createdBy: vUser._id,
      sellerId: vVendor._id,
      sellerType: 'vendor',
      // STRICT LOCAL DELIVERY - NO PAN-INDIA
      deliveryScope: 'local',
      isLocalDelivery: true,
      isPanIndia: false,
      isSelfPickup: true,
      thumbnail: item.thumbnail,
      images: [item.thumbnail],
      badges: ['Local Fresh', 'Verified Seller'],
      liveAt: new Date(),
      updatedAt: new Date()
    };

    let prod = await productsColl.findOne({ slug: item.slug });
    if (!prod) {
      prodDoc.createdAt = new Date();
      const res = await productsColl.insertOne(prodDoc);
      prod = { _id: res.insertedId, ...prodDoc };
      console.log(` Created Product: ${prod.name}`);
    } else {
      await productsColl.updateOne({ _id: prod._id }, { $set: prodDoc });
      console.log(` Updated Product: ${prod.name}`);
    }

    // Upsert StoreProduct
    await storeProductsColl.updateOne(
      { storeId: vVendor._id, productId: prod._id },
      {
        $set: {
          storeId: vVendor._id,
          productId: prod._id,
          mrp: item.baseMrp,
          sellingPrice: item.baseSellingPrice,
          minimumOrderQuantity: 1,
          preparationTimeMinutes: 20,
          deliveryTypes: ['express', 'same_day', 'standard'],
          isActive: true,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    summary.push({
      Category: category.name,
      Subcategory: subcategory.name,
      Product: prod.name,
      Price: `₹${item.baseSellingPrice}`,
      Scope: 'LOCAL ONLY (isPanIndia: false)',
      Vendor: vVendor.businessName,
      Pincode: vVendor.pincode,
      Location: `${vVendor.mandal}, ${vVendor.district}`
    });
  }

  console.log('\n======================================================');
  console.log(`🎉 COMPLETED: Successfully seeded 3 Categories, 6 Subcategories & 15 Localized Products to Direct Test DB!`);
  console.log('======================================================');
  console.table(summary);

  await mongoose.disconnect();
  console.log('Database connection closed cleanly.');
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
