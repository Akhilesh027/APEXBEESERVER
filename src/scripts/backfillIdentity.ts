import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { User } from "../models/User";
import { Vendor } from "../models/Vendor";
import { DeliveryPartner } from "../models/DeliveryPartner";
import { Entrepreneur } from "../models/Entrepreneur";
import { Franchise } from "../models/Franchise";
import { ServiceProvider } from "../models/ServiceProvider";
import {
  generateMasterCustomerId,
  generateUniversalReferralCode,
  generateRoleReferenceId,
} from "../services/identityService";

dotenv.config({ path: path.join(__dirname, "../../.env") });

async function backfillApexbeeIdentity() {
  try {
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/apexbee";
    console.log("Connecting to MongoDB:", mongoUri);
    await mongoose.connect(mongoUri);

    console.log("Starting ApexBee Identity Backfill...");

    const users = await User.find({});
    console.log(`Total users found: ${users.length}`);

    let updatedUsersCount = 0;

    for (const user of users) {
      let modified = false;

      // 1. Check Master Customer ID (9 digits)
      if (!user.masterCustomerId) {
        user.masterCustomerId = await generateMasterCustomerId();
        modified = true;
      }

      // 2. Check Universal Referral Code
      if (!user.referralCode) {
        user.referralCode = await generateUniversalReferralCode(user.name);
        modified = true;
      }

      // 3. Check Role Reference IDs
      let roleMap: Record<string, string> = {};
      if (user.roleReferenceIds instanceof Map) {
        user.roleReferenceIds.forEach((val, key) => {
          roleMap[key] = val;
        });
      } else if (user.roleReferenceIds && typeof user.roleReferenceIds === "object") {
        roleMap = { ...user.roleReferenceIds };
      }

      const roles = user.roles || ["customer"];
      for (const role of roles) {
        if (!roleMap[role]) {
          roleMap[role] = generateRoleReferenceId(role);
          modified = true;
        }
      }

      user.roleReferenceIds = roleMap;

      if (modified) {
        await user.save();
        updatedUsersCount++;
      }
    }

    console.log(`Updated ${updatedUsersCount} users with Master IDs & Role Reference IDs.`);

    // 4. Backfill Role-Specific Entity Reference IDs
    console.log("Backfilling Role-Specific Entities (Vendor, DeliveryPartner, Entrepreneur, Franchise, ServiceProvider)...");

    const vendors = await Vendor.find({});
    for (const v of vendors) {
      if (!v.referenceId) {
        const storeType = (v.storeConfig?.storeType || v.storeType || "grocery").toLowerCase();
        v.referenceId = generateRoleReferenceId("vendor", storeType);
        await v.save();
      }
    }

    const deliveryPartners = await DeliveryPartner.find({});
    for (const dp of deliveryPartners) {
      if (!dp.referenceId) {
        dp.referenceId = generateRoleReferenceId("delivery_partner");
        await dp.save();
      }
    }

    const entrepreneurs = await Entrepreneur.find({});
    for (const ent of entrepreneurs) {
      if (!ent.referenceId) {
        ent.referenceId = generateRoleReferenceId("entrepreneur");
        await ent.save();
      }
    }

    const franchises = await Franchise.find({});
    for (const fr of franchises) {
      if (!fr.referenceId) {
        fr.referenceId = generateRoleReferenceId("franchise");
        await fr.save();
      }
    }

    const serviceProviders = await ServiceProvider.find({});
    for (const sp of serviceProviders) {
      if (!sp.referenceId) {
        sp.referenceId = generateRoleReferenceId("service_provider");
        await sp.save();
      }
    }

    console.log("ApexBee Identity Backfill Complete!");
  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

backfillApexbeeIdentity();
