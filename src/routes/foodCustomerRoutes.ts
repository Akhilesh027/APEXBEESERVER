import { Router } from 'express';
import {
  getCustomerRestaurantsListing,
  getCustomerRestaurantDetail,
  validateFoodCart,
  getAllFoodItems,
  getDiningVenues,
  createCustomerTableBooking,
} from '../controllers/foodCustomerController';
import {
  getCustomerScannedMenu,
  placeCustomerTableOrder,
} from '../controllers/tableQrController';

const router = Router();

router.get('/items', getAllFoodItems);
router.get('/restaurants', getCustomerRestaurantsListing);
router.get('/restaurants/:idOrSlug', getCustomerRestaurantDetail);
router.post('/cart/validate', validateFoodCart);
router.get('/dining/venues', getDiningVenues);
router.post('/dining/book', createCustomerTableBooking);

// PUBLIC CUSTOMER DIGITAL MENU SCAN & DINE-IN ORDERING
router.get('/qr-menu/:tokenOrTable', getCustomerScannedMenu);
router.post('/qr-menu/order', placeCustomerTableOrder);

export default router;
