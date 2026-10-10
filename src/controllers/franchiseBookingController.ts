import { Request, Response } from "express";
import { RazorpayService } from "../services/razorpayService";
import { Franchise } from "../models/Franchise";
import { User } from "../models/User";
import { BusinessApplication } from "../models/BusinessApplication";

// POST /api/franchises/booking/create-order
export const createFranchiseBookingOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, level, state, district, mandal, amount, paymentMode, baseAmount, gstAmount } = req.body;

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ success: false, message: "Invalid franchise booking amount" });
      return;
    }

    const order = await RazorpayService.createOrder(
      parsedAmount,
      `fr_bk_${Date.now()}`,
      {
        type: 'FRANCHISE_BOOKING',
        name: name || '',
        email: email || '',
        phone: phone || '',
        level: level || 'mandal',
        state: state || '',
        district: district || '',
        mandal: mandal || '',
        paymentMode: paymentMode || 'ADVANCE'
      }
    );

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: order.keyId,
      territoryDetails: {
        name: mandal || district || state || 'Territory',
        level,
        state,
        district,
        mandal
      }
    });
  } catch (error: any) {
    console.error('[FranchiseBookingController] createOrder error:', error);
    res.status(500).json({ success: false, message: error.message || "Failed to create franchise booking order" });
  }
};

// POST /api/franchises/booking/verify-payment
export const verifyFranchiseBookingPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, applicantDetails } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({
        success: false,
        message: "Missing required Razorpay payment verification parameters"
      });
      return;
    }

    const isValid = RazorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      res.status(400).json({
        success: false,
        message: "Invalid Razorpay payment signature. Verification failed."
      });
      return;
    }

    // Try to record/link application or franchise
    if (applicantDetails && applicantDetails.email) {
      try {
        const user = await User.findOne({ email: applicantDetails.email.toLowerCase() });
        if (user) {
          const franchiseRole = applicantDetails.level === 'state' ? 'state_franchise' :
            applicantDetails.level === 'district' ? 'district_franchise' : 'mandal_franchise';
          if (!user.roles.includes(franchiseRole as any)) {
            user.roles.push(franchiseRole as any);
          }
          user.franchiseLevel = applicantDetails.level;
          await user.save();
        }
      } catch (userErr: any) {
        console.warn('Could not auto-link user on franchise booking:', userErr.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Franchise booking payment verified successfully",
      paymentId: razorpayPaymentId
    });
  } catch (error: any) {
    console.error('[FranchiseBookingController] verifyPayment error:', error);
    res.status(500).json({ success: false, message: error.message || "Failed to verify franchise payment" });
  }
};
