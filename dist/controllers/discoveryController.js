"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCourses = exports.getServiceProviders = exports.getFeaturedVendors = exports.getTrending = exports.getGroups = void 0;
const getGroups = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            groups: [
                {
                    id: "grp-grocery",
                    gradient: "linear-gradient(135deg,#064e3b 0%,#065f46 50%,#047857 100%)",
                    icon: "🛒",
                    title: "Daily Essentials & Grocery",
                    description: "Fresh daily items, snacks, beverages and household essentials.",
                    items: [
                        { id: "cat-grocery", name: "Grocery", icon: "🍏", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300", tag: "10% Off", color: "#10b981" },
                        { id: "cat-dairy", name: "Dairy & Eggs", icon: "🥛", image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&q=80&w=300", tag: "Fresh", color: "#10b981" }
                    ]
                },
                {
                    id: "grp-services",
                    gradient: "linear-gradient(135deg,#1e1b4b 0%,#312e81 55%,#4c1d95 100%)",
                    icon: "🔧",
                    title: "Doorstep Services",
                    description: "Professional services delivered safely to your home.",
                    items: [
                        { id: "cat-cleaning", name: "Home Cleaning", icon: "🧹", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=300", tag: "Top Rated", color: "#6366f1" },
                        { id: "cat-appliance", name: "Appliance Repair", icon: "🔌", image: "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&q=80&w=300", tag: "Quick", color: "#6366f1" }
                    ]
                }
            ]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getGroups = getGroups;
const getTrending = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            trending: [
                { id: "cat-grocery", name: "Grocery", icon: "🍏", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300", tag: "10% Off", color: "#10b981" },
                { id: "cat-cleaning", name: "Home Cleaning", icon: "🧹", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=300", tag: "Popular", color: "#6366f1" }
            ]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getTrending = getTrending;
const getFeaturedVendors = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            vendors: [
                {
                    id: "v-1",
                    name: "Fresh Foods Supermarket",
                    image: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=400",
                    badge: "Featured",
                    location: "Bangalore, India",
                    rating: 4.8,
                    reviews: 145
                },
                {
                    id: "v-2",
                    name: "Organic Greens Store",
                    image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&q=80&w=400",
                    badge: "Top Seller",
                    location: "Bangalore, India",
                    rating: 4.6,
                    reviews: 98
                }
            ]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getFeaturedVendors = getFeaturedVendors;
const getServiceProviders = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            providers: [
                {
                    id: "sp-1",
                    name: "Ram Kumar",
                    image: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?auto=format&fit=crop&q=80&w=300",
                    badge: "Verified",
                    category: "Plumbing",
                    rating: 4.9,
                    jobs: 420
                },
                {
                    id: "sp-2",
                    name: "Deepa Sharma",
                    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300",
                    badge: "Top Rated",
                    category: "Home Cleaning",
                    rating: 4.8,
                    jobs: 310
                }
            ]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getServiceProviders = getServiceProviders;
const getCourses = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            courses: [
                {
                    id: "c-1",
                    title: "Introduction to Digital Marketing",
                    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400",
                    badge: "Bestseller",
                    instructor: "ApexBee Academy",
                    rating: 4.7,
                    students: 1250,
                    price: 499,
                    originalPrice: 1999
                },
                {
                    id: "c-2",
                    title: "Personal Finance & Investment",
                    image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=400",
                    badge: "New",
                    instructor: "ApexBee Academy",
                    rating: 4.5,
                    students: 340,
                    price: 299,
                    originalPrice: 999
                }
            ]
        });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCourses = getCourses;
