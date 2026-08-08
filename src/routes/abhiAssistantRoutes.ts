import express from 'express';
import { handleAbhiQuery, handleAbhiHubData } from '../controllers/abhiAssistantController';

const router = express.Router();

router.get('/hub-data', handleAbhiHubData);
router.post('/query', handleAbhiQuery);

export default router;
