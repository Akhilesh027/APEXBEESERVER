import { Request, Response } from "express";
import { Course } from "../models/Course";
import { User } from "../models/User";

export const getGroups = async (req: Request, res: Response) => {
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getTrending = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({
      success: true,
      trending: [
        { id: "cat-grocery", name: "Grocery", icon: "🍏", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=300", tag: "10% Off", color: "#10b981" },
        { id: "cat-cleaning", name: "Home Cleaning", icon: "🧹", image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=300", tag: "Popular", color: "#6366f1" }
      ]
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getFeaturedVendors = async (req: Request, res: Response) => {
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getServiceProviders = async (req: Request, res: Response) => {
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
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCourses = async (req: Request, res: Response) => {
  try {
    let courses = await Course.find({ status: 'Published' });
    
    if (courses.length === 0) {
      console.log("[getCourses] No courses found in database. Seeding default courses...");
      // Find a provider user
      const providerUser = await User.findOne({ roles: "vendor" }) || await User.findOne({});
      if (providerUser) {
        const defaultCourses = [
          {
            providerId: providerUser._id,
            title: "Introduction to Digital Marketing",
            description: "Learn how to use social media, advertisements, and content creation to gain customers.",
            category: "Digital Marketing",
            price: 499,
            status: "Published",
            duration: "12 modules • Intermediate",
            instructors: ["ApexBee Academy"]
          },
          {
            providerId: providerUser._id,
            title: "Personal Finance & Investment",
            description: "A guide to managing your personal income, investments, tax benefits and growing wealth.",
            category: "Finance",
            price: 299,
            status: "Published",
            duration: "8 modules • Beginner",
            instructors: ["ApexBee Academy"]
          },
          {
            providerId: providerUser._id,
            title: "Direct Selling Mastery",
            description: "Build a solid MLM foundation, learn networking strategies, and double your referrals.",
            category: "MLM Mastery",
            price: 899,
            status: "Published",
            duration: "10 modules • Advanced",
            instructors: ["ApexBee Academy"]
          }
        ];
        await Course.create(defaultCourses);
        courses = await Course.find({ status: 'Published' });
      }
    }

    // Map database courses to the frontend schema
    const mappedCourses = courses.map((c: any) => {
      let image = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400";
      let badge = "Popular";
      let students = 450;
      let originalPrice = Math.round(c.price * 2.5);

      if (c.title.includes("Digital Marketing")) {
        image = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400";
        badge = "Bestseller";
        students = 1250;
      } else if (c.title.includes("Finance")) {
        image = "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=400";
        badge = "New";
        students = 340;
      } else if (c.title.includes("Direct Selling") || c.title.includes("MLM")) {
        image = "https://images.unsplash.com/photo-1552581230-c013741398c3?auto=format&fit=crop&q=80&w=400";
        badge = "Hot";
        students = 780;
      }

      return {
        id: c._id.toString(),
        title: c.title,
        description: c.description,
        image,
        badge,
        instructor: c.instructors?.[0] || "ApexBee Academy",
        rating: 4.8,
        students,
        price: c.price,
        originalPrice,
        duration: c.duration || "Self paced"
      };
    });

    return res.status(200).json({
      success: true,
      courses: mappedCourses
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
