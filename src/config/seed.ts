import { ReferralSettings } from "../models/ReferralSettings";
import { CommissionRule } from "../models/CommissionRule";
import { SettlementEngine } from "../services/SettlementEngine";
import { WalletEngine } from "../services/WalletEngine";
import { User } from "../models/User";
import { Campaign } from "../models/Campaign";
import { Lead } from "../models/Lead";
import Product from "../models/Product";
import LocalShopSubscription from "../models/LocalShopSubscription";
import { B2bRfq } from "../models/B2bRfq";
import { B2bPo } from "../models/B2bPo";
import Category from "../models/Category";
import bcrypt from "bcryptjs";

export const seedDatabase = async () => {
  try {
    console.log("Seeding database...");

    // 1. ReferralSettings, Campaigns and Leads checks in parallel
    const [referralSettingsCount, campaignCount, leadCount] = await Promise.all([
      ReferralSettings.countDocuments({}),
      Campaign.countDocuments({}),
      Lead.countDocuments({})
    ]);

    const seedTasks: Promise<any>[] = [];

    if (referralSettingsCount === 0) {
      seedTasks.push(
        ReferralSettings.create({
          firstOrderRewards: {
            level1: 0,
            level2: 25,
            level3: 10
          },
          enabled: true,
          defaultReferralCode: "APEXBEE"
        }).then(() => console.log("Seeded default ReferralSettings"))
      );
    }

    // 2. Seed System Profiles & Wallets (Wallets depend on profiles existing, so run sequentially to ensure profile exists)
    const seedSystemWallets = async () => {
      await SettlementEngine.ensureSystemProfiles();
      await Promise.all([
        WalletEngine.getOrCreateWallet(SettlementEngine.COMPANY_ID),
        WalletEngine.getOrCreateWallet(SettlementEngine.WISHLINK_ID),
        WalletEngine.getOrCreateWallet(SettlementEngine.REFERRAL_POOL_ID)
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
        const existingRule = await CommissionRule.findOne({ businessType: rule.businessType });
        if (!existingRule) {
          await CommissionRule.create(rule);
          console.log(`Seeded default CommissionRule for ${rule.businessType}`);
        }
      }));
    };
    seedTasks.push(seedRules());

    if (campaignCount === 0) {
      const seedCampaigns = async () => {
        const adminUser = await User.findOne({ roles: "admin" }) || await User.findOne({});
        if (adminUser) {
          await Campaign.create([
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
      seedTasks.push(
        Lead.create([
          { name: "Kiran Kumar", mobile: "9876543201", email: "kiran@gmail.com", source: "Online Inquiry", status: "New" },
          { name: "Rahul Saini", mobile: "9876543202", email: "rahul@gmail.com", source: "Referral", status: "Contacted" },
          { name: "Divya Gupta", mobile: "9876543203", email: "divya@gmail.com", source: "Manual", status: "Follow-up" },
          { name: "Suresh Patil", mobile: "9876543204", email: "suresh@gmail.com", source: "Online Inquiry", status: "Converted" },
          { name: "Priya Singh", mobile: "9876543205", email: "priya@gmail.com", source: "Campaign", status: "Lost" },
          { name: "Anil Deshmukh", mobile: "9876543206", email: "anil@gmail.com", source: "Referral", status: "New" }
        ]).then(() => console.log("Seeded default Leads"))
      );
    }

    // 4. Seed Wholesalers and Manufacturers
    const seedSuppliersAndProducts = async () => {
      const existingWholesaler = await User.findOne({ email: "nellore@wholesaler.com" });
      if (!existingWholesaler) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash("apexbee123", salt);

        // Create Wholesaler User
        const wholesaler = await User.create({
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
        const manufacturer = await User.create({
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
        let cat = await Category.findOne({});
        if (!cat) {
          cat = await Category.create({
            name: "Groceries & Foods",
            slug: "groceries",
            level: 1,
            brands: ["Local"],
            attributes: {}
          });
        }

        // Seed products for Wholesaler
        const wProd = await Product.create({
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
        const mProd = await Product.create({
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
        const vendorUser = await User.findOne({ roles: "vendor" }) || await User.findOne({});
        const customerUser = await User.findOne({ roles: "customer" }) || await User.findOne({});
        
        if (vendorUser && customerUser) {
          // Add local shop subscription
          await LocalShopSubscription.create([
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
          await B2bPo.create([
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

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Database seeding failed:", error);
  }
};
