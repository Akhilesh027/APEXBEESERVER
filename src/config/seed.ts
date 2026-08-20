import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { ReferralSettings } from "../models/ReferralSettings";
import { CommissionRule } from "../models/CommissionRule";
import { SettlementEngine } from "../services/SettlementEngine";
import { WalletEngine } from "../services/WalletEngine";

export const seedDatabase = async () => {
  try {
    // 1. Seed Super Admin User if not present
    let adminUser = await User.findOne({ email: "admin@apexbee.in" });
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash("admin123", salt);
      adminUser = await User.create({
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

    // 2. Seed Default ReferralSettings if not present
    const settings = await ReferralSettings.findOne({});
    if (!settings) {
      await ReferralSettings.create({
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
    await SettlementEngine.ensureSystemProfiles();
    await Promise.all([
      WalletEngine.getOrCreateWallet(SettlementEngine.COMPANY_ID),
      WalletEngine.getOrCreateWallet(SettlementEngine.WISHLINK_ID),
      WalletEngine.getOrCreateWallet(SettlementEngine.REFERRAL_POOL_ID)
    ]);

    // 4. Seed Default CommissionRules if not present
    const rules = [
      { businessType: "vendor", entrepreneurPercent: 10, mandalPercent: 5, districtPercent: 3, statePercent: 2, companyPercent: 80 },
      { businessType: "wholesaler", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 },
      { businessType: "manufacturer", entrepreneurPercent: 5, mandalPercent: 2, districtPercent: 1.5, statePercent: 1, companyPercent: 90.5 }
    ];

    await Promise.all(rules.map(async (rule) => {
      const existingRule = await CommissionRule.findOne({ businessType: rule.businessType });
      if (!existingRule) {
        await CommissionRule.create(rule);
        console.log(`[Seeder] Seeded default CommissionRule for ${rule.businessType}`);
      }
    }));

  } catch (error: any) {
    console.error("[Seeder] Database initialization warning:", error.message || error);
  }
};
