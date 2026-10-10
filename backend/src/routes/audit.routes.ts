import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import { authenticate, requireRole } from '../middleware/auth';
const router = Router();

// Admin-only audit logs route
router.use(authenticate, requireRole('ADMIN'));

router.get('/', auditController.getAuditLogs);

export default router;
