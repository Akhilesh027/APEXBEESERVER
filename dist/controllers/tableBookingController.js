"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTableBookingStatus = exports.getVendorTableBookings = exports.getCustomerTableBookings = exports.createTableBooking = void 0;
const TableBooking_1 = __importDefault(require("../models/TableBooking"));
const Vendor_1 = require("../models/Vendor");
const createTableBooking = async (req, res) => {
    try {
        const { vendorId, guestName, guestPhone, bookingDate, timeSlot, guestCount, specialRequests } = req.body;
        if (!vendorId || !guestName || !guestPhone || !bookingDate || !timeSlot) {
            return res.status(400).json({ message: 'Missing required reservation fields' });
        }
        const vendor = await Vendor_1.Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ message: 'Restaurant vendor not found' });
        }
        const booking = new TableBooking_1.default({
            restaurantId: vendorId,
            bookingNumber: `TB-${Math.floor(100000 + Math.random() * 900000)}`,
            customerName: guestName,
            customerPhone: guestPhone,
            bookingDate: String(bookingDate),
            bookingTime: String(timeSlot),
            guestCount: Number(guestCount) || 2,
            specialRequests: specialRequests || '',
            status: 'PENDING',
        });
        await booking.save();
        res.status(201).json({
            success: true,
            message: `Table reservation requested at ${vendor.businessName} for ${guestCount} guests on ${timeSlot}!`,
            booking,
        });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to create table reservation', error: error.message });
    }
};
exports.createTableBooking = createTableBooking;
const getCustomerTableBookings = async (req, res) => {
    try {
        const { phone, email, userId } = req.query;
        const query = {};
        if (phone)
            query.customerPhone = String(phone);
        else if (email)
            query.customerEmail = String(email);
        const bookings = await TableBooking_1.default.find(query)
            .populate('restaurantId', 'restaurantName name logo coverBanner locality city phone')
            .sort({ createdAt: -1 });
        return res.json({ success: true, count: bookings.length, bookings });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getCustomerTableBookings = getCustomerTableBookings;
const getVendorTableBookings = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const bookings = await TableBooking_1.default.find({ restaurantId: vendorId }).sort({ bookingDate: -1, createdAt: -1 });
        res.json({ success: true, bookings });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to fetch table bookings', error: error.message });
    }
};
exports.getVendorTableBookings = getVendorTableBookings;
const updateTableBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const booking = await TableBooking_1.default.findByIdAndUpdate(id, { status }, { new: true });
        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }
        res.json({ success: true, booking });
    }
    catch (error) {
        res.status(500).json({ message: 'Failed to update booking status', error: error.message });
    }
};
exports.updateTableBookingStatus = updateTableBookingStatus;
