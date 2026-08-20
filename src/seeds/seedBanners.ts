import { Banner } from "../models/Banner";

export const seedBannerDefaults = async () => {
  try {
    const defaultBanners = [
      // ─── 1. HOME HERO CAROUSEL BANNERS (Big) ───────────────────────────
      {
        title: "Mega Supermarket & Grocery Flash Sale",
        subtitle: "Fresh organic veggies, farm dairy, and household essentials delivered in 15 mins",
        description: "Flat ₹150 OFF on orders above ₹499. Direct from verified local sellers.",
        imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200",
        placement: "home_hero",
        size: "big",
        targetCategory: "all",
        tag: "LIMITED TIME",
        discount: "FLAT 40% OFF",
        couponCode: "SUPER40",
        buttonText: "Shop Groceries",
        link: "/grocery",
        order: 1,
        isActive: true,
        bgGradient: "from-emerald-700 via-teal-800 to-slate-950",
        clicks: 42,
        impressions: 512
      },
      {
        title: "Gourmet Food & Dining Festival",
        subtitle: "Order sizzling hot biryani, cheesy pizzas, & authentic local delicacies",
        description: "Get up to 50% discount at top rated restaurants near you.",
        imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1200",
        placement: "home_hero",
        size: "big",
        targetCategory: "Food & Dining",
        tag: "HOT DINING DEALS",
        discount: "UP TO 50% OFF",
        couponCode: "TASTY50",
        buttonText: "Explore Restaurants",
        link: "/food-dining",
        order: 2,
        isActive: true,
        bgGradient: "from-rose-700 via-orange-700 to-amber-950",
        clicks: 89,
        impressions: 780
      },
      {
        title: "Doorstep Expert Home & Technical Services",
        subtitle: "Plumbers, Electricians, AC Servicing & Deep Home Cleaning verified pros",
        description: "Zero inspection fee with 30-day service warranty.",
        imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200",
        placement: "home_hero",
        size: "big",
        targetCategory: "Services",
        tag: "VERIFIED PROS",
        discount: "FREE INSPECTION",
        couponCode: "HOMEPRO",
        buttonText: "Book Service",
        link: "/services",
        order: 3,
        isActive: true,
        bgGradient: "from-blue-700 via-indigo-800 to-slate-950",
        clicks: 31,
        impressions: 340
      },
      {
        title: "Direct From Local Manufacturers & Wholesalers",
        subtitle: "B2B bulk pricing and zero-commission direct retail from neighborhood markets",
        description: "Save big on fashion, electronics, and daily essentials directly from creators.",
        imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200",
        placement: "home_hero",
        size: "big",
        targetCategory: "Local Stores",
        tag: "ZERO PLATFORM FEE",
        discount: "WHOLESALE RATES",
        couponCode: "LOCALDIRECT",
        buttonText: "Discover Stores",
        link: "/local-stores",
        order: 4,
        isActive: true,
        bgGradient: "from-amber-600 via-orange-700 to-stone-950",
        clicks: 65,
        impressions: 610
      },

      // ─── 2. FOOD & DINING HERO BANNERS (Big) ───────────────────────────
      {
        title: "Weekend Dine-in & Delivery Fiesta 🍕",
        subtitle: "Flavors of authentic woodfired pizza, burgers, and craft shakes",
        description: "Order now and get guaranteed 30-minute express doorstep delivery.",
        imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200",
        placement: "food_hero",
        size: "big",
        targetCategory: "Food & Dining",
        tag: "WEEKEND SPECIAL",
        discount: "FLAT ₹100 OFF",
        couponCode: "CRAVINGS100",
        buttonText: "Order Food",
        link: "/food-dining",
        order: 1,
        isActive: true,
        bgGradient: "from-red-800 via-rose-900 to-amber-950"
      },
      {
        title: "Traditional South Indian & Sweets Platter 🪔",
        subtitle: "Fresh ghee sweets, crispy dosas, and filter coffee from legendary eateries",
        description: "Authentic taste from certified pure vegetarian restaurants in your city.",
        imageUrl: "https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=1200",
        placement: "food_hero",
        size: "big",
        targetCategory: "Food & Dining",
        tag: "PURE VEG SPECIAL",
        discount: "BUY 1 GET 1",
        couponCode: "DESIFEAST",
        buttonText: "Explore Veg Delights",
        link: "/food-dining",
        order: 2,
        isActive: true,
        bgGradient: "from-amber-700 via-yellow-800 to-orange-950"
      },

      // ─── 3. SERVICES HERO BANNERS (Big) ───────────────────────────────
      {
        title: "Summer AC Deep Cleaning & Gas Refill ❄",
        subtitle: "Certified HVAC technicians with advanced high-pressure jet cleaning",
        description: "Book today and save ₹300 with 60 days cooling warranty.",
        imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1200",
        placement: "services_hero",
        size: "big",
        targetCategory: "Services",
        tag: "SUMMER SAVER",
        discount: "SAVE ₹300",
        couponCode: "COOLAC",
        buttonText: "Book AC Service",
        link: "/services",
        order: 1,
        isActive: true,
        bgGradient: "from-cyan-800 via-blue-900 to-slate-950"
      },
      {
        title: "24x7 Emergency Electrical & Plumbing Care ⚡",
        subtitle: "Arrives within 30 minutes for emergency short-circuits, leaks & repairs",
        description: "Standardized upfront pricing with transparent material charges.",
        imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200",
        placement: "services_hero",
        size: "big",
        targetCategory: "Services",
        tag: "EMERGENCY 24/7",
        discount: "ZERO VISITING FEE",
        couponCode: "QUICKFIX",
        buttonText: "Call Pro Now",
        link: "/services",
        order: 2,
        isActive: true,
        bgGradient: "from-amber-700 via-orange-800 to-red-950"
      },

      // ─── 4. LOCAL STORES HERO BANNERS (Big) ───────────────────────────
      {
        title: "Discover Your Local Neighborhood Markets 🛍",
        subtitle: "Support local shopkeepers, jewelers, fashion boutiques & hardware stores",
        description: "Same day hand-to-hand pickup or hyperlocal 1-hour fast shipping.",
        imageUrl: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1200",
        placement: "stores_hero",
        size: "big",
        targetCategory: "Local Stores",
        tag: "HYPERLOCAL",
        discount: "10% INSTANT CASHBACK",
        couponCode: "SHOPLOCAL",
        buttonText: "Browse Local Stores",
        link: "/local-stores",
        order: 1,
        isActive: true,
        bgGradient: "from-purple-800 via-indigo-900 to-slate-950"
      },

      // ─── 5. TIME-OF-DAY / CONTEXTUAL CARDS (Medium) ────────────────────
      {
        title: "Good Morning Dairy & Fresh Bakery ☀",
        subtitle: "Fresh cow milk, sourdough breads, eggs & butter before 7 AM",
        description: "Schedule your morning subscription basket effortlessly.",
        imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?q=80&w=600",
        placement: "time_of_day",
        size: "medium",
        timeOfDaySlot: "morning",
        type: "morning",
        discount: "Save ₹25 Daily",
        tag: "MORNING ESSENTIALS",
        link: "/category/Dairy",
        order: 1,
        isActive: true,
        countdownHours: 2
      },
      {
        title: "Express Afternoon Lunch Thali 🍛",
        subtitle: "Wholesome home-style executive meals ready in 20 minutes",
        description: "Free sweet & papad with every corporate combo thali.",
        imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=600",
        placement: "time_of_day",
        size: "medium",
        timeOfDaySlot: "afternoon",
        type: "afternoon",
        discount: "Flat 25% OFF",
        tag: "LUNCH SPECIAL",
        link: "/food-dining",
        order: 2,
        isActive: true
      },
      {
        title: "Evening Chai, Samosas & Snacks ☕",
        subtitle: "Hot crispy samosas, pakoras, jalebis & premium teas",
        description: "Make your evening break delicious with local snack hubs.",
        imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=600",
        placement: "time_of_day",
        size: "medium",
        timeOfDaySlot: "evening",
        type: "evening",
        discount: "Combo at ₹99",
        tag: "EVENING CRAVINGS",
        link: "/food-dining",
        order: 3,
        isActive: true
      },
      {
        title: "Late Night Cravings & Desserts 🌙",
        subtitle: "Ice-creams, waffles, burgers & shakes delivered till 3 AM",
        description: "Open late night diners right in your sector.",
        imageUrl: "https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?q=80&w=600",
        placement: "time_of_day",
        size: "medium",
        timeOfDaySlot: "night",
        type: "night",
        discount: "Free Midnight Delivery",
        tag: "LATE NIGHT DELIGHTS",
        link: "/food-dining",
        order: 4,
        isActive: true
      },

      // ─── 6. MID-PAGE PROMOTIONAL STRIPS (Strip) ────────────────────────
      {
        title: "ApexBee 0% Platform Fee Model • 100% Direct Store Connect",
        subtitle: "Zero commission means lower prices for you and honest earnings for local merchants.",
        description: "Experience transparent local commerce built for India's neighborhoods.",
        imageUrl: "https://images.unsplash.com/photo-1556742049-0a67e5572293?q=80&w=1200",
        placement: "home_strip",
        size: "strip",
        tag: "APEX GUARANTEE",
        discount: "BEST PRICE PROMISE",
        buttonText: "Learn How It Works",
        link: "/earn-with-apexbee",
        order: 1,
        isActive: true
      },

      // ─── 7. POPUP / SEASONAL MODAL BANNER (Popup) ─────────────────────
      {
        title: "🎉 Welcome to ApexBee Super App!",
        subtitle: "Get ₹100 instant wallet cash on your first local order across Groceries, Food & Services",
        description: "Use coupon code WELCOME100 during checkout. Valid for today!",
        imageUrl: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=800",
        placement: "popup_modal",
        size: "popup",
        tag: "NEW USER GIFT",
        discount: "₹100 WALLET CASH",
        couponCode: "WELCOME100",
        buttonText: "Claim ₹100 Cash",
        link: "/",
        order: 1,
        isActive: true
      }
    ];

    // Check count or update placements
    const count = await Banner.countDocuments({});
    if (count === 0) {
      await Banner.insertMany(defaultBanners);
      console.log(`[Seed Banners] Successfully seeded ${defaultBanners.length} comprehensive banners into MongoDB.`);
    } else {
      // Upsert/ensure these default placement banners exist if missing
      for (const b of defaultBanners) {
        const exists = await Banner.findOne({ title: b.title });
        if (!exists) {
          await Banner.create(b);
        }
      }
      console.log(`[Seed Banners] Checked & synced banner placements in database.`);
    }
  } catch (error) {
    console.error("[Seed Banners] Seeding banners failed:", error);
  }
};

