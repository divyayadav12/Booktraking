import { Router } from 'express';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import importRoutes from './import.routes';
import orderRoutes from './order.routes';
import dispatchRoutes from './dispatch.routes';
import reportRoutes from './report.routes';
import employeeRoutes from './employee.routes';
import auditRoutes from './audit.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/imports', importRoutes);
router.use('/orders', orderRoutes);
router.use('/dispatch', dispatchRoutes);
router.use('/reports', reportRoutes);
router.use('/employees', employeeRoutes);
router.use('/audit', auditRoutes);

export default router;
