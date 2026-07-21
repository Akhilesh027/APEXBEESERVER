import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Address } from '../models/Address';
import { ReferralTransaction } from '../models/ReferralTransaction';
import { CommissionSettlement } from '../models/CommissionSettlement';
import { Wallet } from '../models/Wallet';
import { Referral } from '../models/Referral';
import { Order } from '../models/Order';

// Get profile
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        mobile: user.mobile,
        roles: user.roles,
        status: user.status,
        isVerified: user.isVerified,
        avatar: user.profileImage,
        profileImage: user.profileImage,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        bio: user.bio,
        territory: user.territory,
        sellerProfile: user.sellerProfile,
        entrepreneurProfile: user.entrepreneurProfile
      }
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error retrieving profile', error: error.message });
  }
};

// Update profile (PUT or PATCH)
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const updates = req.body;

    if (updates.name !== undefined) user.name = updates.name;
    if (updates.email !== undefined) user.email = updates.email;
    if (updates.phone !== undefined) {
      user.phone = updates.phone;
      user.mobile = updates.phone;
    }
    if (updates.dateOfBirth !== undefined) user.dateOfBirth = updates.dateOfBirth;
    if (updates.gender !== undefined) user.gender = updates.gender;
    if (updates.bio !== undefined) user.bio = updates.bio;
    if (updates.avatar !== undefined) user.profileImage = updates.avatar;
    if (updates.profileImage !== undefined) user.profileImage = updates.profileImage;

    const saved = await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: saved._id,
        _id: saved._id,
        name: saved.name,
        email: saved.email,
        phone: saved.phone,
        mobile: saved.mobile,
        roles: saved.roles,
        status: saved.status,
        isVerified: saved.isVerified,
        avatar: saved.profileImage,
        profileImage: saved.profileImage,
        dateOfBirth: saved.dateOfBirth,
        gender: saved.gender,
        bio: saved.bio,
        territory: saved.territory
      }
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile', error: error.message });
  }
};

// Get addresses
export const getUserAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const addresses = await Address.find({ userId });
    res.status(200).json({ success: true, addresses });
  } catch (error: any) {
    console.error('Get addresses error:', error);
    res.status(500).json({ message: 'Server error retrieving addresses', error: error.message });
  }
};

// Create or Edit address
export const createUserAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId: paramUserId } = req.params;
    const { id, userId: bodyUserId, name, phone, address, city, state, pincode, type, isDefault } = req.body;

    const userId = paramUserId || bodyUserId || (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      res.status(400).json({ message: 'User ID is required' });
      return;
    }

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const resolvedLabel =
      (type === 'work' || type === 'Office')
        ? 'office'
        : (type === 'other' || type === 'Other')
          ? 'other'
          : 'home';

    let addr;
    if (id) {
      // It is an edit/update!
      addr = await Address.findOne({ _id: id, userId });
      if (addr) {
        if (name !== undefined) {
          addr.name = name;
          addr.recipientName = name;
        }
        if (phone !== undefined) addr.phone = phone;
        if (address !== undefined) {
          addr.address = address;
          addr.addressLine1 = address;
        }
        if (city !== undefined) addr.city = city;
        if (state !== undefined) addr.state = state;
        if (pincode !== undefined) addr.pincode = pincode;
        if (type !== undefined) {
          addr.type = type;
          addr.label = resolvedLabel;
        }
        if (isDefault !== undefined) addr.isDefault = isDefault;
        await addr.save();
      }
    }

    if (!addr) {
      // It is a new address!
      const count = await Address.countDocuments({ userId });
      addr = new Address({
        userId,
        name,
        recipientName: name || 'Customer',
        phone,
        address,
        addressLine1: address || 'Address Line 1',
        city,
        state,
        pincode,
        type: type || 'Home',
        label: resolvedLabel,
        isDefault: isDefault || count === 0,
        location: {
          type: 'Point',
          coordinates: [78.4867, 17.3850] // Default Hyderabad coordinates
        }
      });
      await addr.save();
    }

    const addresses = await Address.find({ userId });
    res.status(200).json({
      success: true,
      address: addr,
      addresses,
      message: id ? 'Address updated successfully' : 'Address created successfully'
    });
  } catch (error: any) {
    console.error('Save address error:', error);
    res.status(500).json({ message: 'Server error saving address', error: error.message });
  }
};

// Update address
export const updateUserAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, addressId } = req.params;
    const { name, phone, address, city, state, pincode, type, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const addr = await Address.findOne({ _id: addressId, userId });
    if (!addr) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const resolvedLabel =
      (type === 'work' || type === 'Office')
        ? 'office'
        : (type === 'other' || type === 'Other')
          ? 'other'
          : 'home';

    if (name !== undefined) {
      addr.name = name;
      addr.recipientName = name;
    }
    if (phone !== undefined) addr.phone = phone;
    if (address !== undefined) {
      addr.address = address;
      addr.addressLine1 = address;
    }
    if (city !== undefined) addr.city = city;
    if (state !== undefined) addr.state = state;
    if (pincode !== undefined) addr.pincode = pincode;
    if (type !== undefined) {
      addr.type = type;
      addr.label = resolvedLabel;
    }
    if (isDefault !== undefined) addr.isDefault = isDefault;

    await addr.save();

    const addresses = await Address.find({ userId });
    res.status(200).json({ success: true, address: addr, addresses, message: 'Address updated successfully' });
  } catch (error: any) {
    console.error('Update address error:', error);
    res.status(500).json({ message: 'Server error updating address', error: error.message });
  }
};

// Set default address
export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, addressId } = req.params;
    await Address.updateMany({ userId }, { isDefault: false });
    const addr = await Address.findOneAndUpdate({ _id: addressId, userId }, { isDefault: true }, { new: true });
    if (!addr) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }
    const addresses = await Address.find({ userId });
    res.status(200).json({ success: true, addresses, message: 'Default address updated' });
  } catch (error: any) {
    console.error('Set default address error:', error);
    res.status(500).json({ message: 'Server error setting default address', error: error.message });
  }
};

// Delete address
export const deleteUserAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, addressId } = req.params;
    const deleted = await Address.findOneAndDelete({ _id: addressId, userId });
    if (!deleted) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    if (deleted.isDefault) {
      const first = await Address.findOne({ userId });
      if (first) {
        first.isDefault = true;
        await first.save();
      }
    }

    const addresses = await Address.find({ userId });
    res.status(200).json({ success: true, addresses, message: 'Address deleted successfully' });
  } catch (error: any) {
    console.error('Delete address error:', error);
    res.status(500).json({ message: 'Server error deleting address', error: error.message });
  }
};

// GET /api/user/bank-details
export const getUserBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.status(200).json({
      success: true,
      bankDetails: user.bankDetails || {
        accountHolderName: "",
        bankName: "",
        accountNumber: "",
        ifsc: "",
        upiId: ""
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error retrieving bank details', error: error.message });
  }
};

// PUT /api/user/bank-details
export const updateUserBankDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { bankDetails } = req.body;
    if (bankDetails) {
      user.bankDetails = {
        accountHolderName: bankDetails.accountHolderName || "",
        bankName: bankDetails.bankName || "",
        accountNumber: bankDetails.accountNumber || "",
        ifsc: bankDetails.ifsc || "",
        upiId: bankDetails.upiId || ""
      };
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: user.bankDetails
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error updating bank details', error: error.message });
  }
};

// GET /api/user/commissions
export const getUserCommissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;

    // 1. Signup Bonuses (from Referral collection where referrerUserId === userId and status === "rewarded")
    const rewardedRefs = await Referral.find({ referrerUserId: userId, status: "rewarded" })
      .populate("referredUserId", "name email")
      .sort({ updatedAt: -1 });

    const signupCommissions = rewardedRefs.map(ref => ({
      _id: ref._id,
      date: ref.updatedAt || ref.createdAt,
      userName: (ref.referredUserId as any)?.name || "Direct Referral",
      userEmail: (ref.referredUserId as any)?.email || "N/A",
      orderNumber: "N/A",
      orderValue: 0,
      commissionType: "Signup Bonus",
      commissionPercentage: null,
      commissionAmount: ref.rewardAmount,
      level: 1,
      status: "released",
      notes: `${ref.referralType?.replace("_", " ").toUpperCase() || "CUSTOMER"} referral approved`
    }));

    // 2. First Purchase & Product Commissions (from ReferralTransaction)
    const txs = await ReferralTransaction.find({ recipientUserId: userId })
      .populate("referredUserId", "name email")
      .populate("orderId", "orderNumber totalAmount createdAt")
      .sort({ createdAt: -1 });

    const refCommissions = txs.map(tx => {
      const orderVal = (tx.orderId as any)?.totalAmount || 0;
      let commissionPercentage = null;
      if (tx.transactionType === "product_commission" && orderVal > 0) {
        commissionPercentage = Number(((tx.amount / orderVal) * 100).toFixed(2));
      }
      return {
        _id: tx._id,
        date: tx.createdAt,
        userName: (tx.referredUserId as any)?.name || "Downline User",
        userEmail: (tx.referredUserId as any)?.email || "N/A",
        orderNumber: (tx.orderId as any)?.orderNumber || "N/A",
        orderValue: orderVal,
        commissionType: tx.transactionType === "first_order_bonus"
          ? "Signup Bonus"
          : tx.transactionType === "first_purchase_product_commission"
            ? "First Purchase"
            : "Product Commission",
        commissionPercentage,
        commissionAmount: tx.amount,
        level: tx.level,
        status: tx.status,
        notes: tx.notes || `${
          tx.transactionType === "first_order_bonus"
            ? "First order signup bonus"
            : tx.transactionType === "first_purchase_product_commission"
              ? "First product purchase commission"
              : "Product purchase commission"
        } level ${tx.level}`
      };
    });

    // 3. Franchise / Vendor / Membership / Recurring splits (from CommissionSettlement)
    const settlements = await CommissionSettlement.find({ recipientId: userId })
      .populate({
        path: 'orderId',
        populate: {
          path: 'customerId',
          select: 'name email'
        }
      })
      .populate("vendorId", "name")
      .sort({ createdAt: -1 });

    const settlementCommissions = settlements.map(s => {
      let commissionType = "Product Commission";
      let notes = "";
      if (s.settlementType === "entrepreneur") {
        commissionType = "Membership";
        notes = "Entrepreneur commission share";
      } else if (s.settlementType === "vendor") {
        commissionType = "Vendor";
        notes = "Vendor sales settlement";
      } else if (s.settlementType === "franchise") {
        commissionType = "Franchise";
        notes = "Franchise territory revenue split";
      } else if (s.settlementType === "wishlink" || s.settlementType === "referralPool") {
        commissionType = "Recurring";
        notes = `${s.settlementType} recurring payout`;
      }

      const orderVal = (s.orderId as any)?.totalAmount || s.amount;
      const commissionPercentage = orderVal > 0 ? Number(((s.amount / orderVal) * 100).toFixed(2)) : null;

      const customer = (s.orderId as any)?.customerId;

      return {
        _id: s._id,
        date: s.createdAt,
        userName: customer?.name || (s.vendorId as any)?.name || "System",
        userEmail: customer?.email || "N/A",
        orderNumber: (s.orderId as any)?.orderNumber || "N/A",
        orderValue: orderVal,
        commissionType,
        commissionPercentage,
        commissionAmount: s.amount,
        level: 0,
        status: s.status,
        notes
      };
    });

    const allCommissions = [...signupCommissions, ...refCommissions, ...settlementCommissions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.status(200).json({
      success: true,
      commissions: allCommissions.slice(0, 200)
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error retrieving user commissions', error: error.message });
  }
};

// GET /api/user/wallet/:id
export const getUserWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' });
      return;
    }

    let wallet = await Wallet.findOne({ userId: id });
    if (!wallet) {
      wallet = new Wallet({
        userId: id,
        availableBalance: 0,
        pendingBalance: 0,
        withdrawnBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        ledgerEntries: []
      });
      await wallet.save();
    }

    res.status(200).json({
      success: true,
      wallet: {
        _id: wallet._id,
        userId: wallet.userId,
        balance: wallet.availableBalance,
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        withdrawnBalance: wallet.withdrawnBalance,
        totalCredits: wallet.totalCredits,
        totalDebits: wallet.totalDebits,
        ledgerEntries: wallet.ledgerEntries
      },
      walletBalance: wallet.availableBalance
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error retrieving wallet', error: error.message });
  }
};

export const getUserRewards = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.status(200).json({ success: true, rewardPoints: 150 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server error retrieving rewards', error: error.message });
  }
};
