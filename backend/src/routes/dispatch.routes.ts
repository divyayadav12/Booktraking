import { Router } from 'express';
import * as dispatchController from '../controllers/dispatch.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { dispatchRateLimiter } from '../middleware/rateLimiter';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Dispatch verification is used by Employees & Admin
router.post('/verify', requireRole(Role.EMPLOYEE, Role.ADMIN), dispatchRateLimiter, dispatchController.verifyAndDispatch);

// Personal dispatch history for employee/admin
router.get('/my-history', requireRole(Role.EMPLOYEE, Role.ADMIN), dispatchController.getMyHistory);

// Admin-only global dispatch history & failed verification attempts
router.get('/history', requireRole(Role.ADMIN), dispatchController.getHistory);
router.get('/failed-attempts', requireRole(Role.ADMIN), dispatchController.getFailedAttempts);

export default router;
