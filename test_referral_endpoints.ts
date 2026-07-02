import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User";
import { getMyReferralInfo, getReferralStats } from "./src/controllers/referralController";
import { Request, Response } from "express";

dotenv.config();

const testEndpoints = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error("MONGODB_URI is not defined");
      process.exit(1);
    }
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB!");

    // Find a regular customer user
    const user = await User.findOne({ email: "admin@apexmarket.in" });
    if (!user) {
      console.log("User maniteja684@gmail.com not found!");
      process.exit(1);
    }

    console.log(`Testing for user: ${user.name} (${user.email})`);

    // Mock Express Request & Response
    const createMockReqRes = (userId: string) => {
      const req = {
        user: { id: userId, email: "admin@apexmarket.in", roles: ["admin", "customer"] }
      } as any;

      let resData: any = null;
      let statusCode = 200;

      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          resData = data;
          return res;
        }
      } as any;

      return { req, res, getResult: () => ({ statusCode, resData }) };
    };

    // 1. Test getMyReferralInfo
    const { req: req1, res: res1, getResult: getResult1 } = createMockReqRes(user._id.toString());
    await getMyReferralInfo(req1, res1);
    console.log("\n--- getMyReferralInfo Response ---");
    console.log(JSON.stringify(getResult1(), null, 2));

    // 2. Test getReferralStats
    const { req: req2, res: res2, getResult: getResult2 } = createMockReqRes(user._id.toString());
    await getReferralStats(req2, res2);
    console.log("\n--- getReferralStats Response ---");
    console.log(JSON.stringify(getResult2(), null, 2));

    process.exit(0);
  } catch (err) {
    console.error("Error testing endpoints:", err);
    process.exit(1);
  }
};

testEndpoints();
