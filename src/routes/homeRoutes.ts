import { Router } from 'express';
import { getHomeDashboard, getPersonalizationDetails } from '../controllers/homeController';

const router = Router();

router.get('/', getHomeDashboard);
router.get('/personalization', getPersonalizationDetails);

export default router;
