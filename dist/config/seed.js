"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const User_1 = require("../models/User");
const ReferralSettings_1 = require("../models/ReferralSettings");
const CommissionRule_1 = require("../models/CommissionRule");
const SettlementEngine_1 = require("../services/SettlementEngine");
const WalletEngine_1 = require("../services/WalletEngine");
const seedDatabase = async () => {
    try {
        // 1. Seed Super Admin User if not present
        let adminUser = await User_1.User.findOne({
            $or: [{ email: "admin@apexbee.in" }, { phone: "9999999999" }]
        });
        if (!adminUser) {
            const salt = await bcryptjs_1.default.genSalt(10);
            const passwordHash = await bcryptjs_1.default.hash("admin123", salt);
            adminUser = await User_1.User.create({
                name: "ApexBee Super Admin",
                email: "admin@apexbee.in",
                passwordHash,
                phone: "9999999999",
                mobile: "9999999999",
                roles: ["admin", "customer"],
                status: "active",
                isVerified: true
            });
            console.log("[Seeder] Seeded default Super Admin: admin@apexbee.in");
        }
        else {
            let changed = false;
            if (adminUser.email !== "admin@apexbee.in") {
                adminUser.email = "admin@apexbee.in";
                changed = true;
            }
            if (!adminUser.roles.includes("admin")) {
                adminUser.roles.push("admin");
                changed = true;
            }
            if (changed) {
                await adminUser.save();
            }
        }
        // 2. Seed Default ReferralSettings if not present
        const settings = await ReferralSettings_1.ReferralSettings.findOne({});
        if (!settings) {
            await ReferralSettings_1.ReferralSettings.create({
                firstOrderRewards: {
                    level1: 0,
                    level2: 25,
                    level3: 10
                },
                enabled: true,
                defaultReferralCode: "APEXBEE"
            });
            console.log("[Seeder] Seeded default ReferralSettings.");
        }
        // 3. Seed System Wallets & Profiles
        await SettlementEngine_1.SettlementEngine.ensureSystemProfiles();
        await Promise.all([
            WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.COMPANY_ID),
            WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.WISHLINK_ID),
            WalletEngine_1.WalletEngine.getOrCreateWallet(SettlementEngine_1.SettlementEngine.REFERRAL_POOL_ID)
        ]);
        // 4. Seed Default CommissionRules if not present
        const rules = [
            { businessType: "vendor", entrepreneurPercent: 10, mandalPercent: 5, districtPercent: 3, statePercent: 2, companyPercent: 80 },
            { businessType: "wholesaler", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 },
            { businessType: "manufacturer", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 }
        ];
        await Promise.all(rules.map(async (rule) => {
            const existingRule = await CommissionRule_1.CommissionRule.findOne({ businessType: rule.businessType });
            if (!existingRule) {
                await CommissionRule_1.CommissionRule.create(rule);
                console.log(`[Seeder] Seeded default CommissionRule for ${rule.businessType}`);
            }
        }));
    }
    catch (error) {
        console.error("[Seeder] Database initialization warning:", error.message || error);
    }
};
exports.seedDatabase = seedDatabase;
