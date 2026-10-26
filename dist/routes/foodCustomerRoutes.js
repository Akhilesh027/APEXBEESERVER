"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const foodCustomerController_1 = require("../controllers/foodCustomerController");
const tableQrController_1 = require("../controllers/tableQrController");
const router = (0, express_1.Router)();
router.get('/items', foodCustomerController_1.getAllFoodItems);
router.get('/restaurants', foodCustomerController_1.getCustomerRestaurantsListing);
router.get('/restaurants/:idOrSlug', foodCustomerController_1.getCustomerRestaurantDetail);
router.post('/cart/validate', foodCustomerController_1.validateFoodCart);
router.get('/dining/venues', foodCustomerController_1.getDiningVenues);
router.post('/dining/book', foodCustomerController_1.createCustomerTableBooking);
// PUBLIC CUSTOMER DIGITAL MENU SCAN & DINE-IN ORDERING
router.get('/qr-menu/:tokenOrTable', tableQrController_1.getCustomerScannedMenu);
router.post('/qr-menu/order', tableQrController_1.placeCustomerTableOrder);
exports.default = router;
