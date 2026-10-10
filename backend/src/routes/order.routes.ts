import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Outgoing orders are accessible to both EMPLOYEE and ADMIN
router.get('/outgoing', requireRole(Role.ADMIN, Role.EMPLOYEE), orderController.getOutgoingOrders);

// Order details and items accessible to both
router.get('/:id', requireRole(Role.ADMIN, Role.EMPLOYEE), orderController.getOrderById);
router.get('/:id/items', requireRole(Role.ADMIN, Role.EMPLOYEE), orderController.getOrderItems);

// All orders list is accessible to ADMIN
router.get('/', requireRole(Role.ADMIN), orderController.getOrders);

export default router;
