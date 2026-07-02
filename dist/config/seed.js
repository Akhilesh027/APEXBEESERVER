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
        // 1. Seed ReferralSettings
        const referralSettingsCount = await ReferralSettings_1.ReferralSettings.countDocuments({});
        if (referralSettingsCount === 0) {
            await ReferralSettings_1.ReferralSettings.create({
                firstOrderRewards: {
                    level1: 0,
                    level2: 25,
                    level3: 10
                },
                enabled: true,
                defaultReferralCode: "APEXBEE"
            });
            console.log("Seeded default ReferralSettings");
        }
        // 2. Seed System Profiles & Wallets
        await SettlementEngine_1.SettlementEngine.ensureSystemProfiles();
        await WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.COMPANY_ID);
        await WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.WISHLINK_ID);
        await WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.REFERRAL_POOL_ID);
        console.log("Seeded default System Profiles & Wallets");
        // 3. Seed default CommissionRules
        const rules = [
            { businessType: "vendor", entrepreneurPercent: 10, mandalPercent: 5, districtPercent: 3, statePercent: 2, companyPercent: 80 },
            { businessType: "wholesaler", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 },
            { businessType: "manufacturer", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 }
        ];
        for (const rule of rules) {
            const existingRule = await CommissionRule_1.CommissionRule.findOne({ businessType: rule.businessType });
            if (!existingRule) {
                await CommissionRule_1.CommissionRule.create(rule);
                console.log(`Seeded default CommissionRule for ${rule.businessType}`);
            }
        }
        // 4. Seed default Campaigns
        const campaignCount = await Campaign_1.Campaign.countDocuments({});
        if (campaignCount === 0) {
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
        }
        // 5. Seed default Leads
        const leadCount = await Lead_1.Lead.countDocuments({});
        if (leadCount === 0) {
            await Lead_1.Lead.create([
                { name: "Kiran Kumar", mobile: "9876543201", email: "kiran@gmail.com", source: "Online Inquiry", status: "New" },
                { name: "Rahul Saini", mobile: "9876543202", email: "rahul@gmail.com", source: "Referral", status: "Contacted" },
                { name: "Divya Gupta", mobile: "9876543203", email: "divya@gmail.com", source: "Manual", status: "Follow-up" },
                { name: "Suresh Patil", mobile: "9876543204", email: "suresh@gmail.com", source: "Online Inquiry", status: "Converted" },
                { name: "Priya Singh", mobile: "9876543205", email: "priya@gmail.com", source: "Campaign", status: "Lost" },
                { name: "Anil Deshmukh", mobile: "9876543206", email: "anil@gmail.com", source: "Referral", status: "New" }
            ]);
            console.log("Seeded default Leads");
        }
        console.log("Database seeding completed!");
    }
    catch (error) {
        console.error("Database seeding failed:", error);
    }
};
exports.seedDatabase = seedDatabase;
