import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticate, requireRole } from '../middleware/auth';
const router = Router();

router.use(authenticate);

// Outgoing orders are accessible to both EMPLOYEE and ADMIN
router.get('/outgoing', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOutgoingOrders);

// Barcode sheet — all orders with productCode + bookCodes for print/download (Admin & Employee)
router.get('/barcode-sheet', requireRole('ADMIN', 'EMPLOYEE'), orderController.getBarcodeSheet);

// Order details and items accessible to both
router.get('/:id', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOrderById);
router.get('/:id/items', requireRole('ADMIN', 'EMPLOYEE'), orderController.getOrderItems);

// Clear all orders and dispatch history (Admin only)
router.post('/clear-all', requireRole('ADMIN'), orderController.clearAllOrders);
router.delete('/clear-all', requireRole('ADMIN'), orderController.clearAllOrders);
router.delete('/bulk-delete', requireRole('ADMIN'), orderController.deleteOrders);

// All orders list is accessible to ADMIN
router.get('/', requireRole('ADMIN'), orderController.getOrders);

export default router;
