import { Router } from 'express';
import {
  search,
  getSuggestions,
  getTrending,
  getRecent,
  saveHistory,
  deleteHistory,
  searchBarcode,
} from '../controllers/searchController';

const router = Router();

router.get('/', search);
router.get('/suggestions', getSuggestions);
router.get('/trending', getTrending);
router.get('/recent', getRecent);
router.post('/history', saveHistory);
router.delete('/history', deleteHistory);
router.get('/barcode/:barcode', searchBarcode);

export default router;
