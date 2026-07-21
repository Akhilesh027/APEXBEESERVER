"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedBannerDefaults = void 0;
const Banner_1 = require("../models/Banner");
const seedBannerDefaults = async () => {
    try {
        const count = await Banner_1.Banner.countDocuments({});
        if (count > 0) {
            console.log(`[Seed Banners] Database already has ${count} banners. Skipping seed.`);
            return;
        }
        const defaultBanners = [
            {
                title: "Festival Raksha Bandhan Offers",
                description: "Send local sweet boxes to siblings. Get 20% off from local sweet shops.",
                imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=600",
                type: "festival",
                discount: "20% OFF",
                link: "/grocery",
                isActive: true,
                countdownHours: 0
            },
            {
                title: "Good Morning Deals ☀",
                description: "Milk offer ends in 2 hours. Order fresh milk and dairy products.",
                imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600",
                type: "morning",
                discount: "Save ₹15",
                link: "/category/Dairy",
                isActive: true,
                countdownHours: 2
            },
            {
                title: "Dinner Specials Nearby 🍕",
                description: "Get 20% off from local diners and restaurants!",
                imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600",
                type: "evening",
                discount: "20% OFF",
                link: "/category/Restaurants",
                isActive: true,
                countdownHours: 0
            },
            {
                title: "Late Night Cravings? 🌙",
                description: "Order snacks and desserts from local stores open late.",
                imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=600",
                type: "night",
                discount: "Midnight Delights",
                link: "/category/Snacks",
                isActive: true,
                countdownHours: 0
            }
        ];
        await Banner_1.Banner.insertMany(defaultBanners);
        console.log(`[Seed Banners] Successfully seeded ${defaultBanners.length} banners into MongoDB.`);
    }
    catch (error) {
        console.error("[Seed Banners] Seeding banners failed:", error);
    }
};
exports.seedBannerDefaults = seedBannerDefaults;
