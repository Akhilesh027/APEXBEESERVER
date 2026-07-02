import express from 'express';
import {
  getWishlist,
  toggleWishlist,
  checkWishlistStatus,
} from '../controllers/wishlistController';

const router = express.Router();

router.get('/:userId', getWishlist);
router.post('/toggle', toggleWishlist);
router.post('/check', checkWishlistStatus);

export default router;
