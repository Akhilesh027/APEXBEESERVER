import { SettlementEngine } from "../services/SettlementEngine";

function runUnitTests() {
  console.log("==================================================================");
  console.log("APEXBEE COMMISSION CALCULATION UNIT TESTS");
  console.log("==================================================================\n");

  let allPassed = true;

  // ---------------------------------------------------------
  // 1. MANDAL FRANCHISER ASSIGN
  // L1: 10%, L2: 3%, L3: 2%, Dist: 10%, State: 5%
  // ---------------------------------------------------------
  console.log("1. TESTING MANDAL FRANCHISER ASSIGN COMMISSION (Base Amount: ₹25,000)");
  const mandalAmount = 25000;
  const mandalComm = SettlementEngine.calculateMandalFranchiserCommission(mandalAmount);
  console.log("Result:", mandalComm);

  const expMandal = {
    level1: 2500,   // 10%
    level2: 750,    // 3%
    level3: 500,    // 2%
    district: 2500, // 10%
    state: 1250,    // 5%
  };

  const mandalOk =
    mandalComm.level1 === expMandal.level1 &&
    mandalComm.level2 === expMandal.level2 &&
    mandalComm.level3 === expMandal.level3 &&
    mandalComm.district === expMandal.district &&
    mandalComm.state === expMandal.state;

  if (mandalOk) {
    console.log("✓ PASS: Mandal commission breakdown matches exact specifications.\n");
  } else {
    console.error("✗ FAIL: Mandal commission mismatch:", mandalComm, expMandal);
    allPassed = false;
  }

  // ---------------------------------------------------------
  // 2. DISTRICT FRANCHISER ASSIGN
  // L1: 15%, L2: 3%, L3: 2%, State: 10%
  // ---------------------------------------------------------
  console.log("2. TESTING DISTRICT FRANCHISER ASSIGN COMMISSION (Base Amount: ₹1,00,000)");
  const distAmount = 100000;
  const distComm = SettlementEngine.calculateDistrictFranchiserCommission(distAmount);
  console.log("Result:", distComm);

  const expDist = {
    level1: 15000,  // 15%
    level2: 3000,   // 3%
    level3: 2000,   // 2%
    state: 10000,   // 10%
  };

  const distOk =
    distComm.level1 === expDist.level1 &&
    distComm.level2 === expDist.level2 &&
    distComm.level3 === expDist.level3 &&
    distComm.state === expDist.state;

  if (distOk) {
    console.log("✓ PASS: District commission breakdown matches exact specifications.\n");
  } else {
    console.error("✗ FAIL: District commission mismatch:", distComm, expDist);
    allPassed = false;
  }

  // ---------------------------------------------------------
  // 3. STATE FRANCHISER ASSIGN
  // L1: 15%, L2: 3%, L3: 2%
  // ---------------------------------------------------------
  console.log("3. TESTING STATE FRANCHISER ASSIGN COMMISSION (Base Amount: ₹5,00,000)");
  const stateAmount = 500000;
  const stateComm = SettlementEngine.calculateStateFranchiserCommission(stateAmount);
  console.log("Result:", stateComm);

  const expState = {
    level1: 75000,  // 15%
    level2: 15000,  // 3%
    level3: 10000,  // 2%
  };

  const stateOk =
    stateComm.level1 === expState.level1 &&
    stateComm.level2 === expState.level2 &&
    stateComm.level3 === expState.level3;

  if (stateOk) {
    console.log("✓ PASS: State commission breakdown matches exact specifications.\n");
  } else {
    console.error("✗ FAIL: State commission mismatch:", stateComm, expState);
    allPassed = false;
  }

  // ---------------------------------------------------------
  // 4. VENDOR ENROLLMENT
  // L1: 10%, L2: 3%, L3: 2%, Mandal: 10%, Dist: 5%, State: 3%
  // ---------------------------------------------------------
  console.log("4. TESTING VENDOR ENROLLMENT COMMISSION (Base Amount: ₹10,000)");
  const vendorAmount = 10000;
  const vendorComm = SettlementEngine.calculateVendorEnrollmentCommission(vendorAmount);
  console.log("Result:", vendorComm);

  const expVendor = {
    level1: 1000,   // 10%
    level2: 300,    // 3%
    level3: 200,    // 2%
    mandal: 1000,   // 10%
    district: 500,  // 5%
    state: 300,     // 3%
  };

  const vendorOk =
    vendorComm.level1 === expVendor.level1 &&
    vendorComm.level2 === expVendor.level2 &&
    vendorComm.level3 === expVendor.level3 &&
    vendorComm.mandal === expVendor.mandal &&
    vendorComm.district === expVendor.district &&
    vendorComm.state === expVendor.state;

  if (vendorOk) {
    console.log("✓ PASS: Vendor enrollment commission breakdown matches exact specifications.\n");
  } else {
    console.error("✗ FAIL: Vendor enrollment commission mismatch:", vendorComm, expVendor);
    allPassed = false;
  }

  console.log("==================================================================");
  if (allPassed) {
    console.log("ALL 4 COMMISSION FORMULAS VERIFIED SUCCESSFULLY! (100% PASS) ✓");
  } else {
    console.log("SOME TESTS FAILED! ✗");
  }
  console.log("==================================================================");
}

runUnitTests();
