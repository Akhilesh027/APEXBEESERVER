import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { Vendor } from "./src/models/Vendor";
import Product from "./src/models/Product";
import StoreProduct from "./src/models/StoreProduct";
import Category from "./src/models/Category";

dotenv.config();

const UNSPLASH_IMAGES = {
  groceries: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1588964895597-cfccd6e2dbf9?auto=format&fit=crop&w=400&h=300&q=80"
  ],
  produce: [
    "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&h=300&q=80"
  ],
  dairy: [
    "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1527018601619-a508a2be00cd?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=400&h=300&q=80"
  ],
  flowers: [
    "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1533644777553-6efdcbe51737?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=400&h=300&q=80"
  ],
  water: [
    "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1560060141-729778bfa9af?auto=format&fit=crop&w=400&h=300&q=80"
  ],
  generic: [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=400&h=300&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&h=300&q=80"
  ]
};

const getCategoryKeywords = (name: string): string => {
  const norm = name.toLowerCase();
  if (norm.includes("grocer") || norm.includes("daily") || norm.includes("need")) return "groceries";
  if (norm.includes("veg") || norm.includes("fruit") || norm.includes("produce")) return "produce";
  if (norm.includes("milk") || norm.includes("dairy") || norm.includes("curd")) return "dairy";
  if (norm.includes("flower") || norm.includes("puja") || norm.includes("pooja")) return "flowers";
  if (norm.includes("water") || norm.includes("can")) return "water";
  return "generic";
};

const getTemplateProducts = (catName: string) => {
  const type = getCategoryKeywords(catName);
  switch (type) {
    case "groceries":
      return [
        { name: "Organic Basmati Rice 5kg", mrp: 650, price: 520, imgIdx: 0, desc: "Premium long grain aromatic basmati rice." },
        { name: "Cold Pressed Groundnut Oil 1L", mrp: 260, price: 220, imgIdx: 1, desc: "100% pure cold pressed groundnut oil." },
        { name: "Premium Cashew Nuts 500g", mrp: 550, price: 480, imgIdx: 2, desc: "Rich and crunchy whole cashew nuts." },
        { name: "Organic Toor Dal 1kg", mrp: 180, price: 145, imgIdx: 3, desc: "High protein unpolished yellow toor dal." }
      ];
    case "produce":
      return [
        { name: "Fresh Red Tomatoes 1kg", mrp: 60, price: 40, imgIdx: 0, desc: "Locally sourced juicy red tomatoes." },
        { name: "Farm Fresh Potatoes 2kg", mrp: 80, price: 58, imgIdx: 1, desc: "Clean and freshly harvested crop potatoes." },
        { name: "Sweet Cavendish Bananas 1 Dozen", mrp: 70, price: 50, imgIdx: 2, desc: "Ripe sweet yellow bananas." },
        { name: "Organic Palak (Spinach) Bunch", mrp: 30, price: 22, imgIdx: 3, desc: "Fresh green nutrient-rich spinach leaves." }
      ];
    case "dairy":
      return [
        { name: "Nandini Full Cream Milk 1L", mrp: 62, price: 58, imgIdx: 0, desc: "Fresh full cream milk direct from dairies." },
        { name: "Pure Cow Ghee 500ml", mrp: 380, price: 340, imgIdx: 1, desc: "Traditional aromatic pure cow ghee." },
        { name: "Fresh Paneer Cottage Cheese 200g", mrp: 110, price: 90, imgIdx: 2, desc: "Soft and fresh home-style cottage cheese." },
        { name: "Creamy Thick Curd 500g", mrp: 50, price: 44, imgIdx: 3, desc: "Pasteurized thick set natural curd." }
      ];
    case "flowers":
      return [
        { name: "Fresh Kakada Jasmine Flowers 250g", mrp: 120, price: 90, imgIdx: 0, desc: "Fragrant fresh local white jasmine flowers." },
        { name: "Marigold Pooja Garland 1pc", mrp: 60, price: 45, imgIdx: 1, desc: "Beautiful yellow and orange marigold garland." },
        { name: "Premium Puja Samagri Kit", mrp: 350, price: 290, imgIdx: 2, desc: "Complete pack of deepam, haldi, kumkum, and incense." },
        { name: "Fresh Puja Coconut 1pc", mrp: 35, price: 28, imgIdx: 3, desc: "Auspicous clean water-filled brown coconut." }
      ];
    case "water":
      return [
        { name: "Bisleri Purified Water Can 20L", mrp: 90, price: 70, imgIdx: 0, desc: "Trusted purified 20 liter drinking water can." },
        { name: "Kinley 20L Bubbletop Can", mrp: 85, price: 65, imgIdx: 1, desc: "Mineral enriched safe bubbletop water can." },
        { name: "Aquafina 20L Water Can", mrp: 90, price: 75, imgIdx: 2, desc: "Premium purity multi-filtered water can." },
        { name: "Local Purified 20L Bubbletop Can", mrp: 40, price: 30, imgIdx: 3, desc: "Economical hygienic reverse osmosis water." }
      ];
    default:
      return [
        { name: `${catName} Premium Item A`, mrp: 200, price: 155, imgIdx: 0, desc: `Premium quality item sourced for ${catName}.` },
        { name: `${catName} Elite Choice B`, mrp: 450, price: 360, imgIdx: 1, desc: `Top grade collection item from ${catName} line.` },
        { name: `${catName} Everyday Pack C`, mrp: 120, price: 95, imgIdx: 2, desc: `Regular use essential item from ${catName}.` },
        { name: `${catName} Smart Value D`, mrp: 300, price: 220, imgIdx: 3, desc: `High value choice package in ${catName}.` }
      ];
  }
};

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("MONGODB_URI is not set in environment.");
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log("Connected to MongoDB database.");

    // 1. Get or create vendor user
    const email = "vendor@gmail.com";
    let user = await User.findOne({ email });
    if (!user) {
      console.log(`User ${email} not found. Creating...`);
      user = new User({
        name: "Nellore Fresh Vendor",
        email,
        phone: "9988776655",
        roles: ["vendor", "customer"],
        passwordHash: "$2a$10$7R31Qh1H4bXmE5G.h8GqI.X2g5T25t.v3L1j1A.m2B3C4D5E6F7G8" // mock hash for password123
      });
      await user.save();
    }
    console.log(`Vendor User verified: ${user.name} (${user._id})`);

    // 2. Ensure Vendor document exists
    let vendor = await Vendor.findOne({ userId: user._id });
    if (!vendor) {
      console.log(`Vendor profile for user ${user._id} not found. Creating...`);
      vendor = new Vendor({
        userId: user._id,
        businessName: "Nellore Fresh & Local Store",
        ownerName: "Nellore Vendor",
        mobile: "9988776655",
        email,
        state: "Andhra Pradesh",
        district: "SPSR Nellore",
        mandal: "Nellore",
        address: "Mypadu Gate, Nellore, AP",
        pincode: "524002",
        status: "active",
        marketplaceStatus: "Approved",
        location: {
          type: "Point",
          coordinates: [79.9865, 14.4426] // Nellore coordinates [lng, lat]
        },
        deliveryMode: "platform_delivery",
        deliveryRadiusKm: 15,
        estimatedDeliveryMinutes: 20
      });
      await vendor.save();
    }
    console.log(`Vendor profile verified: ${vendor.businessName} (${vendor._id})`);

    // 3. Clear existing Products and StoreProducts
    console.log("Clearing all products and store products from the database...");
    const delProducts = await Product.deleteMany({});
    const delStore = await StoreProduct.deleteMany({});
    console.log(`Deleted ${delProducts.deletedCount} products and ${delStore.deletedCount} store products.`);

    // 4. Fetch all categories
    const categories = await Category.find({});
    console.log(`Found ${categories.length} categories to seed.`);

    // 5. Seed 4 products per category
    let totalSeeded = 0;
    for (const cat of categories) {
      const templates = getTemplateProducts(cat.name);
      const imgType = getCategoryKeywords(cat.name);
      const imagesList = UNSPLASH_IMAGES[imgType] || UNSPLASH_IMAGES.generic;

      console.log(`Seeding category: ${cat.name} (${imgType})`);
      for (const t of templates) {
        const imgUrl = imagesList[t.imgIdx] || imagesList[0];
        
        // Create Product
        const product = new Product({
          name: t.name,
          slug: `${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`,
          description: t.desc,
          categoryId: cat._id,
          subcategoryId: cat._id, // fallback
          productType: "physical",
          moderationStatus: "approved",
          status: "Live",
          isActive: true,
          createdBy: user._id,
          sellerId: user._id,
          sellerType: "vendor",
          sku: `SKU-${cat.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          baseMrp: t.mrp,
          baseSellingPrice: t.price,
          discountPercent: Math.round(((t.mrp - t.price) / t.mrp) * 100),
          stock: 100,
          thumbnail: imgUrl,
          images: [imgUrl],
          isStoreProduct: true,
          isActiveStorefront: true,
          adminPricingApproved: true,
          sellerPricingAccepted: true,
          isSubscriptionAvailable: t.name.includes("Toor Dal") || t.name.includes("Milk") || t.name.includes("Water"),
          referralCommission: {
            level1: 5,
            level2: 3,
            level3: 2
          },
          brand: vendor.businessName
        });
        await product.save();

        // Create variant (mock dummy Object ID for variantId)
        const dummyVariantId = new mongoose.Types.ObjectId();

        // Create corresponding StoreProduct
        const storeProduct = new StoreProduct({
          storeId: vendor._id,
          productId: product._id,
          variantId: dummyVariantId,
          mrp: t.mrp,
          sellingPrice: t.price,
          minimumOrderQuantity: 1,
          preparationTimeMinutes: 15,
          deliveryTypes: ["express", "standard"],
          isActive: true
        });
        await storeProduct.save();
        totalSeeded++;
      }
    }

    console.log(`Successfully seeded ${totalSeeded} products and matching store products!`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed with error:", err);
    process.exit(1);
  }
};

run();
