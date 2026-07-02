"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const Vendor_1 = require("../models/Vendor");
const db_1 = require("../config/db");
// Load environment variables
dotenv_1.default.config();
const BenzCircle = { lat: 16.5062, lng: 80.6480 };
const seedLocations = async () => {
    try {
        await (0, db_1.connectDB)();
        console.log("Connected to database.");
        const vendors = await Vendor_1.Vendor.find();
        if (vendors.length === 0) {
            console.log("No vendors found to update.");
            process.exit(0);
        }
        console.log(`Found ${vendors.length} vendors to update.`);
        const mockCategories = [
            ["Grocery", "Beverages"],
            ["Dairy", "Grocery"],
            ["Fruits & Vegetables"],
            ["Bakery", "Beverages"],
            ["Medical"],
            ["Water"]
        ];
        const mockOffers = [
            [
                { title: "10% Off on Milk", discount: 10, startDate: new Date(), endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
            ],
            [
                { title: "Buy 1 Get 1 Free on Bread", discount: 50, startDate: new Date(), endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }
            ],
            []
        ];
        for (let i = 0; i < vendors.length; i++) {
            const vendor = vendors[i];
            // Add small offset to group them around Benz Circle (within ~5 km radius)
            // 0.01 degree is approx 1.1 km
            const offsetLat = (Math.random() - 0.5) * 0.03; // +/- ~1.6 km
            const offsetLng = (Math.random() - 0.5) * 0.03; // +/- ~1.6 km
            vendor.location = {
                type: "Point",
                coordinates: [BenzCircle.lng + offsetLng, BenzCircle.lat + offsetLat]
            };
            vendor.deliveryMode = i % 3 === 0 ? "self_delivery" : i % 3 === 1 ? "platform_delivery" : "pickup_only";
            vendor.deliveryRadiusKm = 3 + Math.floor(Math.random() * 5); // 3 to 7 km radius
            vendor.categories = mockCategories[i % mockCategories.length];
            vendor.estimatedDeliveryMinutes = 15 + Math.floor(Math.random() * 30); // 15 to 45 mins
            vendor.minOrder = 50 + Math.floor(Math.random() * 10) * 10; // 50 to 140 Rs
            vendor.deliveryCharge = Math.random() > 0.3 ? 20 + Math.floor(Math.random() * 3) * 10 : 0; // 0 to 40 Rs
            vendor.verifiedBadge = Math.random() > 0.5;
            vendor.rating = {
                average: 4.0 + Number((Math.random() * 1.0).toFixed(1)),
                totalReviews: 5 + Math.floor(Math.random() * 50)
            };
            vendor.whatsappNumber = vendor.mobile;
            vendor.liveStatus = "open";
            vendor.offers = mockOffers[i % mockOffers.length];
            // Setup businessHours (all days open 9 AM to 9 PM)
            vendor.businessHours = {
                monday: { open: "09:00", close: "21:00", enabled: true },
                tuesday: { open: "09:00", close: "21:00", enabled: true },
                wednesday: { open: "09:00", close: "21:00", enabled: true },
                thursday: { open: "09:00", close: "21:00", enabled: true },
                friday: { open: "09:00", close: "21:00", enabled: true },
                saturday: { open: "09:00", close: "21:00", enabled: true },
                sunday: { open: "09:00", close: "21:00", enabled: true }
            };
            await vendor.save();
            console.log(`Updated vendor ${vendor.businessName} with location coordinates: ${vendor.location.coordinates}`);
        }
        console.log("All vendors updated successfully.");
        process.exit(0);
    }
    catch (error) {
        console.error("Seeder error:", error);
        process.exit(1);
    }
};
seedLocations();
