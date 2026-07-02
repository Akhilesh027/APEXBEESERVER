import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectDB } from "./src/config/db";
import { User } from "./src/models/User";
import { Wallet } from "./src/models/Wallet";
import { ServiceProvider } from "./src/models/ServiceProvider";
import { ServiceProviderKyc } from "./src/models/ServiceProviderKyc";
import { ServiceRequest } from "./src/models/ServiceRequest";
import { SettlementEngine } from "./src/services/SettlementEngine";
import { WalletEngine } from "./src/services/WalletEngine";

dotenv.config();

const runTest = async () => {
  try {
    await connectDB();
    console.log("Connected to DB!");

    // 1. Setup/Retrieve Users
    console.log("\n--- STEP 1: Setting up mock database records ---");
    let customer = await User.findOne({ email: "customer_test@apexbee.com" });
    if (!customer) {
      customer = await User.create({
        name: "Test Customer",
        email: "customer_test@apexbee.com",
        passwordHash: "mockpassword",
        phone: "9100000001",
        roles: ["customer"],
        status: "active",
        isVerified: true,
      });
      console.log("Created test customer User");
    }

    let providerUser = await User.findOne({ email: "provider_test@apexbee.com" });
    if (!providerUser) {
      providerUser = await User.create({
        name: "Test Provider",
        email: "provider_test@apexbee.com",
        passwordHash: "mockpassword",
        phone: "9100000002",
        roles: ["service_provider", "customer"],
        status: "active",
        isVerified: true,
      });
      console.log("Created test provider User");
    }

    // Set up state, district, mandal, entrepreneur mock users
    let stateUser = await User.findOne({ email: "state_test@apexbee.com" });
    if (!stateUser) {
      stateUser = await User.create({ name: "State Franchise User", email: "state_test@apexbee.com", phone: "9100000003", passwordHash: "mockpassword", roles: ["state_franchise"] });
    }
    let districtUser = await User.findOne({ email: "district_test@apexbee.com" });
    if (!districtUser) {
      districtUser = await User.create({ name: "District Franchise User", email: "district_test@apexbee.com", phone: "9100000004", passwordHash: "mockpassword", roles: ["district_franchise"] });
    }
    let mandalUser = await User.findOne({ email: "mandal_test@apexbee.com" });
    if (!mandalUser) {
      mandalUser = await User.create({ name: "Mandal Franchise User", email: "mandal_test@apexbee.com", phone: "9100000005", passwordHash: "mockpassword", roles: ["mandal_franchise"] });
    }
    let entrepreneurUser = await User.findOne({ email: "entrepreneur_test@apexbee.com" });
    if (!entrepreneurUser) {
      entrepreneurUser = await User.create({ name: "Entrepreneur User", email: "entrepreneur_test@apexbee.com", phone: "9100000006", passwordHash: "mockpassword", roles: ["entrepreneur"] });
    }

    // Initialize/reset wallets to zero balance for clear test audit
    await Wallet.deleteMany({ userId: { $in: [providerUser._id, stateUser._id, districtUser._id, mandalUser._id, entrepreneurUser._id, SettlementEngine.COMPANY_ID] } });
    await WalletEngine.getOrCreateWallet(providerUser._id);
    await WalletEngine.getOrCreateWallet(stateUser._id);
    await WalletEngine.getOrCreateWallet(districtUser._id);
    await WalletEngine.getOrCreateWallet(mandalUser._id);
    await WalletEngine.getOrCreateWallet(entrepreneurUser._id);
    await WalletEngine.getOrCreateWallet(SettlementEngine.COMPANY_ID);
    console.log("Cleared and initialized wallets");

    // 2. Setup Provider Profile and KYC
    let providerProfile = await ServiceProvider.findOne({ userId: providerUser._id });
    if (!providerProfile) {
      providerProfile = await ServiceProvider.create({
        userId: providerUser._id,
        businessName: "Super Tech Home Services",
        ownerName: "Test Provider",
        email: "provider_test@apexbee.com",
        mobile: "9100000002",
        serviceCategory: ["Appliance Repair"],
        experience: 5,
        description: "Professional home appliance repairs",
        state: "Andhra Pradesh",
        district: "Krishna",
        mandal: "Vijayawada",
        address: "Benz Circle, Vijayawada",
        pincode: "520010",
        providerCode: "SP-TEST-999",
        status: "verified",
        stateFranchiseId: stateUser._id,
        districtFranchiseId: districtUser._id,
        mandalFranchiseId: mandalUser._id,
        entrepreneurId: entrepreneurUser._id,
        availability: {
          radius: 15,
          emergencyActive: true,
          weeklySchedule: [
            { day: "Monday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Tuesday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Wednesday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Thursday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Friday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Saturday", active: true, start: "09:00 AM", end: "06:00 PM" },
            { day: "Sunday", active: false, start: "09:00 AM", end: "06:00 PM" },
          ],
          breakTime: { start: "01:00 PM", end: "02:00 PM" },
          holidays: [],
          blockedDates: [],
          emergencyLeave: [],
        },
        services: [
          { name: "AC Servicing", category: "Appliance Repair", type: "general", price: 1000, duration: "1.5 Hrs", active: true }
        ]
      });
      console.log("Created provider profile with associated franchise boundaries");
    }

    // 3. Create a Booking Request
    console.log("\n--- STEP 2: Creating a service booking request ---");
    const otpCode = "5849";
    const bookingCode = `BKG-${Math.floor(10000 + Math.random() * 90000)}`;

    const newBooking = new ServiceRequest({
      customerId: customer._id,
      providerId: providerUser._id,
      bookingCode,
      serviceName: "AC Servicing",
      servicePrice: 1000,
      bookingDate: "2026-07-06", // A Monday
      bookingTime: "11:00 AM",
      bookingAddress: "Plot 14, Benz Circle Road, Vijayawada",
      details: "AC cooling issue",
      status: "Pending",
      otpCode,
      timeline: [
        { status: "Pending", timestamp: new Date(), note: "Booking placed." }
      ],
      paymentDetails: {
        status: "Pending",
        amount: 1000,
        platformFee: 0,
        commission: 0
      }
    });

    const savedBooking = await newBooking.save();
    console.log(`Placed booking: ${savedBooking.bookingCode} for price: ₹${savedBooking.servicePrice}`);

    // 4. Progress Booking Statuses
    console.log("\n--- STEP 3: Progressing booking status transitions ---");
    
    // Status: Accepted
    savedBooking.status = "Accepted";
    savedBooking.timeline.push({ status: "Accepted", timestamp: new Date(), note: "Provider accepted." });
    await savedBooking.save();
    console.log("Transition 1: Pending -> Accepted");

    // Status: Technician Assigned
    savedBooking.status = "Technician Assigned";
    savedBooking.assignedStaff = "Ramesh Kumar";
    savedBooking.timeline.push({ status: "Technician Assigned", timestamp: new Date(), note: "Technician Ramesh Kumar assigned." });
    await savedBooking.save();
    console.log("Transition 2: Accepted -> Technician Assigned");

    // Status: Work Started
    savedBooking.status = "Work Started";
    savedBooking.timeline.push({ status: "Work Started", timestamp: new Date(), note: "Work started on site." });
    await savedBooking.save();
    console.log("Transition 3: Technician Assigned -> Work Started");

    // Status: Completed (with OTP)
    console.log("\nTransition 4: Work Started -> Completed (Requires OTP verification)");
    const userOtpAttempt = "5849"; // Correct OTP
    
    if (userOtpAttempt !== savedBooking.otpCode) {
      throw new Error("OTP check failed incorrectly!");
    }
    
    savedBooking.status = "Completed";
    savedBooking.timeline.push({ status: "Completed", timestamp: new Date(), note: "Service job completed successfully." });
    await savedBooking.save();
    console.log("OTP Verification Successful! Booking marked Completed.");

    // 5. Trigger Settlements Engine
    console.log("\n--- STEP 4: Triggering Settlement Engine splits ---");
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await SettlementEngine.processServiceBookingSettlement(savedBooking._id, session);
      await session.commitTransaction();
      console.log("Settlement Engine executed successfully!");
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // 6. Assertions and Wallet Balance Checks
    console.log("\n--- STEP 5: Verifying wallet balances & payout splits ---");
    
    const finalBooking = await ServiceRequest.findById(savedBooking._id);
    const spWallet = await Wallet.findOne({ userId: providerUser._id });
    const stateWallet = await Wallet.findOne({ userId: stateUser._id });
    const districtWallet = await Wallet.findOne({ userId: districtUser._id });
    const mandalWallet = await Wallet.findOne({ userId: mandalUser._id });
    const entrepreneurWallet = await Wallet.findOne({ userId: entrepreneurUser._id });
    const systemWallet = await Wallet.findOne({ userId: SettlementEngine.COMPANY_ID });

    console.log(`Booking Status: ${finalBooking?.status}`);
    console.log(`Booking Payment Status: ${finalBooking?.paymentDetails?.status}`);
    console.log(`Booking Transaction ID: ${finalBooking?.paymentDetails?.transactionId}`);
    
    console.log(`\nWallet Balances:`);
    console.log(`Service Provider Wallet: ₹${spWallet?.availableBalance} (Expected: ₹750)`);
    console.log(`State Franchise Wallet: ₹${stateWallet?.availableBalance} (Expected: ₹20)`);
    console.log(`District Franchise Wallet: ₹${districtWallet?.availableBalance} (Expected: ₹30)`);
    console.log(`Mandal Franchise Wallet: ₹${mandalWallet?.availableBalance} (Expected: ₹50)`);
    console.log(`Entrepreneur Wallet: ₹${entrepreneurWallet?.availableBalance} (Expected: ₹50)`);
    console.log(`System Platform Wallet: ₹${systemWallet?.availableBalance} (Expected: ₹100)`);

    // Verify splits totals
    // Total price = 1000
    // Platform fee = 10% = 100
    // State = 2% = 20
    // District = 3% = 30
    // Mandal = 5% = 50
    // Entrepreneur = 5% = 50
    // SP Net = 1000 - (100 + 20 + 30 + 50 + 50) = 750
    if (
      spWallet?.availableBalance === 750 &&
      stateWallet?.availableBalance === 20 &&
      districtWallet?.availableBalance === 30 &&
      mandalWallet?.availableBalance === 50 &&
      entrepreneurWallet?.availableBalance === 50 &&
      systemWallet?.availableBalance === 100
    ) {
      console.log("\n✅ SUCCESS: All wallet splits and balances match mathematical expectations exactly!");
      process.exit(0);
    } else {
      console.log("\n❌ FAILURE: Mismatch in wallet splits or balances.");
      process.exit(1);
    }

  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  }
};

runTest();
