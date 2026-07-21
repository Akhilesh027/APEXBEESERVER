import { Router } from 'express';
import { protect } from '../middleware/auth';
import {
  getNearbyStores,
  getStoreBySlug,
  getStoreCatalog,
  getStoreOffers,
  getStoreReviews,
  getFavourites,
  addFavourite,
  removeFavourite,
} from '../controllers/storesController';

const router = Router();

// Public marketplace store routes
router.get('/nearby', getNearbyStores);
router.get('/favourites', protect, getFavourites);
router.post('/:id/favourite', protect, addFavourite);
router.delete('/:id/favourite', protect, removeFavourite);

router.get('/:slug', getStoreBySlug);
router.get('/:id/catalog', getStoreCatalog);
router.get('/:id/offers', getStoreOffers);
router.get('/:id/reviews', getStoreReviews);

export default router;
