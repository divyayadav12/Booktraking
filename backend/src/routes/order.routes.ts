import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticate, requireRole } from '../middleware/auth';
const router = Router();

router.use(authenticate);

// Outgoing orders are accessible to both EMPLOYEE and ADMIN
router.get('/outgoing', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOutgoingOrders);

// Barcode sheet — all orders with productCode + bookCodes for print/download (Admin only)
router.get('/barcode-sheet', requireRole('ADMIN'), orderController.getBarcodeSheet);

// Order details and items accessible to both
router.get('/:id', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOrderById);
router.get('/:id/items', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOrderItems);

// All orders list is accessible to ADMIN
router.get('/', requireRole('ADMIN'), orderController.getOrders);

export default router;
