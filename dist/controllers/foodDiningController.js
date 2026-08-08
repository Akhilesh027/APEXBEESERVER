"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDiningInfo = exports.getDiningInfo = exports.updateDiningBookingStatus = exports.createDiningBooking = exports.getDiningBookings = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const RestaurantProfile_1 = require("../models/RestaurantProfile");
const TableBooking_1 = require("../models/TableBooking");
// GET /api/food/dining/bookings - Get dining table reservations
const getDiningBookings = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext;
        const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
        const objectIds = rawIds
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)));
        const profile = await RestaurantProfile_1.RestaurantProfile.findOne({
            $or: [
                { _id: { $in: objectIds } },
                { vendorId: { $in: objectIds } },
                { userId: { $in: objectIds } },
                { storeId: { $in: objectIds } },
            ],
        });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        const { status, date, search } = req.query;
        const query = { restaurantId: profile._id };
        if (status && status !== 'ALL') {
            query.status = status;
        }
        if (date) {
            query.bookingDate = String(date);
        }
        if (search) {
            const searchRegex = new RegExp(String(search), 'i');
            query.$or = [
                { customerName: searchRegex },
                { customerPhone: searchRegex },
                { bookingNumber: searchRegex },
                { tableType: searchRegex }
            ];
        }
        let bookings = await TableBooking_1.TableBooking.find(query).sort({ createdAt: -1 });
        // Initial sample table reservations if none exist for demonstration
        if (bookings.length === 0 && !status && !date && !search) {
            const todayStr = new Date().toISOString().split('T')[0];
            const tomorrowObj = new Date();
            tomorrowObj.setDate(tomorrowObj.getDate() + 1);
            const tomorrowStr = tomorrowObj.toISOString().split('T')[0];
            const sampleBookings = [
                {
                    restaurantId: profile._id,
                    bookingNumber: `TB-${Math.floor(100000 + Math.random() * 900000)}`,
                    customerName: 'Akhilesh Reddy',
                    customerPhone: '9707010797',
                    customerEmail: 'akhilesh@apexbee.in',
                    guestCount: 4,
                    bookingDate: todayStr,
                    bookingTime: '08:00 PM',
                    tableType: 'VIP Booth Section',
                    occasion: 'Birthday Celebration 🎂',
                    specialRequests: 'Window side booth with candlelight setup preferred',
                    status: 'PENDING',
                    tableNumber: 'T-04',
                    depositAmount: 500,
                    depositStatus: 'PAID'
                },
                {
                    restaurantId: profile._id,
                    bookingNumber: `TB-${Math.floor(100000 + Math.random() * 900000)}`,
                    customerName: 'Priya Sharma',
                    customerPhone: '9848012345',
                    customerEmail: 'priya.s@gmail.com',
                    guestCount: 2,
                    bookingDate: todayStr,
                    bookingTime: '07:30 PM',
                    tableType: 'Rooftop Terrace',
                    occasion: 'Anniversary Dinner 💖',
                    specialRequests: 'Quiet corner table, quiet ambiance',
                    status: 'CONFIRMED',
                    tableNumber: 'RT-02',
                    depositAmount: 300,
                    depositStatus: 'PAID'
                },
                {
                    restaurantId: profile._id,
                    bookingNumber: `TB-${Math.floor(100000 + Math.random() * 900000)}`,
                    customerName: 'Rajesh Varma',
                    customerPhone: '9177176969',
                    customerEmail: 'varma.corp@gmail.com',
                    guestCount: 6,
                    bookingDate: todayStr,
                    bookingTime: '01:30 PM',
                    tableType: 'Family Dining Suite',
                    occasion: 'Business Lunch 💼',
                    specialRequests: 'High chair needed for 1 kid',
                    status: 'SEATED',
                    tableNumber: 'F-01',
                    depositAmount: 0,
                    depositStatus: 'PAID'
                },
                {
                    restaurantId: profile._id,
                    bookingNumber: `TB-${Math.floor(100000 + Math.random() * 900000)}`,
                    customerName: 'Ananya Deshmukh',
                    customerPhone: '9988776655',
                    guestCount: 3,
                    bookingDate: tomorrowStr,
                    bookingTime: '08:30 PM',
                    tableType: 'Standard Indoor',
                    occasion: 'Casual Dining',
                    status: 'CONFIRMED',
                    tableNumber: 'T-08',
                    depositAmount: 0,
                    depositStatus: 'PAID'
                }
            ];
            await TableBooking_1.TableBooking.insertMany(sampleBookings);
            bookings = await TableBooking_1.TableBooking.find(query).sort({ createdAt: -1 });
        }
        const counts = {
            total: bookings.length,
            pending: bookings.filter((b) => b.status === 'PENDING').length,
            confirmed: bookings.filter((b) => b.status === 'CONFIRMED').length,
            seated: bookings.filter((b) => b.status === 'SEATED').length,
            completed: bookings.filter((b) => b.status === 'COMPLETED').length,
            cancelled: bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REJECTED').length
        };
        res.status(200).json({
            success: true,
            diningEnabled: profile.diningEnabled !== false,
            counts,
            bookings
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch table bookings', error: error.message });
    }
};
exports.getDiningBookings = getDiningBookings;
// POST /api/food/dining/bookings - Create table reservation
const createDiningBooking = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext;
        const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
        const objectIds = rawIds
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)));
        const profile = await RestaurantProfile_1.RestaurantProfile.findOne({
            $or: [
                { _id: { $in: objectIds } },
                { vendorId: { $in: objectIds } },
                { userId: { $in: objectIds } },
                { storeId: { $in: objectIds } },
            ],
        });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        const { customerName, customerPhone, customerEmail, guestCount, bookingDate, bookingTime, tableType, occasion, specialRequests, tableNumber } = req.body;
        if (!customerName || !customerPhone || !bookingDate || !bookingTime) {
            res.status(400).json({ success: false, message: 'Customer name, phone, date, and time are required' });
            return;
        }
        const bookingNumber = `TB-${Math.floor(100000 + Math.random() * 900000)}`;
        const newBooking = new TableBooking_1.TableBooking({
            restaurantId: profile._id,
            bookingNumber,
            customerName,
            customerPhone,
            customerEmail: customerEmail || '',
            guestCount: Number(guestCount || 2),
            bookingDate,
            bookingTime,
            tableType: tableType || 'Standard Table',
            occasion: occasion || 'Casual Dining',
            specialRequests: specialRequests || '',
            tableNumber: tableNumber || '',
            status: 'CONFIRMED'
        });
        await newBooking.save();
        res.status(201).json({
            success: true,
            message: 'Table reservation created successfully',
            booking: newBooking
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create table booking', error: error.message });
    }
};
exports.createDiningBooking = createDiningBooking;
// PATCH /api/food/dining/bookings/:id/status - Confirm, seat, complete, or reject table booking
const updateDiningBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason, tableNumber } = req.body;
        const booking = await TableBooking_1.TableBooking.findById(id);
        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found' });
            return;
        }
        if (status)
            booking.status = status;
        if (rejectionReason !== undefined)
            booking.rejectionReason = rejectionReason;
        if (tableNumber !== undefined)
            booking.tableNumber = tableNumber;
        await booking.save();
        res.status(200).json({
            success: true,
            message: `Table booking status updated to ${booking.status}`,
            booking
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update booking status', error: error.message });
    }
};
exports.updateDiningBookingStatus = updateDiningBookingStatus;
// GET /api/food/dining/info - Get dining setup, gallery & operational info
const getDiningInfo = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext;
        const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
        const objectIds = rawIds
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)));
        const profile = await RestaurantProfile_1.RestaurantProfile.findOne({
            $or: [
                { _id: { $in: objectIds } },
                { vendorId: { $in: objectIds } },
                { userId: { $in: objectIds } },
                { storeId: { $in: objectIds } },
            ],
        });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        const defaultDiningInfo = {
            totalTables: 16,
            seatingCapacity: 64,
            tableTypes: [
                { type: '2-Seater Couple Table', count: 4, capacity: 2 },
                { type: '4-Seater Family Table', count: 8, capacity: 4 },
                { type: '6-Seater Group Suite', count: 2, capacity: 6 },
                { type: 'VIP Private Booth', count: 2, capacity: 6 }
            ],
            amenities: [
                'Air Conditioned Hall ❄️',
                'Outdoor Rooftop Seating 🌃',
                'Live Acoustic Music 🎸',
                'Valet Parking Available 🚗',
                'Family & Kids Friendly 👨‍👩‍👧',
                'Bar & Cocktails Section 🍹',
                'High-Speed Guest Wi-Fi 📶'
            ],
            openingTime: '11:00 AM',
            closingTime: '11:00 PM',
            slotDurationMinutes: 60,
            advanceBookingDays: 7,
            description: 'Experience premium luxury dining with authentic chef specials, vibrant rooftop ambience, and personalized table service.',
            images: [
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1000',
                'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=1000',
                'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=1000',
                'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&q=80&w=1000'
            ],
            videos: [
                'https://www.youtube.com/embed/dQw4w9WgXcQ'
            ],
            bookingNotice: 'Table reservations are held for 15 minutes past scheduled arrival time.'
        };
        const diningInfo = profile.diningInfo && Object.keys(profile.diningInfo).length > 0
            ? profile.diningInfo
            : defaultDiningInfo;
        res.status(200).json({
            success: true,
            diningEnabled: profile.diningEnabled !== false,
            diningInfo
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch dining info', error: error.message });
    }
};
exports.getDiningInfo = getDiningInfo;
// PUT /api/food/dining/info - Update dining info, media gallery & toggle ON/OFF
const updateDiningInfo = async (req, res) => {
    try {
        const ctx = req.foodPartnerContext;
        const rawIds = [ctx?.restaurantId, ctx?.vendorId, ctx?.userId, ctx?.storeId].filter(Boolean);
        const objectIds = rawIds
            .filter((id) => mongoose_1.default.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose_1.default.Types.ObjectId(String(id)));
        const { diningEnabled, diningInfo } = req.body;
        const updateData = {};
        if (typeof diningEnabled === 'boolean') {
            updateData.diningEnabled = diningEnabled;
        }
        if (diningInfo) {
            updateData.diningInfo = diningInfo;
        }
        const profile = await RestaurantProfile_1.RestaurantProfile.findOneAndUpdate({
            $or: [
                { _id: { $in: objectIds } },
                { vendorId: { $in: objectIds } },
                { userId: { $in: objectIds } },
                { storeId: { $in: objectIds } },
            ],
        }, updateData, { new: true });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Restaurant profile not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Dining information and gallery updated successfully',
            diningEnabled: profile.diningEnabled !== false,
            diningInfo: profile.diningInfo
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update dining info', error: error.message });
    }
};
exports.updateDiningInfo = updateDiningInfo;
