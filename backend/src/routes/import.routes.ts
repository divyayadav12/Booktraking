import { Router } from 'express';
import multer from 'multer';
import * as importController from '../controllers/import.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) files are permitted'));
    }
  },
});

const router = Router();

// Admin-only routes
router.use(authenticate, requireRole(Role.ADMIN));

router.post('/preview', upload.single('file'), importController.previewImport);
router.post('/download-invalid', importController.downloadInvalidRows);
router.post('/confirm', importController.confirmImport);
router.get('/', importController.listImports);
router.get('/:id', importController.getImportById);
router.get('/:id/errors', importController.getImportErrors);

export default router;
