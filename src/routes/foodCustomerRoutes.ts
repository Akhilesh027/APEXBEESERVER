import { Router } from 'express';
import {
  getCustomerRestaurantsListing,
  getCustomerRestaurantDetail,
  validateFoodCart,
  getAllFoodItems,
  getDiningVenues,
  createCustomerTableBooking,
} from '../controllers/foodCustomerController';

const router = Router();

router.get('/items', getAllFoodItems);
router.get('/restaurants', getCustomerRestaurantsListing);
router.get('/restaurants/:idOrSlug', getCustomerRestaurantDetail);
router.post('/cart/validate', validateFoodCart);
router.get('/dining/venues', getDiningVenues);
router.post('/dining/book', createCustomerTableBooking);

export default router;
