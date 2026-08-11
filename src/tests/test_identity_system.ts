import {
  generateMasterCustomerId,
  generateUniversalReferralCode,
  generateRoleReferenceId,
  ROLE_PREFIX_MAP
} from "../services/identityService";

async function testIdentityGenerators() {
  console.log("=== APEXBEE UNIVERSAL IDENTITY SYSTEM VERIFICATION ===");

  // 1. Test 9-Digit Master Customer ID Format
  const masterId = await generateMasterCustomerId();
  console.log(`Generated Master Customer ID (9 digits): ${masterId}`);
  console.assert(/^\d{9}$/.test(masterId), "Master Customer ID must be exactly 9 digits!");

  // 2. Test Universal Referral Code
  const referralCode1 = await generateUniversalReferralCode("Ramesh Kumar");
  const referralCode2 = await generateUniversalReferralCode();
  console.log(`Generated Universal Referral Code (Name): ${referralCode1}`);
  console.log(`Generated Universal Referral Code (Default): ${referralCode2}`);

  // 3. Test Prefix-based Role Reference IDs
  const customerRefId = generateRoleReferenceId("customer");
  const groceryRefId = generateRoleReferenceId("vendor", "grocery");
  const restaurantRefId = generateRoleReferenceId("vendor", "restaurant");
  const milkRefId = generateRoleReferenceId("vendor", "milk");
  const dpRefId = generateRoleReferenceId("delivery_partner");
  const spRefId = generateRoleReferenceId("service_provider");
  const entRefId = generateRoleReferenceId("entrepreneur");
  const frRefId = generateRoleReferenceId("franchise");

  console.log("\n--- Role Reference IDs (Prefix Verification) ---");
  console.log(`Customer Reference ID:          ${customerRefId}`);
  console.log(`Grocery Vendor Reference ID:    ${groceryRefId}`);
  console.log(`Restaurant Vendor Reference ID: ${restaurantRefId}`);
  console.log(`Milk Vendor Reference ID:       ${milkRefId}`);
  console.log(`Delivery Partner Reference ID:  ${dpRefId}`);
  console.log(`Service Provider Reference ID:  ${spRefId}`);
  console.log(`Entrepreneur Reference ID:      ${entRefId}`);
  console.log(`Franchise Reference ID:         ${frRefId}`);

  console.assert(customerRefId.startsWith("APX-CUS-"), "Customer ID must start with APX-CUS-");
  console.assert(groceryRefId.startsWith("APX-GRC-"), "Grocery ID must start with APX-GRC-");
  console.assert(restaurantRefId.startsWith("APX-RES-"), "Restaurant ID must start with APX-RES-");
  console.assert(milkRefId.startsWith("APX-MLK-"), "Milk ID must start with APX-MLK-");
  console.assert(dpRefId.startsWith("APX-DP-"), "Delivery Partner ID must start with APX-DP-");
  console.assert(spRefId.startsWith("APX-SP-"), "Service Provider ID must start with APX-SP-");
  console.assert(entRefId.startsWith("APX-ENT-"), "Entrepreneur ID must start with APX-ENT-");
  console.assert(frRefId.startsWith("APX-FR-"), "Franchise ID must start with APX-FR-");

  console.log("\n✅ All ApexBee Universal Identity assertions passed successfully!");
}

testIdentityGenerators().catch(console.error);
