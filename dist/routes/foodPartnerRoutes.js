"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const multer_1 = require("../middleware/multer");
const cloudinary_1 = require("../config/cloudinary");
const foodPartnerAuthController_1 = require("../controllers/foodPartnerAuthController");
const foodPartnerProfileController_1 = require("../controllers/foodPartnerProfileController");
const foodMenuController_1 = require("../controllers/foodMenuController");
const foodAvailabilityController_1 = require("../controllers/foodAvailabilityController");
const foodOrderController_1 = require("../controllers/foodOrderController");
const foodOfferController_1 = require("../controllers/foodOfferController");
const foodFinanceController_1 = require("../controllers/foodFinanceController");
const foodDiningController_1 = require("../controllers/foodDiningController");
const foodPartnerAuthMiddleware_1 = require("../middleware/foodPartnerAuthMiddleware");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// --- PUBLIC AUTH ENDPOINTS ---
router.post('/auth/send-otp', foodPartnerAuthController_1.sendFoodPartnerOtp);
router.post('/auth/verify-otp', foodPartnerAuthController_1.verifyFoodPartnerOtp);
router.post('/auth/login', foodPartnerAuthController_1.foodPartnerLogin);
router.post('/auth/register', foodPartnerAuthController_1.foodPartnerRegister);
// --- ADMIN-ONLY ENDPOINTS (uses admin token, NOT food partner token) ---
router.get('/admin/menu/items', auth_1.protect, (0, auth_1.restrictTo)('admin'), foodMenuController_1.getAllMenuItemsForAdmin);
router.post('/admin/menu/items/:id/review-commission', auth_1.protect, (0, auth_1.restrictTo)('admin'), foodMenuController_1.adminReviewMenuItem);
// --- PROTECTED FOOD PARTNER ENDPOINTS ---
router.use(foodPartnerAuthMiddleware_1.protectFoodPartner);
// Context & Profile
router.get('/auth/me', foodPartnerAuthController_1.getFoodPartnerMe);
router.get('/profile', foodPartnerProfileController_1.getProfile);
router.put('/profile', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('profile'), foodPartnerProfileController_1.updateProfile);
router.put('/hours', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('profile'), foodPartnerProfileController_1.updateOperatingHours);
router.put('/settings', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('settings'), foodPartnerProfileController_1.updateSettings);
router.post('/onboarding/step', foodPartnerProfileController_1.saveOnboardingStep);
router.post('/onboarding/submit', foodPartnerProfileController_1.submitOnboarding);
// Menu Engine
router.get('/menu/categories', foodMenuController_1.getCategories);
router.post('/menu/categories', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.createCategory);
router.put('/menu/categories/:id', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.updateCategory);
router.delete('/menu/categories/:id', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.deleteCategory);
router.get('/menu/items', foodMenuController_1.getMenuItems);
router.post('/menu/items', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.createMenuItem);
router.put('/menu/items/:id', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.updateMenuItem);
router.patch('/menu/items/:id/sold-out', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('availability', 'menu'), foodMenuController_1.toggleItemSoldOut);
router.post('/menu/items/:id/respond-commission', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.respondToCommissionOffer);
// Admin menu routes moved above protectFoodPartner middleware
router.get('/menu/variants', foodMenuController_1.getVariants);
router.post('/menu/variants', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.createVariant);
router.get('/menu/addons', foodMenuController_1.getAddonGroups);
router.post('/menu/addons', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.createAddonGroup);
router.post('/menu/addons/:groupId/items', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.linkAddonGroupToItems);
router.delete('/menu/addons/:groupId', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('menu'), foodMenuController_1.deleteAddonGroup);
router.get('/menu/combos', foodMenuController_1.getCombos);
// Availability Fast Control
router.get('/availability/overview', foodAvailabilityController_1.getAvailabilityOverview);
router.patch('/availability/items/:itemId', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('availability'), foodAvailabilityController_1.toggleItemAvailability);
router.post('/availability/bulk-toggle', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('availability'), foodAvailabilityController_1.bulkToggleItemAvailability);
router.put('/availability/operational-status', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('availability', 'settings'), foodAvailabilityController_1.updateOperationalStatus);
// Live Orders
router.get('/orders', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.getFoodOrders);
router.get('/orders/live-feed', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.getLiveOrdersFeed);
router.post('/orders/:orderId/accept', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.acceptFoodOrder);
router.post('/orders/:orderId/reject', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.rejectFoodOrder);
router.patch('/orders/:orderId/status', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.updateFoodOrderStatus);
router.put('/orders/:orderId/status', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodOrderController_1.updateFoodOrderStatus);
// Dining & Table Reservations Engine
router.get('/dining/bookings', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodDiningController_1.getDiningBookings);
router.post('/dining/bookings', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodDiningController_1.createDiningBooking);
router.patch('/dining/bookings/:id/status', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('orders'), foodDiningController_1.updateDiningBookingStatus);
router.get('/dining/info', foodDiningController_1.getDiningInfo);
router.put('/dining/info', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('profile', 'settings'), foodDiningController_1.updateDiningInfo);
// Offers & Commercial
router.get('/offers', foodOfferController_1.getRestaurantOffers);
router.post('/offers', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('offers'), foodOfferController_1.createRestaurantOffer);
router.patch('/offers/:id/status', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('offers'), foodOfferController_1.toggleOfferStatus);
// Finance & Analytics
router.get('/finance/earnings', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('finance'), foodFinanceController_1.getEarningsSummary);
router.get('/finance/settlements', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('finance'), foodFinanceController_1.getSettlementHistory);
router.get('/analytics', (0, foodPartnerAuthMiddleware_1.restrictFoodStaffPermission)('reports'), foodFinanceController_1.getAnalyticsData);
// Image Upload Handler for Logo, Banners & Dishes
router.post('/upload', multer_1.uploadDisk.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded' });
        }
        try {
            const fileBuffer = fs_1.default.readFileSync(req.file.path);
            const cloudinaryUrl = await (0, cloudinary_1.uploadToCloudinary)(fileBuffer, 'apexbee/food');
            if (cloudinaryUrl) {
                fs_1.default.unlinkSync(req.file.path);
                return res.status(200).json({ success: true, url: cloudinaryUrl });
            }
        }
        catch (e) {
            console.warn('Cloudinary upload bypassed, using local file URL:', e);
        }
        const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        return res.status(200).json({ success: true, url: fileUrl });
    }
    catch (error) {
        console.error('Food Partner upload error:', error);
        return res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
    }
});
exports.default = router;
