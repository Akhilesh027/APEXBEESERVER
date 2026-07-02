"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payBooking = exports.replyReview = exports.submitReview = exports.getAvailableSlots = exports.updateBookingStatus = exports.createBooking = exports.getBookingById = exports.getBookings = exports.getDashboardStats = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ServiceRequest_1 = require("../models/ServiceRequest");
const ServiceProvider_1 = require("../models/ServiceProvider");
const Wallet_1 = require("../models/Wallet");
const SettlementEngine_1 = require("../services/SettlementEngine");
const WalletEngine_1 = require("../services/WalletEngine");
const notificationEmitter_1 = require("../modules/notifications/events/notificationEmitter");
// Helper to convert date string to day name
const getDayOfWeek = (dateStr) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const d = new Date(dateStr);
    return days[d.getDay()];
};
// Helper to parse "09:00 AM" into numeric hour
const parseTime = (tStr) => {
    if (!tStr || tStr.toLowerCase() === "closed")
        return 0;
    const [time, modifier] = tStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours < 12)
        hours += 12;
    if (modifier === "AM" && hours === 12)
        hours = 0;
    return hours + minutes / 60;
};
// Helper to format numeric hour into "09:00 AM"
const formatTime = (h) => {
    const hr = Math.floor(h);
    const min = Math.round((h - hr) * 60);
    const ampm = hr >= 12 ? "PM" : "AM";
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    const displayMin = min < 10 ? "0" + min : min;
    const displayHrStr = displayHr < 10 ? "0" + displayHr : displayHr;
    return `${displayHrStr}:${displayMin} ${ampm}`;
};
// 1. GET /api/service/dashboard
const getDashboardStats = async (req, res) => {
    try {
        const providerId = req.user?.id;
        if (!providerId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const provider = await ServiceProvider_1.ServiceProvider.findOne({ userId: providerId });
        if (!provider) {
            return res.status(404).json({ success: false, message: "Provider profile not found" });
        }
        const bookings = await ServiceRequest_1.ServiceRequest.find({ providerId });
        const todayStr = new Date().toISOString().split("T")[0];
        const todayBookings = bookings.filter((b) => b.bookingDate === todayStr);
        const completedToday = todayBookings.filter((b) => b.status === "Completed").length;
        const upcomingBookings = bookings.filter((b) => new Date(b.bookingDate).getTime() > new Date(todayStr).getTime() && b.status !== "Cancelled").length;
        const pending = bookings.filter((b) => b.status === "Pending").length;
        const cancelled = bookings.filter((b) => b.status === "Cancelled").length;
        // Monthly revenue computation
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyBookings = bookings.filter((b) => {
            const bDate = new Date(b.bookingDate);
            return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear && b.status === "Completed";
        });
        const monthlyRevenue = monthlyBookings.reduce((sum, b) => sum + (b.servicePrice || 0), 0);
        // Rating calculations
        const reviewedBookings = bookings.filter((b) => b.review && b.review.rating > 0);
        const averageRating = reviewedBookings.length > 0
            ? Number((reviewedBookings.reduce((sum, b) => sum + (b.review?.rating || 0), 0) / reviewedBookings.length).toFixed(1))
            : 4.8; // Default to 4.8
        // Completion/Acceptance/Cancellation rates
        const totalCount = bookings.length;
        const completedCount = bookings.filter((b) => b.status === "Completed").length;
        const acceptedCount = bookings.filter((b) => b.status !== "Pending" && b.status !== "Rejected").length;
        const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
        const acceptanceRate = totalCount > 0 ? Math.round((acceptedCount / totalCount) * 100) : 100;
        const cancellationRate = totalCount > 0 ? Math.round((cancelled / totalCount) * 100) : 0;
        // Wallet balances
        const wallet = await Wallet_1.Wallet.findOne({ userId: providerId });
        const walletBalance = wallet ? wallet.availableBalance : 0;
        const pendingSettlement = wallet ? wallet.pendingBalance : 0;
        res.status(200).json({
            success: true,
            stats: {
                todayBookings: todayBookings.length,
                upcomingBookings,
                completedToday,
                pending,
                cancelled,
                monthlyRevenue,
                averageRating,
                responseTime: "12 Min",
                completionRate,
                acceptanceRate,
                cancellationRate,
                walletBalance,
                pendingSettlement,
                totalCustomers: new Set(bookings.map((b) => String(b.customerId))).size,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getDashboardStats = getDashboardStats;
// 2. GET /api/service/bookings
const getBookings = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const roles = req.user?.roles || [];
        let filterQuery = {};
        if (roles.includes("service_provider")) {
            filterQuery.providerId = userId;
        }
        else {
            // Default to customer
            filterQuery.customerId = userId;
        }
        const bookings = await ServiceRequest_1.ServiceRequest.find(filterQuery)
            .populate("customerId", "name email phone profilePhoto")
            .populate("providerId", "name email phone")
            .sort({ createdAt: -1 });
        // Format fields to match frontend expectation
        const formatted = bookings.map((b) => {
            // Look up businessName from ServiceProvider profile if possible
            const customerInfo = b.customerId || {};
            return {
                id: b.bookingCode,
                _id: b._id,
                provider: b.providerId?.name || "Service Partner",
                providerCode: "SP-" + String(b.providerId?._id || "").substring(18),
                providerId: b.providerId?._id,
                customerId: customerInfo._id,
                customerName: customerInfo.name || "Customer",
                phone: customerInfo.phone || "",
                service: b.serviceName,
                servicePrice: b.servicePrice,
                date: b.bookingDate,
                time: b.bookingTime,
                address: b.bookingAddress,
                status: b.status,
                bookedAt: b.createdAt,
                assignedStaff: b.assignedStaff,
                otpCode: b.otpCode,
                timeline: b.timeline,
                paymentDetails: b.paymentDetails,
                review: b.review,
                details: b.details,
            };
        });
        res.status(200).json({ success: true, bookings: formatted });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBookings = getBookings;
// 3. GET /api/service/bookings/:id
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await ServiceRequest_1.ServiceRequest.findById(id)
            .populate("customerId", "name email phone profilePhoto")
            .populate("providerId", "name email phone");
        if (!booking) {
            // Fallback: try querying by bookingCode
            const byCode = await ServiceRequest_1.ServiceRequest.findOne({ bookingCode: id })
                .populate("customerId", "name email phone profilePhoto")
                .populate("providerId", "name email phone");
            if (!byCode) {
                return res.status(404).json({ success: false, message: "Booking not found" });
            }
            return res.status(200).json({ success: true, booking: byCode });
        }
        res.status(200).json({ success: true, booking });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getBookingById = getBookingById;
// 4. POST /api/service/bookings
const createBooking = async (req, res) => {
    try {
        const customerId = req.user?.id;
        if (!customerId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { providerId, serviceName, servicePrice, bookingDate, bookingTime, bookingAddress, details } = req.body;
        if (!providerId || !serviceName || !bookingDate || !bookingTime || !bookingAddress) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }
        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const bookingCode = `BKG-${Math.floor(10000 + Math.random() * 90000)}`;
        const newBooking = new ServiceRequest_1.ServiceRequest({
            customerId,
            providerId,
            bookingCode,
            serviceName,
            servicePrice: Number(servicePrice) || 0,
            bookingDate,
            bookingTime,
            bookingAddress,
            details: details || "",
            status: "Pending",
            otpCode,
            timeline: [
                {
                    status: "Pending",
                    timestamp: new Date(),
                    note: "Service request placed by customer. Awaiting provider acceptance.",
                },
            ],
            paymentDetails: {
                status: "Pending",
                amount: Number(servicePrice) || 0,
                platformFee: 0,
                commission: 0,
            },
        });
        const saved = await newBooking.save();
        notificationEmitter_1.notificationEmitter.emitNotification('service.booking', {
            serviceName,
            bookingDate,
            bookingTime,
            entityType: 'ticket',
            entityId: saved._id
        }, [{ userId: providerId, role: 'service_provider' }]);
        res.status(201).json({ success: true, booking: saved });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createBooking = createBooking;
// 5. PUT /api/service/bookings/:id/status
const updateBookingStatus = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        const { id } = req.params;
        const { status, otpCode, assignedStaff } = req.body;
        let booking = await ServiceRequest_1.ServiceRequest.findById(id);
        if (!booking) {
            booking = await ServiceRequest_1.ServiceRequest.findOne({ bookingCode: id });
        }
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        // OTP Gated check for Completion
        if (status === "Completed") {
            if (!otpCode) {
                return res.status(400).json({ success: false, message: "Customer verification OTP code is required for completion" });
            }
            if (booking.otpCode !== otpCode) {
                return res.status(400).json({ success: false, message: "Invalid verification OTP code" });
            }
        }
        booking.status = status;
        if (assignedStaff) {
            booking.assignedStaff = assignedStaff;
        }
        // Append history timeline
        booking.timeline.push({
            status,
            timestamp: new Date(),
            note: `Booking status updated to ${status}` + (assignedStaff ? ` (Technician: ${assignedStaff})` : ""),
        });
        let savedBooking = null;
        session.startTransaction();
        await booking.save({ session });
        // Trigger Settlements if completed
        if (status === "Completed") {
            await SettlementEngine_1.SettlementEngine.processServiceBookingSettlement(booking._id, session);
        }
        await session.commitTransaction();
        // Reload booking to get the final settlement state
        const finalBooking = await ServiceRequest_1.ServiceRequest.findById(booking._id);
        // Send notifications on status transitions
        notificationEmitter_1.notificationEmitter.emitNotification('service.updated', {
            status,
            bookingCode: booking.bookingCode,
            serviceName: booking.serviceName,
            entityType: 'ticket',
            entityId: booking._id
        }, [{ userId: booking.customerId, role: 'customer' }]);
        res.status(200).json({ success: true, booking: finalBooking });
    }
    catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
};
exports.updateBookingStatus = updateBookingStatus;
// 6. GET /api/service/availability/slots
const getAvailableSlots = async (req, res) => {
    try {
        const { providerId, date } = req.query;
        if (!providerId || !date) {
            res.status(400).json({ success: false, message: "providerId and date parameters are required" });
            return;
        }
        const provider = await ServiceProvider_1.ServiceProvider.findOne({ userId: String(providerId) });
        if (!provider) {
            res.status(404).json({ success: false, message: "Provider profile not found" });
            return;
        }
        let targetDate = String(date);
        if (targetDate.toLowerCase() === "today") {
            targetDate = new Date().toISOString().split("T")[0];
        }
        else if (targetDate.toLowerCase() === "tomorrow") {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            targetDate = tomorrow.toISOString().split("T")[0];
        }
        const dayName = getDayOfWeek(targetDate);
        const daySchedule = provider.availability?.weeklySchedule?.find((s) => s.day === dayName);
        // 1. Check if closed or leave
        const isHoliday = provider.availability?.holidays?.some((h) => h.date === targetDate);
        const isBlocked = provider.availability?.blockedDates?.includes(targetDate);
        const isLeave = provider.availability?.emergencyLeave?.includes(targetDate);
        if (!daySchedule || !daySchedule.active || isHoliday || isBlocked || isLeave) {
            res.status(200).json({ success: true, slots: [] });
            return;
        }
        // 2. Generate time slots
        const startHour = parseTime(daySchedule.start) || 9;
        const endHour = parseTime(daySchedule.end) || 18;
        const breakStart = parseTime(provider.availability?.breakTime?.start || "01:00 PM");
        const breakEnd = parseTime(provider.availability?.breakTime?.end || "02:00 PM");
        const generated = [];
        for (let h = startHour; h + 1.5 <= endHour; h += 2) {
            const slotEnd = h + 1.5;
            // Skip if slot falls in break times
            if (h >= breakStart && h < breakEnd)
                continue;
            if (slotEnd > breakStart && slotEnd <= breakEnd)
                continue;
            generated.push(formatTime(h));
        }
        // 3. Subtract booked slots
        const activeBookings = await ServiceRequest_1.ServiceRequest.find({
            providerId: String(providerId),
            bookingDate: targetDate,
            status: { $nin: ["Cancelled", "Rejected"] },
        });
        const bookedTimes = activeBookings.map((b) => b.bookingTime);
        const finalSlots = generated.filter((slot) => !bookedTimes.includes(slot));
        res.status(200).json({ success: true, slots: finalSlots });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAvailableSlots = getAvailableSlots;
// 7. POST /api/service/bookings/:id/review
const submitReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment, images } = req.body;
        const booking = await ServiceRequest_1.ServiceRequest.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        booking.review = {
            rating: Number(rating) || 5,
            comment: comment || "",
            images: images || [],
            reply: "",
            date: new Date(),
        };
        await booking.save();
        notificationEmitter_1.notificationEmitter.emitNotification('service.review', {
            rating,
            entityType: 'ticket',
            entityId: booking._id
        }, [{ userId: booking.providerId, role: 'service_provider' }]);
        res.status(200).json({ success: true, booking });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.submitReview = submitReview;
// 8. POST /api/service/bookings/:id/reply-review
const replyReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { reply } = req.body;
        const booking = await ServiceRequest_1.ServiceRequest.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        if (!booking.review) {
            return res.status(400).json({ success: false, message: "No customer review exists to reply to" });
        }
        booking.review.reply = reply || "";
        await booking.save();
        res.status(200).json({ success: true, booking });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.replyReview = replyReview;
// 9. POST /api/service/bookings/:id/pay
const payBooking = async (req, res) => {
    const session = await mongoose_1.default.startSession();
    try {
        const { id } = req.params;
        const { paymentMethod, transactionId } = req.body;
        const customerId = req.user?.id || req.user?._id;
        if (!customerId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const booking = await ServiceRequest_1.ServiceRequest.findById(id);
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Check ownership
        if (booking.customerId.toString() !== customerId.toString()) {
            res.status(403).json({ success: false, message: "Forbidden: Not your booking" });
            return;
        }
        if (booking.paymentDetails && booking.paymentDetails.transactionId) {
            res.status(400).json({ success: false, message: "Booking is already paid" });
            return;
        }
        const amount = booking.servicePrice || 0;
        if (amount <= 0) {
            res.status(400).json({ success: false, message: "Invalid booking amount" });
            return;
        }
        session.startTransaction();
        if (paymentMethod === "wallet") {
            // 1. Check customer wallet
            const customerWallet = await WalletEngine_1.WalletEngine.getOrCreateWallet(customerId, session);
            if (customerWallet.availableBalance < amount) {
                res.status(400).json({ success: false, message: "Insufficient wallet balance" });
                await session.abortTransaction();
                return;
            }
            // 2. Debit customer
            await WalletEngine_1.WalletEngine.debit(customerId, amount, {
                category: "Service Payment",
                source: "service_booking_payment",
                remarks: `Payment for Service Booking ${booking.bookingCode}`,
                referenceId: booking._id,
                referenceType: "ORDER",
            }, session);
            // 3. Credit Company System Wallet
            await WalletEngine_1.WalletEngine.credit(SettlementEngine_1.SettlementEngine.COMPANY_ID, amount, {
                category: "Service Booking Funds",
                source: "service_booking_payment",
                remarks: `Collected funds for Booking ${booking.bookingCode}`,
                referenceId: booking._id,
                referenceType: "ORDER",
            }, session);
            booking.paymentDetails = {
                transactionId: `PAY_WALLET_${Date.now()}`,
                status: "Pending", // Settlement is still pending
                amount,
                platformFee: 0,
                commission: 0,
            };
            booking.timeline.push({
                status: booking.status,
                timestamp: new Date(),
                note: `Payment of ₹${amount} completed successfully via Wallet.`,
            });
        }
        else if (paymentMethod === "upi") {
            const txnId = transactionId || `PAY_UPI_${Date.now()}`;
            // Credit Company Wallet with the UPI amount (mock collection)
            await WalletEngine_1.WalletEngine.credit(SettlementEngine_1.SettlementEngine.COMPANY_ID, amount, {
                category: "Service Booking Funds",
                source: "service_booking_payment",
                remarks: `Collected UPI funds for Booking ${booking.bookingCode}`,
                referenceId: booking._id,
                referenceType: "ORDER",
            }, session);
            booking.paymentDetails = {
                transactionId: txnId,
                status: "Pending",
                amount,
                platformFee: 0,
                commission: 0,
            };
            booking.timeline.push({
                status: booking.status,
                timestamp: new Date(),
                note: `Payment of ₹${amount} recorded via UPI. Transaction ID: ${txnId}`,
            });
        }
        else {
            res.status(400).json({ success: false, message: "Unsupported payment method" });
            await session.abortTransaction();
            return;
        }
        await booking.save({ session });
        await session.commitTransaction();
        res.status(200).json({ success: true, booking });
    }
    catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        res.status(500).json({ success: false, message: error.message });
    }
    finally {
        session.endSession();
    }
};
exports.payBooking = payBooking;
