"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const ReferralSettings_1 = require("../models/ReferralSettings");
const CommissionRule_1 = require("../models/CommissionRule");
const SettlementEngine_1 = require("../services/SettlementEngine");
const WalletEngine_1 = require("../services/WalletEngine");
const User_1 = require("../models/User");
const Campaign_1 = require("../models/Campaign");
const Lead_1 = require("../models/Lead");
const Product_1 = __importDefault(require("../models/Product"));
const LocalShopSubscription_1 = __importDefault(require("../models/LocalShopSubscription"));
const B2bPo_1 = require("../models/B2bPo");
const Category_1 = __importDefault(require("../models/Category"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importDefault(require("mongoose"));
const Banner_1 = require("../models/Banner");
const Restaurant_1 = require("../models/Restaurant");
const ServiceProvider_1 = require("../models/ServiceProvider");
const seedCategories = async () => {
    const parentCount = await Category_1.default.countDocuments({ parentId: null, image: { $exists: true } });
    if (parentCount === 15) {
        console.log("[Seeder] Categories already seeded with images.");
        return;
    }
    console.log("[Seeder] Re-seeding new category hierarchy with images...");
    await Category_1.default.deleteMany({});
    try {
        const Subcategory = mongoose_1.default.model('Subcategory');
        await Subcategory.deleteMany({});
    }
    catch (err) { }
    const categoriesToSeed = [
        {
            name: "📢 Promotional",
            slug: "promotional",
            image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Hot Deals", "Combo Offers", "Clearance Sale", "New Arrivals"]
        },
        {
            name: "🛒 Daily Needs",
            slug: "daily-needs",
            image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Groceries", "Dairy & Eggs", "Fruits & Vegetables", "Bakery & Bread", "Household Supplies"]
        },
        {
            name: "🍽 Food & Dining",
            slug: "food-dining",
            image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Restaurants", "Cafes & Bakeries", "Fast Food", "Catering Services", "Desserts & Sweets"]
        },
        {
            name: "💼 Business Hub",
            slug: "business-hub",
            image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Office Supplies", "B2B Raw Materials", "Business Consulting", "Co-working Spaces", "Marketing Services"]
        },
        {
            name: "🛍 Shopping",
            slug: "shopping",
            image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Electronics", "Fashion & Apparel", "Home & Living", "Footwear", "Accessories"]
        },
        {
            name: "🎓 ApexBee Academy { MVP}",
            slug: "apexbee-academy",
            image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Online Courses", "Skill Development", "Career Counseling", "School Tuitions", "Tech Workshops"]
        },
        {
            name: "🛠 Services",
            slug: "services",
            image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Home Cleaning", "Plumbing & Electrical", "Appliance Repair", "Pest Control", "Carpenter Services"]
        },
        {
            name: "💰 Finance",
            slug: "finance",
            image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Tax Consulting", "Investment Advisory", "Insurance Services", "Loans & Mortgages", "Accounting Services"]
        },
        {
            name: "🎉 Events",
            slug: "events",
            image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Wedding Planners", "Birthday Parties", "Corporate Events", "Venue Booking", "Stage Decoration"]
        },
        {
            name: "✈ Tours & Travels",
            slug: "tours-travels",
            image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Flight Bookings", "Hotel Packages", "Car & Bus Rentals", "Holiday Tours", "Visa Assistance"]
        },
        {
            name: "🐾 Pets",
            slug: "pets",
            image: "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Pet Food", "Pet Grooming", "Veterinary Care", "Pet Accessories", "Pet Boarding"]
        },
        {
            name: "❤ Health & Wellness",
            slug: "health-wellness",
            image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Pharmacies", "Fitness & Gyms", "Yoga & Meditation", "Clinics & Doctors", "Personal Care"]
        },
        {
            name: "👶 Kids World",
            slug: "kids-world",
            image: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Toys & Games", "Baby Care", "Kids Clothing", "Maternity Care", "School Supplies"]
        },
        {
            name: "👑 Women's Empire ⭐",
            slug: "womens-empire",
            image: "https://images.unsplash.com/photo-1534798580922-24354465df93?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Boutiques & Tailoring", "Beauty Salons", "Handmade Crafts", "Jewelry", "Women Startups"]
        },
        {
            name: "🚚 Delivery & Logistics",
            slug: "delivery-logistics",
            image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600",
            subcategories: ["Local Courier", "Packers & Movers", "Freight Transport", "Express Delivery", "Warehouse Services"]
        }
    ];
    for (const item of categoriesToSeed) {
        const parent = await Category_1.default.create({
            name: item.name,
            slug: item.slug,
            image: item.image,
            banner: item.image,
            level: 1,
            isActive: true,
            displayOrder: 0
        });
        for (const subName of item.subcategories) {
            const subSlug = subName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            await Category_1.default.create({
                name: subName,
                slug: `${item.slug}-${subSlug}`,
                image: item.image,
                banner: item.image,
                level: 2,
                parentId: parent._id,
                isActive: true
            });
            try {
                const Subcategory = mongoose_1.default.model('Subcategory');
                await Subcategory.create({
                    categoryId: parent._id,
                    name: subName,
                    slug: subSlug,
                    image: item.image,
                    banner: item.image,
                    isActive: true
                });
            }
            catch (err) { }
        }
    }
    console.log("[Seeder] Categories hierarchy with images seeded successfully.");
};
const seedDatabase = async () => {
    try {
        console.log("Seeding database...");
        await seedCategories();
        // 1. ReferralSettings, Campaigns and Leads checks in parallel
        const [referralSettingsCount, campaignCount, leadCount] = await Promise.all([
            ReferralSettings_1.ReferralSettings.countDocuments({}),
            Campaign_1.Campaign.countDocuments({}),
            Lead_1.Lead.countDocuments({})
        ]);
        const seedTasks = [];
        if (referralSettingsCount === 0) {
            seedTasks.push(ReferralSettings_1.ReferralSettings.create({
                firstOrderRewards: {
                    level1: 0,
                    level2: 25,
                    level3: 10
                },
                enabled: true,
                defaultReferralCode: "APEXBEE"
            }).then(() => console.log("Seeded default ReferralSettings")));
        }
        // 2. Seed System Profiles & Wallets (Wallets depend on profiles existing, so run sequentially to ensure profile exists)
        const seedSystemWallets = async () => {
            await SettlementEngine_1.SettlementEngine.ensureSystemProfiles();
            await Promise.all([
                WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.COMPANY_ID),
                WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.WISHLINK_ID),
                WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.REFERRAL_POOL_ID)
            ]);
            console.log("Seeded default System Profiles & Wallets");
        };
        seedTasks.push(seedSystemWallets());
        // 3. Seed default CommissionRules in parallel
        const rules = [
            { businessType: "vendor", entrepreneurPercent: 10, mandalPercent: 5, districtPercent: 3, statePercent: 2, companyPercent: 80 },
            { businessType: "wholesaler", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 },
            { businessType: "manufacturer", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 }
        ];
        const seedRules = async () => {
            await Promise.all(rules.map(async (rule) => {
                const existingRule = await CommissionRule_1.CommissionRule.findOne({ businessType: rule.businessType });
                if (!existingRule) {
                    await CommissionRule_1.CommissionRule.create(rule);
                    console.log(`Seeded default CommissionRule for ${rule.businessType}`);
                }
            }));
        };
        seedTasks.push(seedRules());
        if (campaignCount === 0) {
            const seedCampaigns = async () => {
                const adminUser = await User_1.User.findOne({ roles: "admin" }) || await User_1.User.findOne({});
                if (adminUser) {
                    await Campaign_1.Campaign.create([
                        { ownerId: adminUser._id, name: 'Monsoon Seed Discount Banner', type: 'Homepage Banner Carousel', budget: 15000, status: 'Active' },
                        { ownerId: adminUser._id, name: 'boAt Earbuds Sponsored Push', type: 'Category Listing Sponsored', budget: 8500, status: 'Active' },
                        { ownerId: adminUser._id, name: 'Pune Franchise launch offer', type: 'Franchise Promotions widget', budget: 12000, status: 'Paused' },
                        { ownerId: adminUser._id, name: 'NPK Fertilizer promo card', type: 'Homepage Ad grids', budget: 5000, status: 'Pending Approval' }
                    ]);
                    console.log("Seeded default Campaigns linked to user:", adminUser.email);
                }
            };
            seedTasks.push(seedCampaigns());
        }
        if (leadCount === 0) {
            seedTasks.push(Lead_1.Lead.create([
                { name: "Kiran Kumar", mobile: "9876543201", email: "kiran@gmail.com", source: "Online Inquiry", status: "New" },
                { name: "Rahul Saini", mobile: "9876543202", email: "rahul@gmail.com", source: "Referral", status: "Contacted" },
                { name: "Divya Gupta", mobile: "9876543203", email: "divya@gmail.com", source: "Manual", status: "Follow-up" },
                { name: "Suresh Patil", mobile: "9876543204", email: "suresh@gmail.com", source: "Online Inquiry", status: "Converted" },
                { name: "Priya Singh", mobile: "9876543205", email: "priya@gmail.com", source: "Campaign", status: "Lost" },
                { name: "Anil Deshmukh", mobile: "9876543206", email: "anil@gmail.com", source: "Referral", status: "New" }
            ]).then(() => console.log("Seeded default Leads")));
        }
        // 4. Seed Wholesalers and Manufacturers
        const seedSuppliersAndProducts = async () => {
            const existingWholesaler = await User_1.User.findOne({ email: "nellore@wholesaler.com" });
            if (!existingWholesaler) {
                const salt = await bcryptjs_1.default.genSalt(10);
                const passwordHash = await bcryptjs_1.default.hash("apexbee123", salt);
                // Create Wholesaler User
                const wholesaler = await User_1.User.create({
                    name: "Nellore Wholesale Ltd",
                    email: "nellore@wholesaler.com",
                    passwordHash,
                    phone: "9100011122",
                    roles: ["wholesaler"],
                    status: "active",
                    isVerified: true,
                    sellerProfile: {
                        businessName: "Nellore Wholesale Distributors",
                        businessType: "Wholesaler",
                        gstNumber: "37AAAAA0000A1Z5",
                        panNumber: "ABCDE1234F",
                        aadhaarNumber: "123456789012",
                        addressText: "Main Sourcing Hub, Nellore, Andhra Pradesh",
                        kycStatus: "Approved"
                    }
                });
                console.log("Seeded wholesaler: nellore@wholesaler.com");
                // Create Manufacturer User
                const manufacturer = await User_1.User.create({
                    name: "Buchireddypalem Agro Mill",
                    email: "agro@manufacturer.com",
                    passwordHash,
                    phone: "9100011133",
                    roles: ["manufacturer"],
                    status: "active",
                    isVerified: true,
                    sellerProfile: {
                        businessName: "Buchireddypalem Agro Millers",
                        businessType: "Manufacturer",
                        gstNumber: "37AAAAA1111A1Z5",
                        panNumber: "ABCDE5678F",
                        aadhaarNumber: "123456789013",
                        addressText: "Mill Zone area, Buchireddypalem, Andhra Pradesh",
                        kycStatus: "Approved"
                    }
                });
                console.log("Seeded manufacturer: agro@manufacturer.com");
                // Get or create Category
                let cat = await Category_1.default.findOne({ name: "Groceries" });
                if (!cat) {
                    cat = await Category_1.default.findOne({ name: "Daily Needs" });
                }
                if (!cat) {
                    cat = await Category_1.default.create({
                        name: "Groceries",
                        slug: "groceries",
                        level: 1,
                        brands: ["Local"],
                        attributes: {}
                    });
                }
                // Seed products for Wholesaler
                const wProd = await Product_1.default.create({
                    sellerId: wholesaler._id,
                    sellerType: "wholesaler",
                    name: "Premium Basmati Rice",
                    slug: "premium-basmati-rice",
                    description: "100% long grain premium aromatic basmati rice direct from state sourcing mills.",
                    categoryId: cat._id,
                    brand: "Nellore Wholesale Distributors",
                    sku: "W-RICE-100",
                    baseMrp: 120,
                    discountPercent: 30,
                    baseSellingPrice: 84, // wholesale price
                    stock: 5000,
                    status: "Live",
                    isActive: true,
                    adminPricingApproved: true,
                    sellerPricingAccepted: true
                });
                console.log("Seeded wholesaler product: Premium Basmati Rice");
                // Seed products for Manufacturer
                const mProd = await Product_1.default.create({
                    sellerId: manufacturer._id,
                    sellerType: "manufacturer",
                    name: "Refined Sunflower Oil",
                    slug: "refined-sunflower-oil",
                    description: "Pure multi-refined healthy cooking sunflower oil packaged in bulk factory boxes.",
                    categoryId: cat._id,
                    brand: "Buchireddypalem Agro Millers",
                    sku: "M-OIL-500",
                    baseMrp: 180,
                    discountPercent: 35,
                    baseSellingPrice: 117,
                    stock: 8000,
                    status: "Live",
                    isActive: true,
                    adminPricingApproved: true,
                    sellerPricingAccepted: true
                });
                console.log("Seeded manufacturer product: Refined Sunflower Oil");
                // Seed Subscriptions for these products
                const vendorUser = await User_1.User.findOne({ roles: "vendor" }) || await User_1.User.findOne({});
                const customerUser = await User_1.User.findOne({ roles: "customer" }) || await User_1.User.findOne({});
                if (vendorUser && customerUser) {
                    // Add local shop subscription
                    await LocalShopSubscription_1.default.create([
                        {
                            userId: customerUser._id,
                            productId: wProd._id,
                            vendorId: vendorUser._id,
                            productName: "Premium Basmati Daily Rice Run",
                            productImage: "",
                            quantity: 2,
                            unitPrice: 84,
                            frequency: "daily",
                            customDays: [],
                            deliverySlot: "6:00 AM - 7:30 AM",
                            status: "active",
                            autoRenew: true,
                            skippedDates: [new Date().toISOString().split('T')[0]],
                            startDate: new Date().toISOString().split('T')[0]
                        },
                        {
                            userId: customerUser._id,
                            productId: mProd._id,
                            vendorId: vendorUser._id,
                            productName: "Refined Sunflower Oil Delivery",
                            productImage: "",
                            quantity: 1,
                            unitPrice: 117,
                            frequency: "alternate",
                            customDays: [],
                            deliverySlot: "10:00 AM - 12:00 PM",
                            status: "active",
                            autoRenew: true,
                            skippedDates: [],
                            startDate: new Date().toISOString().split('T')[0]
                        }
                    ]);
                    console.log("Seeded default subscriptions");
                    // Seed default Purchase Orders
                    await B2bPo_1.B2bPo.create([
                        {
                            poNumber: "PO-389021",
                            vendorId: vendorUser._id,
                            supplierId: wholesaler._id,
                            supplierName: "Nellore Wholesale Distributors",
                            items: [{
                                    productId: wProd._id,
                                    productName: "Premium Basmati Rice",
                                    quantity: 200,
                                    unitPrice: 84
                                }],
                            totalAmount: 16800,
                            status: "Dispatched",
                            expectedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            goodsReceived: {
                                acceptedUnits: 0,
                                damagedUnits: 0,
                                notes: ""
                            }
                        }
                    ]);
                    console.log("Seeded default B2B purchase orders");
                }
            }
        };
        seedTasks.push(seedSuppliersAndProducts());
        // Await all parallel seeding tasks
        await Promise.all(seedTasks);
        // Seed Banners, Restaurants and Service Providers
        await seedBannersRestaurantsAndServices();
        console.log("Database seeding completed!");
    }
    catch (error) {
        console.error("Database seeding failed:", error);
    }
};
exports.seedDatabase = seedDatabase;
const seedBannersRestaurantsAndServices = async () => {
    try {
        console.log("[Seeder] Seeding Banners, Restaurants, and Services...");
        // 1. Seed Banners
        await Banner_1.Banner.deleteMany({});
        await Banner_1.Banner.create([
            {
                title: "Grocery Offers — Fresh Daily Essentials",
                description: "Order farm-fresh vegetables, dairy products, bakery items, and household essentials from local merchants. Get up to 50% Off!",
                imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=1200",
                type: "promo",
                isActive: true,
                discount: "50%",
                link: "/category/🛒 Daily Needs"
            },
            {
                title: "Food Delivery — Hot Deals From Top Restaurants",
                description: "Craving delicious biryani, mouthwatering pizzas, or fresh bakery treats? Get food delivered hot and fresh in minutes.",
                imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=1200",
                type: "promo",
                isActive: true,
                discount: "40%",
                link: "/category/🍽 Food & Dining"
            },
            {
                title: "Good Morning Deals ☀",
                description: "Fresh Morning Specials! Milk & Breakfast items delivered in 15 mins.",
                imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600",
                type: "morning",
                isActive: true,
                discount: "Fresh Milk Deal",
                link: "/category/🛒 Daily Needs",
                countdownHours: 2
            },
            {
                title: "Good Afternoon Deals 🌤",
                description: "Lunch Combos & Fresh Juices from local diners near you.",
                imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600",
                type: "afternoon",
                isActive: true,
                discount: "Lunch Combo Deal",
                link: "/category/🍽 Food & Dining",
                countdownHours: 0
            },
            {
                title: "Good Evening Specials 🍕",
                description: "Dinner Specials & Snack Platters from top local merchants.",
                imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600",
                type: "evening",
                isActive: true,
                discount: "Snacks & Tea Offer",
                link: "/category/🍽 Food & Dining",
                countdownHours: 0
            },
            {
                title: "Late Night Cravings? 🌙",
                description: "Order snacks, desserts, or medicines instantly from local stores open late.",
                imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=600",
                type: "night",
                isActive: true,
                discount: "Night Cravings Offer",
                link: "/category/🛒 Daily Needs",
                countdownHours: 0
            },
            {
                title: "Festival Celebration — Puja Sweets & Hampers",
                description: "Celebrate the festive season with delicious traditional sweets and customized pooja bundles from top local sweet shops.",
                imageUrl: "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80&w=1200",
                type: "festival",
                isActive: true,
                discount: "20% OFF",
                link: "/category/📢 Promotional",
                countdownHours: 0
            }
        ]);
        console.log("[Seeder] Seeded default platform Banners successfully.");
        // 2. Seed Restaurants
        const restaurantCount = await Restaurant_1.Restaurant.countDocuments({});
        if (restaurantCount === 0) {
            const adminUser = await User_1.User.findOne({ roles: "admin" }) || await User_1.User.findOne({});
            if (adminUser) {
                await Restaurant_1.Restaurant.create([
                    {
                        ownerId: adminUser._id,
                        name: "Tasty Biryani Point",
                        slug: "tasty-biryani-point",
                        description: "Aromatic biryani and tasty north indian curries.",
                        address: "Buchireddypalem, Andhra Pradesh",
                        location: { type: 'Point', coordinates: [79.8789, 14.5321] },
                        cuisineTypes: ["Biryani", "North Indian"],
                        averagePreparationTimeMinutes: 20,
                        isActive: true
                    },
                    {
                        ownerId: adminUser._id,
                        name: "Nellore Tiffins",
                        slug: "nellore-tiffins",
                        description: "Crispy dosas and soft idlis for morning breakfast.",
                        address: "Buchireddypalem, Andhra Pradesh",
                        location: { type: 'Point', coordinates: [79.8795, 14.5330] },
                        cuisineTypes: ["Dosa", "South Indian Breakfast"],
                        averagePreparationTimeMinutes: 15,
                        isActive: true
                    },
                    {
                        ownerId: adminUser._id,
                        name: "Sweet Magic Bakery",
                        slug: "sweet-magic-bakery",
                        description: "Delicious custom cakes, shakes and desserts.",
                        address: "Buchireddypalem, Andhra Pradesh",
                        location: { type: 'Point', coordinates: [79.8800, 14.5340] },
                        cuisineTypes: ["Cakes", "Desserts", "Shakes"],
                        averagePreparationTimeMinutes: 25,
                        isActive: true
                    }
                ]);
                console.log("[Seeder] Seeded default Restaurants.");
            }
        }
        else {
            console.log("[Seeder] Restaurants already exist.");
        }
        // 3. Seed ServiceProviders
        const providerCount = await ServiceProvider_1.ServiceProvider.countDocuments({});
        if (providerCount === 0) {
            const providerUser = await User_1.User.findOne({ roles: "vendor" }) || await User_1.User.findOne({});
            if (providerUser) {
                const providerCode = 'SP-' + Math.floor(100000 + Math.random() * 900000);
                await ServiceProvider_1.ServiceProvider.create({
                    userId: providerUser._id,
                    providerCode,
                    businessName: "Super Clean & Repairs",
                    ownerName: providerUser.name,
                    email: providerUser.email,
                    mobile: providerUser.phone,
                    address: "Nellore Sourcing Hub",
                    pincode: "524001",
                    status: "active",
                    services: [
                        {
                            id: "svc-1",
                            name: "Home Salon & Spa",
                            category: "Home Salon",
                            type: "Beauty",
                            price: 299,
                            duration: "60 mins",
                            description: "Full body salon and relaxing spa treatment at home.",
                            imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300",
                            active: true
                        },
                        {
                            id: "svc-2",
                            name: "Plumbing & Repairs",
                            category: "Plumbing",
                            type: "Repair",
                            price: 149,
                            duration: "30 mins",
                            description: "Fixing leaky pipes, taps and drainage issues.",
                            imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300",
                            active: true
                        },
                        {
                            id: "svc-3",
                            name: "Smart Home Cleaning",
                            category: "Cleaning",
                            type: "Domestic",
                            price: 499,
                            duration: "120 mins",
                            description: "Deep home vacuuming, sanitizing and sweeping.",
                            imageUrl: "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=300",
                            active: true
                        },
                        {
                            id: "svc-4",
                            name: "Appliance Servicing",
                            category: "Appliance",
                            type: "Maintenance",
                            price: 199,
                            duration: "45 mins",
                            description: "AC, Fridge, and washing machine repair and service.",
                            imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300",
                            active: true
                        }
                    ]
                });
                console.log("[Seeder] Seeded default ServiceProvider with services.");
            }
        }
        else {
            console.log("[Seeder] ServiceProviders already exist.");
        }
    }
    catch (err) {
        console.error("[Seeder] Failed to seed banners/restaurants/services:", err);
    }
};
