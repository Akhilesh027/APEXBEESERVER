import { User } from "../models/User";

export type ApexRolePrefix =
  | "APX-CUS" // Customer
  | "APX-GRC" // Grocery Vendor
  | "APX-RES" // Restaurant Vendor
  | "APX-MLK" // Milk / Dairy Vendor
  | "APX-VND" // Generic Vendor
  | "APX-WHS" // Wholesaler
  | "APX-SP"  // Service Provider
  | "APX-DP"  // Delivery Partner
  | "APX-ENT" // Entrepreneur
  | "APX-FR"; // Franchise

export const ROLE_PREFIX_MAP: Record<string, ApexRolePrefix> = {
  customer: "APX-CUS",
  grocery: "APX-GRC",
  restaurant: "APX-RES",
  milk: "APX-MLK",
  vendor: "APX-GRC", // default vendor prefix
  wholesaler: "APX-WHS",
  service_provider: "APX-SP",
  delivery_partner: "APX-DP",
  entrepreneur: "APX-ENT",
  franchise: "APX-FR",
  state_franchise: "APX-FR",
  district_franchise: "APX-FR",
  mandal_franchise: "APX-FR",
};

/**
 * Generates a unique 9-digit numeric ApexBee Master Customer ID (e.g. 583214907).
 */
export async function generateMasterCustomerId(): Promise<string> {
  let isUnique = false;
  let masterId = "";

  while (!isUnique) {
    // Generate a 9-digit number starting with 5-9 (non-zero first digit)
    const firstDigit = Math.floor(Math.random() * 5) + 5; // 5..9
    const remainingDigits = Math.floor(Math.random() * 100000000)
      .toString()
      .padStart(8, "0");
    masterId = `${firstDigit}${remainingDigits}`;

    const existing = await User.findOne({ masterCustomerId: masterId });
    if (!existing) {
      isUnique = true;
    }
  }

  return masterId;
}

/**
 * Generates a unique 6-7 char universal referral code (e.g. AB7K9P2 or GSKD37).
 */
export async function generateUniversalReferralCode(name?: string): Promise<string> {
  let isUnique = false;
  let code = "";

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // clear alphanumeric without confusing 0/O/1/I

  while (!isUnique) {
    if (name && name.trim().length >= 2) {
      const cleanName = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
      const prefix = cleanName.substring(0, 2);
      let randSuffix = "";
      for (let i = 0; i < 5; i++) {
        randSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code = `${prefix}${randSuffix}`;
    } else {
      let randCode = "AB";
      for (let i = 0; i < 5; i++) {
        randCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code = randCode;
    }

    const existing = await User.findOne({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

/**
 * Generates a role-specific reference ID (e.g. APX-GRC-7M2Q8A, APX-DP-4N8K6P).
 */
export function generateRoleReferenceId(roleKey: string, customStoreType?: string): string {
  let prefix: ApexRolePrefix = "APX-CUS";

  if (customStoreType && customStoreType.toLowerCase() === "restaurant") {
    prefix = "APX-RES";
  } else if (customStoreType && customStoreType.toLowerCase() === "milk") {
    prefix = "APX-MLK";
  } else if (ROLE_PREFIX_MAP[roleKey.toLowerCase()]) {
    prefix = ROLE_PREFIX_MAP[roleKey.toLowerCase()];
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let hash = "";
  for (let i = 0; i < 6; i++) {
    hash += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${prefix}-${hash}`;
}
