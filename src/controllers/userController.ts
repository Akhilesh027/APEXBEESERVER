import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { Address } from "../models/Address";
import { Wallet } from "../models/Wallet";
import { WalletEngine } from "../services/WalletEngine";
import { CommissionSettlement } from "../models/CommissionSettlement";

// GET /api/user/profile/:id
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.status(200).json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT / PATCH /api/user/profile/:id
export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const { name, phone, mobile, bio, gender, dateOfBirth, address, pincode, profileImage, sellerProfile } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (mobile !== undefined) user.mobile = mobile;
    if (bio !== undefined) user.bio = bio;
    if (gender !== undefined) user.gender = gender;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (address !== undefined) user.address = address;
    if (pincode !== undefined) user.pincode = pincode;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (sellerProfile !== undefined) {
      user.sellerProfile = { ...user.sellerProfile, ...sellerProfile };
    }

    await user.save();
    const updated = await User.findById(userId).select("-passwordHash");
    res.status(200).json({ success: true, message: "Profile updated successfully", user: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/user/address/:userId
export const getUserAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json({ success: true, addresses });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/user/address/:userId or /api/user/address
export const createUserAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.userId || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const {
      label,
      customLabel,
      recipientName,
      phone,
      addressLine1,
      addressLine2,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      coordinates,
      deliveryInstructions,
      isDefault
    } = req.body;

    if (isDefault) {
      await Address.updateMany({ userId }, { isDefault: false });
    }

    const count = await Address.countDocuments({ userId });
    const shouldBeDefault = isDefault || count === 0;

    const address = await Address.create({
      userId,
      label: label || 'home',
      customLabel,
      recipientName: recipientName || 'Customer',
      phone: phone || '',
      addressLine1: addressLine1 || '',
      addressLine2,
      landmark,
      city: city || '',
      district,
      state: state || '',
      country: country || 'India',
      pincode: pincode || '',
      location: {
        type: 'Point',
        coordinates: coordinates || [0, 0]
      },
      deliveryInstructions,
      isDefault: shouldBeDefault
    });

    res.status(201).json({ success: true, message: "Address added successfully", address });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/user/address/:userId/:addressId
export const updateUserAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    const updates = req.body;

    if (updates.isDefault) {
      const addr = await Address.findById(addressId);
      if (addr) {
        await Address.updateMany({ userId: addr.userId }, { isDefault: false });
      }
    }

    const updated = await Address.findByIdAndUpdate(addressId, updates, { new: true });
    if (!updated) {
      res.status(404).json({ success: false, message: "Address not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Address updated successfully", address: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/user/address/:userId/:addressId/default
export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, addressId } = req.params;
    await Address.updateMany({ userId }, { isDefault: false });
    const updated = await Address.findByIdAndUpdate(addressId, { isDefault: true }, { new: true });
    res.status(200).json({ success: true, message: "Default address set successfully", address: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/user/address/:userId/:addressId
export const deleteUserAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { addressId } = req.params;
    await Address.findByIdAndDelete(addressId);
    res.status(200).json({ success: true, message: "Address deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/user/bank-details
export const getUserBankDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const user = await User.findById(userId).select("bankDetails bankAccount");
    res.status(200).json({
      success: true,
      bankDetails: (user as any)?.bankDetails || (user as any)?.bankAccount || null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/user/bank-details
export const updateUserBankDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { accountNumber, ifscCode, bankName, accountHolderName, upiId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    (user as any).bankDetails = {
      accountNumber,
      ifscCode,
      bankName,
      accountHolderName,
      upiId,
      updatedAt: new Date()
    };
    await user.save();

    res.status(200).json({ success: true, message: "Bank details updated successfully", bankDetails: (user as any).bankDetails });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/user/commissions
export const getUserCommissions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const commissions = await CommissionSettlement.find({ recipientId: userId })
      .populate("orderId", "orderNumber totalAmount createdAt customerName customerPhone")
      .populate("productId", "title name")
      .populate("vendorId", "name email storeName")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, commissions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/user/wallet/:id
export const getUserWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const wallet = await WalletEngine.getOrCreateWallet(userId);
    res.status(200).json({ success: true, wallet });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/user/rewards/:id
export const getUserRewards = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id || req.user?.id;
    if (!userId) {
      res.status(400).json({ success: false, message: "User ID required" });
      return;
    }
    const wallet = await Wallet.findOne({ userId });
    res.status(200).json({
      success: true,
      rewardCoins: wallet?.rewardCoins || 0,
      rewardsHistory: []
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
