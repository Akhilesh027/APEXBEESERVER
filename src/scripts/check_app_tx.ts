import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");
    const db = mongoose.connection.db;
    if (!db) {
      console.log("No DB connection");
      return;
    }
    const app = await db.collection("businessapplications").findOne({ _id: new mongoose.Types.ObjectId("6abb8f49573223a16382c67e") });
    console.log("APPLICATION:", JSON.stringify({
      _id: app?._id,
      applicationType: app?.applicationType,
      franchiseLevel: app?.franchiseLevel,
      businessName: app?.businessName,
      state: app?.state,
      district: app?.district,
      mandal: app?.mandal,
      investmentCapacity: app?.investmentCapacity,
      amount: app?.amount,
      fee: app?.fee,
      paymentDetails: app?.paymentDetails,
      userId: app?.userId,
      status: app?.status,
      createdAt: app?.createdAt,
      updatedAt: app?.updatedAt
    }, null, 2));

    const applicantUser = app?.userId ? await db.collection("users").findOne({ _id: app.userId }) : null;
    console.log("APPLICANT USER:", JSON.stringify({
      _id: applicantUser?._id,
      name: applicantUser?.name,
      email: applicantUser?.email,
      roles: applicantUser?.roles,
      franchiseLevel: applicantUser?.franchiseLevel,
      territory: applicantUser?.territory,
      referredBy: applicantUser?.referredBy
    }, null, 2));

    const franchiseRec = app?.userId ? await db.collection("franchises").findOne({ userId: app.userId }) : null;
    console.log("APPLICANT FRANCHISE:", JSON.stringify(franchiseRec, null, 2));

    const terrs = await db.collection("territories").find({}).toArray();
    console.log("ALL TERRITORIES:", terrs.map((t: any) => ({
      _id: t._id,
      name: t.name,
      level: t.level,
      state: t.state,
      district: t.district,
      mandal: t.mandal,
      annualFranchiseFee: t.annualFranchiseFee,
      franchiseFeePerYear: t.franchiseFeePerYear,
      paymentDetails: t.paymentDetails
    })));

    const txs = await db.collection("transactions").find({ 
      $or: [
        { orderRef: "6abb8f49573223a16382c67e" },
        { referenceId: new mongoose.Types.ObjectId("6abb8f49573223a16382c67e") },
        { "meta.referenceId": "6abb8f49573223a16382c67e" },
        { "meta.applicationId": "6abb8f49573223a16382c67e" }
      ]
    }).toArray();
    console.log("TXS COUNT:", txs.length);
    for (const t of txs) {
      console.log("TX:", t._id.toString(), "user:", t.userId?.toString(), "amount:", t.amount, "type:", t.type, "remarks:", t.remarks, "createdAt:", t.createdAt);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}
check();
