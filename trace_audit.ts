import mongoose from "mongoose";
import dotenv from "dotenv";
import { getReferralStats, getReferralNetwork } from "./src/controllers/referralController";
import { getUserCommissions } from "./src/controllers/userController";

dotenv.config();

const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

const verify = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/apexbee";
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    const userId = "6a34ebbc35363fae65b72216"; // Maniteja Goud

    // 1. Verify getReferralStats
    const reqStats: any = { user: { id: userId } };
    const resStats = mockResponse();
    await getReferralStats(reqStats, resStats);
    console.log("\n=== getReferralStats Response ===");
    console.log(JSON.stringify(resStats.jsonData, null, 2));

    // 2. Verify getReferralNetwork
    const reqNetwork: any = { user: { id: userId } };
    const resNetwork = mockResponse();
    await getReferralNetwork(reqNetwork, resNetwork);
    console.log("\n=== getReferralNetwork Response ===");
    console.log(JSON.stringify({
      success: resNetwork.jsonData.success,
      level1Count: resNetwork.jsonData.level1?.length,
      level2Count: resNetwork.jsonData.level2?.length,
      level3Count: resNetwork.jsonData.level3?.length,
      level1Sample: resNetwork.jsonData.level1?.[0]
    }, null, 2));

    // 3. Verify getUserCommissions
    const reqCommissions: any = { user: { id: userId } };
    const resCommissions = mockResponse();
    await getUserCommissions(reqCommissions, resCommissions);
    console.log("\n=== getUserCommissions Response (Sample & Count) ===");
    console.log(`Total commissions returned: ${resCommissions.jsonData.commissions?.length}`);
    console.log("Sample commission:", JSON.stringify(resCommissions.jsonData.commissions?.[0], null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Verification failed:", err);
    process.exit(1);
  }
};

verify();
