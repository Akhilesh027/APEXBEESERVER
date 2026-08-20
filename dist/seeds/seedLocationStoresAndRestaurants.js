"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedLocationStoresAndRestaurants = void 0;
const User_1 = require("../models/User");
const Vendor_1 = require("../models/Vendor");
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const RestaurantOperatingHours_1 = require("../models/RestaurantOperatingHours");
const FoodMenuCategory_1 = require("../models/FoodMenuCategory");
const FoodMenuItem_1 = require("../models/FoodMenuItem");
const Product_1 = __importDefault(require("../models/Product"));
const seedLocationStoresAndRestaurants = async () => {
    console.log('Seeding location stores, restaurants, and food items...');
    // 1. Create or Find Adilabad Vendor User & Store
    let adilabadUser = await User_1.User.findOne({ email: 'tamsi.store@apexbee.test' });
    if (!adilabadUser) {
        adilabadUser = await User_1.User.create({
            name: 'Ramesh Patel (Tamsi Bazaar)',
            email: 'tamsi.store@apexbee.test',
            role: 'vendor',
            phone: '9848050431',
            mobile: '9848050431',
            isVerified: true,
            referralCode: 'APX-TAMSI01'
        });
    }
    let adilabadVendor = await Vendor_1.Vendor.findOne({ pincode: '504312', mandal: 'Tamsi' });
    if (!adilabadVendor) {
        adilabadVendor = await Vendor_1.Vendor.create({
            userId: adilabadUser._id,
            businessName: 'Adilabad Tamsi Super Bazaar & Dairy',
            ownerName: 'Ramesh Patel',
            email: 'tamsi.store@apexbee.test',
            phone: '9848050431',
            mobile: '9848050431',
            address: 'Main Road, Near Bus Stand, Tamsi Mandal',
            pincode: '504312',
            pinCode: '504312',
            mandal: 'Tamsi',
            district: 'Adilabad',
            state: 'Telangana',
            city: 'Adilabad',
            locality: 'Tamsi Mandal',
            category: 'Daily Needs',
            primaryCategory: 'Daily Needs',
            subCategory: 'Grocery & Dairy',
            status: 'active',
            isActive: true,
            liveStatus: 'open',
            rating: { average: 4.9, count: 48 },
            deliveryRadiusKm: 20,
            estimatedDeliveryMinutes: 15,
            location: {
                type: 'Point',
                coordinates: [78.4124, 19.6641]
            }
        });
        console.log('Created Adilabad Vendor:', adilabadVendor.businessName);
    }
    // Seed 3 Local Products for Adilabad Store
    const adilabadProductsData = [
        {
            itemName: 'Tamsi Organic Cow Milk 1L',
            name: 'Tamsi Organic Cow Milk 1L',
            slug: 'tamsi-organic-cow-milk-1l',
            sku: 'SKU-TAMSI-MILK-1L',
            description: 'Pure, fresh unpasteurized farm cow milk delivered within 2 hours of milking.',
            brand: 'Tamsi Dairy Fresh',
            sellerId: adilabadVendor._id,
            deliveryScope: 'local',
            isPanIndia: false,
            price: 34,
            baseSellingPrice: 34,
            mrp: 40,
            stock: 50,
            quantity: 50,
            thumbnail: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80',
            images: ['https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80'],
            status: 'Live',
            isActive: true,
            unit: '1L'
        },
        {
            itemName: 'Adilabad Farm Fresh Red Chillies 250g',
            name: 'Adilabad Farm Fresh Red Chillies 250g',
            slug: 'adilabad-farm-fresh-red-chillies-250g',
            sku: 'SKU-ADIL-CHILLI-250G',
            description: 'High pungency organic red chillies harvested directly from local Adilabad farms.',
            brand: 'Adilabad Agro',
            sellerId: adilabadVendor._id,
            deliveryScope: 'both',
            isPanIndia: true,
            price: 40,
            baseSellingPrice: 40,
            mrp: 55,
            stock: 100,
            quantity: 100,
            thumbnail: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80',
            images: ['https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80'],
            status: 'Live',
            isActive: true,
            unit: '250g'
        },
        {
            itemName: 'Fresh Stone-Ground Wheat Atta 5kg',
            name: 'Fresh Stone-Ground Wheat Atta 5kg',
            slug: 'fresh-stone-ground-wheat-atta-5kg',
            sku: 'SKU-TAMSI-ATTA-5KG',
            description: '100% whole wheat traditional stone-ground chakki fresh atta with natural dietary fiber.',
            brand: 'Tamsi Mills',
            sellerId: adilabadVendor._id,
            deliveryScope: 'both',
            isPanIndia: true,
            price: 220,
            baseSellingPrice: 220,
            mrp: 275,
            stock: 35,
            quantity: 35,
            thumbnail: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
            images: ['https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80'],
            status: 'Live',
            isActive: true,
            unit: '5kg'
        }
    ];
    for (const prodData of adilabadProductsData) {
        const existing = await Product_1.default.findOne({ slug: prodData.slug });
        if (!existing) {
            await Product_1.default.create(prodData);
            console.log('Seeded Adilabad local product:', prodData.itemName);
        }
    }
    // 2. Seed Restaurants and Food Items
    const restaurantsToSeed = [
        {
            name: 'Adilabad Tamsi Spice & Biryani House',
            slug: 'adilabad-tamsi-spice-biryani-house',
            pincode: '504312',
            city: 'Adilabad',
            locality: 'Tamsi Mandal',
            state: 'Telangana',
            address: 'Near Gandhi Chowk, Tamsi Mandal, Adilabad - 504312',
            phone: '9848050432',
            cuisines: ['Biryani', 'South Indian', 'Mughlai', 'Tandoor'],
            foodPreference: 'BOTH',
            description: 'Authentic local Telangana spicy curries, dum biryani, and crispy tandoori rotis.',
            logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80',
            coverImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
            coordinates: [78.4124, 19.6641],
            categories: [
                {
                    name: 'Biryanis & Rice Bowls',
                    items: [
                        {
                            name: 'Hyderabadi Chicken Dum Biryani',
                            slug: 'tamsi-chicken-dum-biryani',
                            foodType: 'NON_VEG',
                            basePrice: 180,
                            offerPrice: 160,
                            description: 'Slow-cooked fragrant basmati rice with marinated chicken and aromatic Telangana spices.',
                            image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80'
                        },
                        {
                            name: 'Royal Veg Dum Biryani',
                            slug: 'tamsi-royal-veg-dum-biryani',
                            foodType: 'VEG',
                            basePrice: 140,
                            offerPrice: 125,
                            description: 'Fresh garden vegetables layered with saffron rice and mint.',
                            image: 'https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=500&auto=format&fit=crop&q=80'
                        }
                    ]
                },
                {
                    name: 'Curries & Breads',
                    items: [
                        {
                            name: 'Tamsi Special Paneer Butter Masala',
                            slug: 'tamsi-paneer-butter-masala',
                            foodType: 'VEG',
                            basePrice: 140,
                            offerPrice: 130,
                            description: 'Cottage cheese cubes tossed in rich creamy buttery tomato gravy.',
                            image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=80'
                        },
                        {
                            name: 'Butter Tandoori Roti (Pack of 3)',
                            slug: 'tamsi-butter-tandoori-roti',
                            foodType: 'VEG',
                            basePrice: 35,
                            offerPrice: 30,
                            description: 'Crispy charcoal tandoor baked rotis brushed with fresh butter.',
                            image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80'
                        }
                    ]
                }
            ]
        },
        {
            name: 'Madhapur Artisan Bistro & Biryani Lab',
            slug: 'madhapur-artisan-bistro-biryani-lab',
            pincode: '500081',
            city: 'Hyderabad',
            locality: 'Madhapur',
            state: 'Telangana',
            address: 'Hitech City Road, Madhapur, Hyderabad - 500081',
            phone: '9848050081',
            cuisines: ['Continental', 'Biryani', 'Cafe', 'Italian'],
            foodPreference: 'BOTH',
            description: 'Gourmet burgers, artisanal wood-fired pizzas, and authentic mutton dum biryani.',
            logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&auto=format&fit=crop&q=80',
            coverImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
            coordinates: [78.3847, 17.4483],
            categories: [
                {
                    name: 'Main Courses',
                    items: [
                        {
                            name: 'Signature Madhapur Mutton Biryani',
                            slug: 'madhapur-mutton-biryani',
                            foodType: 'NON_VEG',
                            basePrice: 260,
                            offerPrice: 240,
                            description: 'Tender juicy mutton pieces cooked in handi dum style.',
                            image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=80'
                        },
                        {
                            name: 'Artisan Wood-Fired Margherita Pizza',
                            slug: 'madhapur-wood-fired-margherita',
                            foodType: 'VEG',
                            basePrice: 220,
                            offerPrice: 199,
                            description: 'Fresh mozzarella, San Marzano tomato sauce, and fresh basil leaves.',
                            image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500&auto=format&fit=crop&q=80'
                        }
                    ]
                }
            ]
        },
        {
            name: 'Bandra Bay Grill & Bakery',
            slug: 'bandra-bay-grill-bakery',
            pincode: '400050',
            city: 'Mumbai',
            locality: 'Bandra West',
            state: 'Maharashtra',
            address: 'Hill Road, Bandra West, Mumbai - 400050',
            phone: '9848040050',
            cuisines: ['Seafood', 'Bakery', 'Italian', 'Cafe'],
            foodPreference: 'BOTH',
            description: 'Coastal seafood delicacies and French artisan pastries by the bay.',
            logo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=300&auto=format&fit=crop&q=80',
            coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
            coordinates: [72.8335, 19.0596],
            categories: [
                {
                    name: 'Chef Specials',
                    items: [
                        {
                            name: 'Bandra Butter Garlic Prawns',
                            slug: 'bandra-butter-garlic-prawns',
                            foodType: 'NON_VEG',
                            basePrice: 290,
                            offerPrice: 270,
                            description: 'Pan-seared Arabian sea jumbo prawns in parsley garlic butter sauce.',
                            image: 'https://images.unsplash.com/photo-1559742811-822873691df8?w=500&auto=format&fit=crop&q=80'
                        },
                        {
                            name: 'Sourdough Avocado Crostini',
                            slug: 'bandra-sourdough-avocado-crostini',
                            foodType: 'VEG',
                            basePrice: 160,
                            offerPrice: 140,
                            description: 'Toasted country sourdough topped with smashed Hass avocado, cherry tomatoes, and feta.',
                            image: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?w=500&auto=format&fit=crop&q=80'
                        }
                    ]
                }
            ]
        },
        {
            name: 'Koramangala Craft Kitchen & Dosa Bar',
            slug: 'koramangala-craft-kitchen-dosa-bar',
            pincode: '560034',
            city: 'Bengaluru',
            locality: 'Koramangala',
            state: 'Karnataka',
            address: '80 Feet Road, 4th Block Koramangala, Bengaluru - 560034',
            phone: '9848056034',
            cuisines: ['South Indian', 'Fast Food', 'Beverages'],
            foodPreference: 'VEG',
            description: 'Crispy Benne Dosas, piping hot filter coffee, and traditional South Indian snacks.',
            logo: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=300&auto=format&fit=crop&q=80',
            coverImage: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=800&auto=format&fit=crop&q=80',
            coordinates: [77.6271, 12.9352],
            categories: [
                {
                    name: 'South Indian Specials',
                    items: [
                        {
                            name: 'Ghee Roast Masala Dosa',
                            slug: 'koramangala-ghee-roast-masala-dosa',
                            foodType: 'VEG',
                            basePrice: 95,
                            offerPrice: 85,
                            description: 'Crispy golden crepe roasted in pure desi ghee served with coconut chutney & sambar.',
                            image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=500&auto=format&fit=crop&q=80'
                        },
                        {
                            name: 'Bengaluru Filter Coffee (Special Blend)',
                            slug: 'koramangala-filter-coffee',
                            foodType: 'VEG',
                            basePrice: 40,
                            offerPrice: 35,
                            description: 'Freshly brewed aromatic chicory-coffee decoction with frothed whole milk.',
                            image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80'
                        }
                    ]
                }
            ]
        }
    ];
    const daysOfWeek = [
        'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
    ];
    for (const rData of restaurantsToSeed) {
        let vendor = await Vendor_1.Vendor.findOne({ email: `${rData.slug}@apexbee.test` });
        let user = await User_1.User.findOne({ email: `${rData.slug}@apexbee.test` });
        if (!user) {
            user = await User_1.User.create({
                name: `${rData.name} Owner`,
                email: `${rData.slug}@apexbee.test`,
                role: 'food_partner',
                phone: rData.phone,
                mobile: rData.phone,
                isVerified: true
            });
        }
        if (!vendor) {
            vendor = await Vendor_1.Vendor.create({
                userId: user._id,
                businessName: rData.name,
                ownerName: `${rData.name} Owner`,
                email: `${rData.slug}@apexbee.test`,
                phone: rData.phone,
                mobile: rData.phone,
                address: rData.address,
                pincode: rData.pincode,
                pinCode: rData.pincode,
                locality: rData.locality,
                city: rData.city,
                state: rData.state,
                category: 'Food & Dining',
                primaryCategory: 'Food & Dining',
                status: 'active',
                isActive: true,
                liveStatus: 'open',
                location: {
                    type: 'Point',
                    coordinates: rData.coordinates
                }
            });
        }
        let restaurant = await RestaurantProfile_1.RestaurantProfile.findOne({ slug: rData.slug });
        if (!restaurant) {
            restaurant = await RestaurantProfile_1.RestaurantProfile.create({
                userId: user._id,
                vendorId: vendor._id,
                storeId: vendor._id,
                restaurantName: rData.name,
                slug: rData.slug,
                businessType: 'RESTAURANT',
                description: rData.description,
                logo: rData.logo,
                coverImage: rData.coverImage,
                bannerImage: rData.coverImage,
                cuisines: rData.cuisines,
                foodPreference: rData.foodPreference,
                phone: rData.phone,
                email: `${rData.slug}@apexbee.test`,
                address: rData.address,
                locality: rData.locality,
                city: rData.city,
                state: rData.state,
                pincode: rData.pincode,
                rating: 4.8,
                averagePreparationMinutes: 20,
                minimumOrderValue: 99,
                deliveryEnabled: true,
                pickupEnabled: true,
                diningEnabled: true,
                acceptingOrders: true,
                busyMode: false,
                operationalStatus: 'OPEN',
                verificationStatus: 'APPROVED',
                accountStatus: 'ACTIVE',
                location: {
                    type: 'Point',
                    coordinates: rData.coordinates
                }
            });
            console.log('Created Restaurant:', restaurant.restaurantName);
        }
        // Operating hours
        let hours = await RestaurantOperatingHours_1.RestaurantOperatingHours.findOne({ restaurantId: restaurant._id });
        if (!hours) {
            await RestaurantOperatingHours_1.RestaurantOperatingHours.create({
                restaurantId: restaurant._id,
                storeId: vendor._id,
                weeklyHours: daysOfWeek.map(d => ({
                    dayOfWeek: d,
                    enabled: true,
                    slots: [{ open: '08:00', close: '23:00' }]
                }))
            });
        }
        // Menu Categories & Items
        for (const catData of rData.categories) {
            const catSlug = `${rData.slug}-${catData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            let cat = await FoodMenuCategory_1.FoodMenuCategory.findOne({ restaurantId: restaurant._id, slug: catSlug });
            if (!cat) {
                cat = await FoodMenuCategory_1.FoodMenuCategory.create({
                    restaurantId: restaurant._id,
                    name: catData.name,
                    slug: catSlug,
                    description: catData.name,
                    sortOrder: 1,
                    isActive: true
                });
            }
            for (const itemData of catData.items) {
                const itemSlug = `${rData.slug}-${itemData.slug}`;
                let item = await FoodMenuItem_1.FoodMenuItem.findOne({ slug: itemSlug });
                if (!item) {
                    await FoodMenuItem_1.FoodMenuItem.create({
                        restaurantId: restaurant._id,
                        categoryId: cat._id,
                        name: itemData.name,
                        slug: itemSlug,
                        description: itemData.description,
                        foodType: itemData.foodType,
                        image: itemData.image,
                        basePrice: itemData.basePrice,
                        offerPrice: itemData.offerPrice,
                        taxRatePercent: 5,
                        packagingCharge: 10,
                        preparationTimeMinutes: 20,
                        isBestseller: true,
                        isRecommended: true,
                        status: 'ACTIVE',
                        approvalStatus: 'PUBLISHED_LIVE',
                        soldOut: false
                    });
                    console.log(`  + Seeded menu item: ${itemData.name}`);
                }
            }
        }
    }
    return {
        adilabadStore: adilabadVendor.businessName,
        seededRestaurantsCount: restaurantsToSeed.length
    };
};
exports.seedLocationStoresAndRestaurants = seedLocationStoresAndRestaurants;
exports.default = exports.seedLocationStoresAndRestaurants;
