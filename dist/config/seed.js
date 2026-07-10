"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const ReferralSettings_1 = require("../models/ReferralSettings");
const CommissionRule_1 = require("../models/CommissionRule");
const SettlementEngine_1 = require("../services/SettlementEngine");
const WalletEngine_1 = require("../services/WalletEngine");
const User_1 = require("../models/User");
const Campaign_1 = require("../models/Campaign");
const Lead_1 = require("../models/Lead");
const seedDatabase = async () => {
    try {
        console.log("Seeding database...");
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
        // Await all parallel seeding tasks
        await Promise.all(seedTasks);
        console.log("Database seeding completed!");
    }
    catch (error) {
        console.error("Database seeding failed:", error);
    }
};
exports.seedDatabase = seedDatabase;
