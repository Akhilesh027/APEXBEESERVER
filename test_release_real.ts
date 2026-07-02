import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { processReferralReleases } from "./src/controllers/referralController";
import { User } from "./src/models/User";
import { Order } from "./src/models/Order";
import { Wallet } from "./src/models/Wallet";

dotenv.config();

const run = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    const orderNumbers = ["AB-1782040768163-4335", "AB-1782040820764-9850"];

    for (const num of orderNumbers) {
      const order = await Order.findOne({ orderNumber: num });
      if (!order) {
        console.log(`Order ${num} not found.`);
        continue;
      }

      console.log(`\n=================== Releasing for Order: ${order.orderNumber} (${order._id}) ===================`);

      // Mock request and response for processReferralReleases
      const req = {
        body: { orderId: order._id.toString() },
        user: { id: "660000000000000000000001", email: "admin@apexbee.com", roles: ["admin"] }
      } as any;

      let responseData: any = null;
      let responseStatus: number = 0;
      const res = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseData = data;
            }
          };
        },
        json: (data: any) => {
          responseStatus = 200;
          responseData = data;
        }
      } as any;

      await processReferralReleases(req, res);

      console.log(`Response Status: ${responseStatus}`);
      console.log(`Response Data:`, JSON.stringify(responseData, null, 2));

      // Fetch order release status
      const updatedOrder = await Order.findById(order._id);
      console.log(`Updated Order Commission Release Status: ${updatedOrder?.commissionReleaseStatus}`);
      console.log(`Updated Order Timeline:`, JSON.stringify(updatedOrder?.timeline, null, 2));
    }

    console.log("\n=================== Checking User Wallets after release ===================");
    const systemWallets = [
      "660000000000000000000001", // Company
      "660000000000000000000002", // Wishlink
      "660000000000000000000003"  // Referral Pool
    ];

    for (const id of systemWallets) {
      const u = await User.findById(id);
      console.log(`System User: ${u?.name} (${u?.email})`);
      console.log(`  Wallet:`, JSON.stringify(u?.wallet, null, 2));
      
      const w = await Wallet.findOne({ userId: id });
      console.log(`  Wallet Model: availableBalance=${w?.availableBalance}, pendingBalance=${w?.pendingBalance}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Release test failed:", err);
    process.exit(1);
  }
};

run();
