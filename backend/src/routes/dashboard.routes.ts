import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/summary', authenticate, dashboardController.getSummary);
router.get('/dispatch-trends', authenticate, dashboardController.getDispatchTrends);

export default router;
