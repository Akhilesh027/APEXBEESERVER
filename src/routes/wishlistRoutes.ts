import express from 'express';
import {
  getWishlist,
  toggleWishlist,
  checkWishlistStatus,
  syncWishlist,
} from '../controllers/wishlistController';

const router = express.Router();

router.get('/:userId', getWishlist);
router.post('/toggle', toggleWishlist);
router.post('/check', checkWishlistStatus);
router.post('/sync', syncWishlist);

export default router;
