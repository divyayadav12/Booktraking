import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// Admin-only employee management routes
router.use(authenticate, requireRole(Role.ADMIN));

router.get('/', employeeController.getEmployees);
router.post('/', employeeController.createEmployee);
router.patch('/:id/status', employeeController.updateStatus);

export default router;
