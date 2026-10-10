import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// Admin-only report routes
router.use(authenticate, requireRole(Role.ADMIN));

router.get('/summary', reportController.getSummary);
router.get('/book-summary', reportController.getBookSummary);
router.get('/employees', reportController.getEmployeeSummary);
router.get('/export', reportController.exportReport);

export default router;
