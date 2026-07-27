import { Request, Response } from 'express';
import TableBooking from '../models/TableBooking';
import { Vendor } from '../models/Vendor';

export const createTableBooking = async (req: Request, res: Response) => {
  try {
    const { vendorId, guestName, guestPhone, bookingDate, timeSlot, guestCount, specialRequests } = req.body;

    if (!vendorId || !guestName || !guestPhone || !bookingDate || !timeSlot) {
      return res.status(400).json({ message: 'Missing required reservation fields' });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Restaurant vendor not found' });
    }

    const booking = new TableBooking({
      vendorId,
      userId: (req as any).user?.id || (req as any).user?._id || null,
      guestName,
      guestPhone,
      bookingDate: new Date(bookingDate),
      timeSlot,
      guestCount: Number(guestCount) || 2,
      specialRequests: specialRequests || '',
      status: 'pending',
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: `Table reservation requested at ${vendor.businessName} for ${guestCount} guests on ${timeSlot}!`,
      booking,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create table reservation', error: error.message });
  }
};

export const getVendorTableBookings = async (req: Request, res: Response) => {
  try {
    const { vendorId } = req.params;
    const bookings = await TableBooking.find({ vendorId }).sort({ bookingDate: -1, createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch table bookings', error: error.message });
  }
};

export const updateTableBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const booking = await TableBooking.findByIdAndUpdate(id, { status }, { new: true });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({ success: true, message: `Reservation status updated to ${status}`, booking });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update reservation status', error: error.message });
  }
};
