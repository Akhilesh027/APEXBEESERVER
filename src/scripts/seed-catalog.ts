import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import mongoose from 'mongoose';
import Category from '../models/Category';
import Product from '../models/Product';
import { User } from '../models/User';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/apexbee_test';

// ---------- Unsplash CDN image helpers ----------
const unsplash = (query: string, w = 800, h = 600) =>
  `https://images.unsplash.com/photo-${query}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

// ---------- Category data: 10 parents + 20 subcategories ----------
const CAT_DATA = [
  {
    name: 'Electronics', slug: 'electronics',
    image: unsplash('1526170375885-4d8ecf77b99f'),
    subs: [
      { name: 'Mobile Phones',   slug: 'mobile-phones',   image: unsplash('1511707171634-5f897ff02aa9') },
      { name: 'Laptops',         slug: 'laptops',         image: unsplash('1496181133206-80ce9b88a853') },
    ]
  },
  {
    name: 'Fashion', slug: 'fashion',
    image: unsplash('1445205170230-053b83016050'),
    subs: [
      { name: "Men's Clothing",  slug: 'mens-clothing',   image: unsplash('1489987707849-4d058d4f0b03') },
      { name: "Women's Clothing",slug: 'womens-clothing',  image: unsplash('1483985988355-763728e1935b') },
    ]
  },
  {
    name: 'Home & Kitchen', slug: 'home-kitchen',
    image: unsplash('1556909114-f6e7ad7d3136'),
    subs: [
      { name: 'Cookware',        slug: 'cookware',        image: unsplash('1556909174-cd379d983013') },
      { name: 'Furniture',       slug: 'furniture',       image: unsplash('1555041469-a586c61ea9bc') },
    ]
  },
  {
    name: 'Beauty & Health', slug: 'beauty-health',
    image: unsplash('1522338242112-5b0c2d596165'),
    subs: [
      { name: 'Skincare',        slug: 'skincare',        image: unsplash('1556228720-195a672e8a03') },
      { name: 'Supplements',     slug: 'supplements',     image: unsplash('1559386484-97dfc0e15539') },
    ]
  },
  {
    name: 'Sports & Fitness', slug: 'sports-fitness',
    image: unsplash('1517836357463-d25dfeac3438'),
    subs: [
      { name: 'Gym Equipment',   slug: 'gym-equipment',   image: unsplash('1534438327276-14e5300c3a48') },
      { name: 'Sportswear',      slug: 'sportswear',      image: unsplash('1483721310020-03334b6d4f3f') },
    ]
  },
  {
    name: 'Books & Education', slug: 'books-education',
    image: unsplash('1481627834876-b7833e8f5570'),
    subs: [
      { name: 'Academic Books',  slug: 'academic-books',  image: unsplash('1456513080510-7bf3a84b82f8') },
      { name: 'Stationery',      slug: 'stationery',      image: unsplash('1452860606082-40af18af7dce') },
    ]
  },
  {
    name: 'Groceries', slug: 'groceries',
    image: unsplash('1542838132-92c53300491e'),
    subs: [
      { name: 'Organic Foods',   slug: 'organic-foods',   image: unsplash('1619566636858-adf3ef46400b') },
      { name: 'Dairy & Eggs',    slug: 'dairy-eggs',      image: unsplash('1550583724-b2692b85b150') },
    ]
  },
  {
    name: 'Toys & Kids', slug: 'toys-kids',
    image: unsplash('1558618666-fcd25c85cd64'),
    subs: [
      { name: 'Educational Toys', slug: 'educational-toys', image: unsplash('1587654780291-39c9404d746b') },
      { name: 'Outdoor Play',     slug: 'outdoor-play',     image: unsplash('1510166089-9f01d34c2c5f') },
    ]
  },
  {
    name: 'Automotive', slug: 'automotive',
    image: unsplash('1492144534655-ae79c964c9d7'),
    subs: [
      { name: 'Car Accessories',  slug: 'car-accessories',  image: unsplash('1449965408869-eaa3f722e40d') },
      { name: 'Bike Accessories', slug: 'bike-accessories', image: unsplash('1558981403-c5f9899a28bc') },
    ]
  },
  {
    name: 'Agriculture', slug: 'agriculture',
    image: unsplash('1464226184884-b5975f2c6fd4'),
    subs: [
      { name: 'Seeds & Plants',   slug: 'seeds-plants',    image: unsplash('1416879595882-3373a0480b5b') },
      { name: 'Farming Tools',    slug: 'farming-tools',   image: unsplash('1500651234828-c5df1edd5e71') },
    ]
  },
];

// ---------- Product catalogue: 5 products per category (50 total) ----------
type ProductEntry = {
  name: string; price: number; mrp: number; brand: string;
  desc: string; thumb: string; images: string[];
};

const PRODUCT_CATALOGUE: Record<string, ProductEntry[]> = {
  'electronics': [
    { name: 'Wireless Earbuds Pro', price: 1999, mrp: 2999, brand: 'SoundMax',
      desc: 'Premium TWS earbuds with ANC and 30-hour battery.',
      thumb: unsplash('1590658268037-41402bb7e3ce'),
      images: [unsplash('1590658268037-41402bb7e3ce'), unsplash('1505740420928-5e560c06d30e')] },
    { name: 'Smart LED TV 43"', price: 22999, mrp: 30000, brand: 'VisionX',
      desc: '4K Ultra HD Smart TV with Dolby Vision.',
      thumb: unsplash('1593784991095-a205069470b6'),
      images: [unsplash('1593784991095-a205069470b6')] },
    { name: 'Bluetooth Speaker 20W', price: 2499, mrp: 3500, brand: 'BoomBox',
      desc: 'Waterproof portable speaker with deep bass.',
      thumb: unsplash('1608043152269-423dbba4e7e1'),
      images: [unsplash('1608043152269-423dbba4e7e1')] },
    { name: 'USB-C Fast Charger 65W', price: 999, mrp: 1499, brand: 'PowerUp',
      desc: 'GaN technology charger, charges laptop & phone.',
      thumb: unsplash('1609091839311-d5365f9ff1c5'),
      images: [unsplash('1609091839311-d5365f9ff1c5')] },
    { name: 'Mechanical Keyboard RGB', price: 3999, mrp: 5500, brand: 'KeyMaster',
      desc: 'TKL mechanical keyboard with cherry MX switches.',
      thumb: unsplash('1587829741301-dc798b83add3'),
      images: [unsplash('1587829741301-dc798b83add3')] },
  ],
  'fashion': [
    { name: 'Classic Denim Jacket', price: 1899, mrp: 2800, brand: 'BlueCraft',
      desc: 'Slim-fit stretch denim jacket for men.',
      thumb: unsplash('1551537962-1a22b6cc6ae6'),
      images: [unsplash('1551537962-1a22b6cc6ae6')] },
    { name: 'Floral Maxi Dress', price: 1499, mrp: 2200, brand: 'FemStyle',
      desc: 'Lightweight summer maxi dress with floral print.',
      thumb: unsplash('1515372039744-b8f02a3ae446'),
      images: [unsplash('1515372039744-b8f02a3ae446')] },
    { name: 'Running Sneakers', price: 2799, mrp: 4000, brand: 'StridePro',
      desc: 'Lightweight cushioned running shoes.',
      thumb: unsplash('1542291026-7eec264c27ff'),
      images: [unsplash('1542291026-7eec264c27ff')] },
    { name: 'Formal Slim Fit Shirt', price: 999, mrp: 1500, brand: 'OfficeWear',
      desc: 'Wrinkle-free formal shirt for men.',
      thumb: unsplash('1489987707849-4d058d4f0b03'),
      images: [unsplash('1489987707849-4d058d4f0b03')] },
    { name: 'Leather Handbag', price: 3499, mrp: 5000, brand: 'LuxeBag',
      desc: 'Genuine leather handbag with multiple compartments.',
      thumb: unsplash('1548036161-18937c23dc56'),
      images: [unsplash('1548036161-18937c23dc56')] },
  ],
  'home-kitchen': [
    { name: 'Non-stick Cookware Set', price: 3999, mrp: 5500, brand: 'ChefKing',
      desc: '5-piece granite coated non-stick cookware set.',
      thumb: unsplash('1556909174-cd379d983013'),
      images: [unsplash('1556909174-cd379d983013')] },
    { name: 'Air Fryer 5L Digital', price: 5999, mrp: 8000, brand: 'CrispAir',
      desc: 'Digital air fryer with 12 preset programs.',
      thumb: unsplash('1585515320310-259814833e62'),
      images: [unsplash('1585515320310-259814833e62')] },
    { name: 'Wooden Dining Chair', price: 4499, mrp: 6000, brand: 'WoodCraft',
      desc: 'Solid teak wood dining chair with cushioned seat.',
      thumb: unsplash('1555041469-a586c61ea9bc'),
      images: [unsplash('1555041469-a586c61ea9bc')] },
    { name: 'Electric Kettle 1.8L', price: 1299, mrp: 1800, brand: 'QuickBoil',
      desc: 'Stainless steel electric kettle with auto shut-off.',
      thumb: unsplash('1595520407624-84c37ea0dfc7'),
      images: [unsplash('1595520407624-84c37ea0dfc7')] },
    { name: 'Bamboo Bedsheet Set', price: 2199, mrp: 3200, brand: 'SleepWell',
      desc: 'Organic bamboo bedsheet set, king size.',
      thumb: unsplash('1555041469-a586c61ea9bc'),
      images: [unsplash('1555041469-a586c61ea9bc')] },
  ],
  'beauty-health': [
    { name: 'Vitamin C Serum 30ml', price: 799, mrp: 1200, brand: 'GlowLab',
      desc: 'Brightening serum with 15% Vitamin C and Hyaluronic Acid.',
      thumb: unsplash('1556228720-195a672e8a03'),
      images: [unsplash('1556228720-195a672e8a03')] },
    { name: 'Protein Whey 2kg', price: 2499, mrp: 3500, brand: 'MuscleMax',
      desc: 'Whey protein isolate, 25g protein per serving.',
      thumb: unsplash('1559386484-97dfc0e15539'),
      images: [unsplash('1559386484-97dfc0e15539')] },
    { name: 'Hair Growth Serum', price: 599, mrp: 900, brand: 'HairRevive',
      desc: 'Biotin + DHT blocker formula for thicker hair.',
      thumb: unsplash('1522338242112-5b0c2d596165'),
      images: [unsplash('1522338242112-5b0c2d596165')] },
    { name: 'Sunscreen SPF 50+', price: 399, mrp: 599, brand: 'SunShield',
      desc: 'Matte finish broad-spectrum SPF 50+ sunscreen.',
      thumb: unsplash('1556228578-8c89e6adf883'),
      images: [unsplash('1556228578-8c89e6adf883')] },
    { name: 'Digital Blood Pressure Monitor', price: 1799, mrp: 2500, brand: 'HealthTrack',
      desc: 'FDA approved automatic BP monitor with memory.',
      thumb: unsplash('1576091160399-112ba8d25d1d'),
      images: [unsplash('1576091160399-112ba8d25d1d')] },
  ],
  'sports-fitness': [
    { name: 'Yoga Mat 6mm Non-slip', price: 799, mrp: 1200, brand: 'FlexPro',
      desc: 'Eco-friendly TPE yoga mat with alignment lines.',
      thumb: unsplash('1544367567-0f2fcb009e0b'),
      images: [unsplash('1544367567-0f2fcb009e0b')] },
    { name: 'Adjustable Dumbbell 20kg', price: 4999, mrp: 7000, brand: 'IronFit',
      desc: 'Adjustable dumbbell set with quick-change mechanism.',
      thumb: unsplash('1534438327276-14e5300c3a48'),
      images: [unsplash('1534438327276-14e5300c3a48')] },
    { name: 'Running Track Pants', price: 1299, mrp: 1800, brand: 'SpeedRun',
      desc: '4-way stretch running pants with reflective strips.',
      thumb: unsplash('1483721310020-03334b6d4f3f'),
      images: [unsplash('1483721310020-03334b6d4f3f')] },
    { name: 'Smart Fitness Band', price: 2999, mrp: 4500, brand: 'FitBand',
      desc: 'Heart rate, SpO2, sleep tracking smartband.',
      thumb: unsplash('1617196034183-421b4040ed20'),
      images: [unsplash('1617196034183-421b4040ed20')] },
    { name: 'Resistance Bands Set', price: 499, mrp: 799, brand: 'ResistX',
      desc: 'Set of 5 resistance bands, 10-50 lbs.',
      thumb: unsplash('1598971639058-fab3c3109a13'),
      images: [unsplash('1598971639058-fab3c3109a13')] },
  ],
  'books-education': [
    { name: 'NCERT Class 12 Physics', price: 349, mrp: 499, brand: 'NCERT',
      desc: 'Complete NCERT Physics Part 1 & 2 for Class 12.',
      thumb: unsplash('1481627834876-b7833e8f5570'),
      images: [unsplash('1481627834876-b7833e8f5570')] },
    { name: 'Coding Bootcamp Handbook', price: 699, mrp: 999, brand: 'TechPress',
      desc: 'Full-stack web development bootcamp reference guide.',
      thumb: unsplash('1517694712202-14dd9538aa97'),
      images: [unsplash('1517694712202-14dd9538aa97')] },
    { name: 'Premium Notebook A4 200pg', price: 299, mrp: 450, brand: 'PaperMate',
      desc: 'Hardbound spiral notebook with dot grid pages.',
      thumb: unsplash('1452860606082-40af18af7dce'),
      images: [unsplash('1452860606082-40af18af7dce')] },
    { name: 'Geometry Set Compass Box', price: 199, mrp: 299, brand: 'StatMath',
      desc: 'Complete geometry set with compass, protractor, divider.',
      thumb: unsplash('1456513080510-7bf3a84b82f8'),
      images: [unsplash('1456513080510-7bf3a84b82f8')] },
    { name: 'Scientific Calculator FX-991', price: 1099, mrp: 1499, brand: 'Casio',
      desc: 'Non-programmable scientific calculator, 417 functions.',
      thumb: unsplash('1611532736597-de2d4265fba3'),
      images: [unsplash('1611532736597-de2d4265fba3')] },
  ],
  'groceries': [
    { name: 'Organic Turmeric Powder 500g', price: 299, mrp: 450, brand: 'OrganicIndia',
      desc: 'Pure organic turmeric powder, lab tested.',
      thumb: unsplash('1601493700631-2b16ec4b4716'),
      images: [unsplash('1601493700631-2b16ec4b4716')] },
    { name: 'Cold-pressed Coconut Oil 1L', price: 499, mrp: 699, brand: 'NaturePure',
      desc: 'Virgin cold-pressed coconut oil, wood-pressed.',
      thumb: unsplash('1619566636858-adf3ef46400b'),
      images: [unsplash('1619566636858-adf3ef46400b')] },
    { name: 'Farm Fresh Eggs (30 pcs)', price: 249, mrp: 320, brand: 'FarmDirect',
      desc: 'Free-range brown eggs, farm to doorstep.',
      thumb: unsplash('1550583724-b2692b85b150'),
      images: [unsplash('1550583724-b2692b85b150')] },
    { name: 'Multigrain Atta 10kg', price: 649, mrp: 850, brand: 'NutriGrain',
      desc: '7-grain atta blend, high fibre and protein.',
      thumb: unsplash('1574323347407-f5e1ad6d020b'),
      images: [unsplash('1574323347407-f5e1ad6d020b')] },
    { name: 'Honey Raw Unfiltered 500g', price: 399, mrp: 599, brand: 'HoneyBee',
      desc: 'Forest raw honey, unheated and unfiltered.',
      thumb: unsplash('1558642452-9d2a7deb7f62'),
      images: [unsplash('1558642452-9d2a7deb7f62')] },
  ],
  'toys-kids': [
    { name: 'Building Blocks 200pcs', price: 999, mrp: 1500, brand: 'BrickWorld',
      desc: 'STEM educational building block set for kids 5+.',
      thumb: unsplash('1587654780291-39c9404d746b'),
      images: [unsplash('1587654780291-39c9404d746b')] },
    { name: 'Remote Control Car', price: 1499, mrp: 2200, brand: 'TurboKid',
      desc: '4WD off-road RC car with 2.4GHz remote control.',
      thumb: unsplash('1558618666-fcd25c85cd64'),
      images: [unsplash('1558618666-fcd25c85cd64')] },
    { name: 'Waterproof Slide Set', price: 3999, mrp: 5500, brand: 'PlayZone',
      desc: 'Outdoor inflatable water slide for kids 3–10.',
      thumb: unsplash('1510166089-9f01d34c2c5f'),
      images: [unsplash('1510166089-9f01d34c2c5f')] },
    { name: 'Art & Craft Kit 100pcs', price: 699, mrp: 1000, brand: 'CreativeKids',
      desc: 'Complete art kit with watercolors, brushes, canvas.',
      thumb: unsplash('1513364776144-60967b0f800f'),
      images: [unsplash('1513364776144-60967b0f800f')] },
    { name: 'Wooden Puzzle 100pcs', price: 549, mrp: 799, brand: 'MindWood',
      desc: 'Hand-painted wooden puzzle, animals theme.',
      thumb: unsplash('1533294160057-3e2a9ba87647'),
      images: [unsplash('1533294160057-3e2a9ba87647')] },
  ],
  'automotive': [
    { name: 'Car Dash Cam HD 1080p', price: 3499, mrp: 5000, brand: 'DriveCam',
      desc: 'Front & rear dual-lens dashcam with night vision.',
      thumb: unsplash('1449965408869-eaa3f722e40d'),
      images: [unsplash('1449965408869-eaa3f722e40d')] },
    { name: 'Tyre Inflator Cordless', price: 2999, mrp: 4200, brand: 'PumpPro',
      desc: 'Digital portable tyre inflator with auto shut-off.',
      thumb: unsplash('1492144534655-ae79c964c9d7'),
      images: [unsplash('1492144534655-ae79c964c9d7')] },
    { name: 'Bike Chain Lubricant', price: 299, mrp: 450, brand: 'ChainMax',
      desc: 'Dry PTFE bicycle chain lubricant, 150ml.',
      thumb: unsplash('1558981403-c5f9899a28bc'),
      images: [unsplash('1558981403-c5f9899a28bc')] },
    { name: 'Helmet Full Face', price: 2499, mrp: 3500, brand: 'SafeRide',
      desc: 'ISI certified full-face motorcycle helmet.',
      thumb: unsplash('1558618666-fcd25c85cd64'),
      images: [unsplash('1558618666-fcd25c85cd64')] },
    { name: 'Car Seat Cover Set', price: 1799, mrp: 2500, brand: 'ComfortDrive',
      desc: 'Universal fit leatherette seat cover 5-piece set.',
      thumb: unsplash('1494976388531-d1058494cdd8'),
      images: [unsplash('1494976388531-d1058494cdd8')] },
  ],
  'agriculture': [
    { name: 'Hybrid Tomato Seeds (50g)', price: 199, mrp: 299, brand: 'AgriSeed',
      desc: 'F1 hybrid tomato seeds, high yield variety.',
      thumb: unsplash('1416879595882-3373a0480b5b'),
      images: [unsplash('1416879595882-3373a0480b5b')] },
    { name: 'Garden Hand Trowel Set', price: 599, mrp: 899, brand: 'GreenHand',
      desc: 'Stainless steel ergonomic trowel set, 3pcs.',
      thumb: unsplash('1500651234828-c5df1edd5e71'),
      images: [unsplash('1500651234828-c5df1edd5e71')] },
    { name: 'Drip Irrigation Kit 50m', price: 1299, mrp: 1900, brand: 'WaterWise',
      desc: 'Complete drip irrigation kit for home garden.',
      thumb: unsplash('1464226184884-b5975f2c6fd4'),
      images: [unsplash('1464226184884-b5975f2c6fd4')] },
    { name: 'NPK Fertilizer 5kg', price: 499, mrp: 750, brand: 'GrowFast',
      desc: 'Water-soluble NPK 19:19:19 balanced fertilizer.',
      thumb: unsplash('1524492412937-b28074a5d7da'),
      images: [unsplash('1524492412937-b28074a5d7da')] },
    { name: 'Sprayer Pump 16L Knapsack', price: 1999, mrp: 2800, brand: 'SprayMaster',
      desc: '16L capacity knapsack pressure sprayer pump.',
      thumb: unsplash('1464226184884-b5975f2c6fd4'),
      images: [unsplash('1464226184884-b5975f2c6fd4')] },
  ],
};

async function seedCatalog() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Find an existing vendor to attach products to
  const vendor = await User.findOne({ roles: 'vendor' }).lean();
  if (!vendor) {
    console.error('No vendor found! Please create a vendor account first.');
    process.exit(1);
  }
  const sellerId = vendor._id;
  console.log('Using seller:', sellerId);

  // Delete previous demo categories/products
  await Category.deleteMany({ slug: { $in: CAT_DATA.map(c => c.slug) } });
  const slugsAll = CAT_DATA.flatMap(c => [c.slug, ...c.subs.map(s => s.slug)]);
  await Category.deleteMany({ slug: { $in: slugsAll } });
  await Product.deleteMany({ sku: /^DEMO-SEED-/ });

  // Insert 10 parent categories
  const parentDocs = CAT_DATA.map((c, i) => ({
    name: c.name,
    slug: c.slug,
    image: c.image,
    level: 1,
    isActive: true,
    sortOrder: i + 1,
    brands: [],
    attributes: [],
    parentId: null,
  }));
  const parents = await Category.insertMany(parentDocs);
  console.log(`Inserted ${parents.length} parent categories.`);

  // Insert 20 subcategories (2 per parent)
  const subDocs = CAT_DATA.flatMap((c, i) =>
    c.subs.map((s, j) => ({
      name: s.name,
      slug: s.slug,
      image: s.image,
      level: 2,
      isActive: true,
      sortOrder: j + 1,
      brands: [],
      attributes: [],
      parentId: parents[i]._id,
    }))
  );
  const subs = await Category.insertMany(subDocs);
  console.log(`Inserted ${subs.length} subcategories.`);

  // Insert 50 products (5 per parent category)
  const productDocs: any[] = [];
  let skuIndex = 1;

  for (let i = 0; i < CAT_DATA.length; i++) {
    const parent = parents[i];
    const catSlug = CAT_DATA[i].slug;
    const entries = PRODUCT_CATALOGUE[catSlug] || [];
    const subCat = subs[i * 2]; // first subcategory of this parent

    for (const entry of entries) {
      const discount = Math.round(((entry.mrp - entry.price) / entry.mrp) * 100);
      productDocs.push({
        sellerId,
        sellerType: 'vendor',
        name: entry.name,
        slug: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: entry.desc,
        categoryId: parent._id,
        subCategoryId: subCat?._id || null,
        brand: entry.brand,
        sku: `DEMO-SEED-${String(skuIndex++).padStart(4, '0')}`,
        thumbnail: entry.thumb,
        images: entry.images,
        baseMrp: entry.mrp,
        discountPercent: discount,
        baseSellingPrice: entry.price,
        stock: Math.floor(Math.random() * 200) + 20,
        status: 'Live',
        isActive: true,
        adminPricingApproved: true,
        sellerPricingAccepted: true,
        liveAt: new Date(),
        attributes: {},
        variants: [],
        sellerNegotiations: [],
      });
    }
  }

  await Product.insertMany(productDocs);
  console.log(`Inserted ${productDocs.length} products.`);

  console.log('\n=======================================');
  console.log('SEEDED: 10 Categories + 20 Subcategories + 50 Products');
  console.log('=======================================');
  process.exit(0);
}

seedCatalog().catch(err => {
  console.error('Catalog seeding failed:', err);
  process.exit(1);
});
