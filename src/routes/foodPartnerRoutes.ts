import { Router } from 'express';
import fs from 'fs';
import { uploadDisk } from '../middleware/multer';
import { uploadToCloudinary } from '../config/cloudinary';
import {
  sendFoodPartnerOtp,
  verifyFoodPartnerOtp,
  foodPartnerLogin,
  foodPartnerRegister,
  getFoodPartnerMe,
} from '../controllers/foodPartnerAuthController';

import {
  getProfile,
  updateProfile,
  updateOperatingHours,
  updateSettings,
  saveOnboardingStep,
  submitOnboarding,
} from '../controllers/foodPartnerProfileController';

import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getMenuItems,
  getAllMenuItemsForAdmin,
  createMenuItem,
  updateMenuItem,
  toggleItemSoldOut,
  respondToCommissionOffer,
  adminReviewMenuItem,
  getVariants,
  createVariant,
  getAddonGroups,
  createAddonGroup,
  linkAddonGroupToItems,
  deleteAddonGroup,
  getCombos,
} from '../controllers/foodMenuController';

import {
  getAvailabilityOverview,
  toggleItemAvailability,
  bulkToggleItemAvailability,
  updateOperationalStatus,
} from '../controllers/foodAvailabilityController';

import {
  getFoodOrders,
  getLiveOrdersFeed,
  acceptFoodOrder,
  rejectFoodOrder,
  updateFoodOrderStatus,
} from '../controllers/foodOrderController';

import {
  getRestaurantOffers,
  createRestaurantOffer,
  toggleOfferStatus,
} from '../controllers/foodOfferController';

import {
  getEarningsSummary,
  getSettlementHistory,
  getAnalyticsData,
} from '../controllers/foodFinanceController';

import {
  getDiningBookings,
  createDiningBooking,
  updateDiningBookingStatus,
  getDiningInfo,
  updateDiningInfo,
} from '../controllers/foodDiningController';

import { protectFoodPartner, restrictFoodStaffPermission } from '../middleware/foodPartnerAuthMiddleware';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// --- PUBLIC AUTH ENDPOINTS ---
router.post('/auth/send-otp', sendFoodPartnerOtp);
router.post('/auth/verify-otp', verifyFoodPartnerOtp);
router.post('/auth/login', foodPartnerLogin);
router.post('/auth/register', foodPartnerRegister);

// --- ADMIN-ONLY ENDPOINTS (uses admin token, NOT food partner token) ---
router.get('/admin/menu/items', protect, restrictTo('admin'), getAllMenuItemsForAdmin);
router.post('/admin/menu/items/:id/review-commission', protect, restrictTo('admin'), adminReviewMenuItem);

// --- PROTECTED FOOD PARTNER ENDPOINTS ---
router.use(protectFoodPartner);

// Context & Profile
router.get('/auth/me', getFoodPartnerMe);
router.get('/profile', getProfile);
router.put('/profile', restrictFoodStaffPermission('profile'), updateProfile);
router.put('/hours', restrictFoodStaffPermission('profile'), updateOperatingHours);
router.put('/settings', restrictFoodStaffPermission('settings'), updateSettings);
router.post('/onboarding/step', saveOnboardingStep);
router.post('/onboarding/submit', submitOnboarding);

// Menu Engine
router.get('/menu/categories', getCategories);
router.post('/menu/categories', restrictFoodStaffPermission('menu'), createCategory);
router.put('/menu/categories/:id', restrictFoodStaffPermission('menu'), updateCategory);
router.delete('/menu/categories/:id', restrictFoodStaffPermission('menu'), deleteCategory);

router.get('/menu/items', getMenuItems);
router.post('/menu/items', restrictFoodStaffPermission('menu'), createMenuItem);
router.put('/menu/items/:id', restrictFoodStaffPermission('menu'), updateMenuItem);
router.patch('/menu/items/:id/sold-out', restrictFoodStaffPermission('availability', 'menu'), toggleItemSoldOut);
router.post('/menu/items/:id/respond-commission', restrictFoodStaffPermission('menu'), respondToCommissionOffer);
// Admin menu routes moved above protectFoodPartner middleware

router.get('/menu/variants', getVariants);
router.post('/menu/variants', restrictFoodStaffPermission('menu'), createVariant);

router.get('/menu/addons', getAddonGroups);
router.post('/menu/addons', restrictFoodStaffPermission('menu'), createAddonGroup);
router.post('/menu/addons/:groupId/items', restrictFoodStaffPermission('menu'), linkAddonGroupToItems);
router.delete('/menu/addons/:groupId', restrictFoodStaffPermission('menu'), deleteAddonGroup);

router.get('/menu/combos', getCombos);

// Availability Fast Control
router.get('/availability/overview', getAvailabilityOverview);
router.patch('/availability/items/:itemId', restrictFoodStaffPermission('availability'), toggleItemAvailability);
router.post('/availability/bulk-toggle', restrictFoodStaffPermission('availability'), bulkToggleItemAvailability);
router.put('/availability/operational-status', restrictFoodStaffPermission('availability', 'settings'), updateOperationalStatus);

// Live Orders
router.get('/orders', restrictFoodStaffPermission('orders'), getFoodOrders);
router.get('/orders/live-feed', restrictFoodStaffPermission('orders'), getLiveOrdersFeed);
router.post('/orders/:orderId/accept', restrictFoodStaffPermission('orders'), acceptFoodOrder);
router.post('/orders/:orderId/reject', restrictFoodStaffPermission('orders'), rejectFoodOrder);
router.patch('/orders/:orderId/status', restrictFoodStaffPermission('orders'), updateFoodOrderStatus);
router.put('/orders/:orderId/status', restrictFoodStaffPermission('orders'), updateFoodOrderStatus);

// Dining & Table Reservations Engine
router.get('/dining/bookings', restrictFoodStaffPermission('orders'), getDiningBookings);
router.post('/dining/bookings', restrictFoodStaffPermission('orders'), createDiningBooking);
router.patch('/dining/bookings/:id/status', restrictFoodStaffPermission('orders'), updateDiningBookingStatus);
router.get('/dining/info', getDiningInfo);
router.put('/dining/info', restrictFoodStaffPermission('profile', 'settings'), updateDiningInfo);

// Offers & Commercial
router.get('/offers', getRestaurantOffers);
router.post('/offers', restrictFoodStaffPermission('offers'), createRestaurantOffer);
router.patch('/offers/:id/status', restrictFoodStaffPermission('offers'), toggleOfferStatus);

// Finance & Analytics
router.get('/finance/earnings', restrictFoodStaffPermission('finance'), getEarningsSummary);
router.get('/finance/settlements', restrictFoodStaffPermission('finance'), getSettlementHistory);
router.get('/analytics', restrictFoodStaffPermission('reports'), getAnalyticsData);

// Image Upload Handler for Logo, Banners & Dishes
router.post('/upload', uploadDisk.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    try {
      const fileBuffer = fs.readFileSync(req.file.path);
      const cloudinaryUrl = await uploadToCloudinary(fileBuffer, 'apexbee/food');
      if (cloudinaryUrl) {
        fs.unlinkSync(req.file.path);
        return res.status(200).json({ success: true, url: cloudinaryUrl });
      }
    } catch (e) {
      console.warn('Cloudinary upload bypassed, using local file URL:', e);
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    return res.status(200).json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error('Food Partner upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
  }
});

export default router;
