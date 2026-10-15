import { Router } from 'express';
import multer from 'multer';
import * as stockController from '../controllers/stock.controller';
import { authenticate, requireRole } from '../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) files are permitted'));
    }
  },
});

const router = Router();

router.use(authenticate);

// Accessible by both ADMIN and EMPLOYEE
router.get('/available', requireRole('ADMIN', 'EMPLOYEE'), stockController.getAvailableStock);
router.get('/inward', requireRole('ADMIN', 'EMPLOYEE'), stockController.getInwardHistory);
router.post('/inward', requireRole('ADMIN', 'EMPLOYEE'), stockController.addInwardEntry);
router.post('/inward/bulk', requireRole('ADMIN', 'EMPLOYEE'), upload.single('file'), stockController.bulkInwardExcel);
router.delete('/inward/:id', requireRole('ADMIN', 'EMPLOYEE'), stockController.deleteInwardEntry);
router.get('/search-catalog', requireRole('ADMIN', 'EMPLOYEE'), stockController.searchBookCatalog);
router.get('/export/available', requireRole('ADMIN', 'EMPLOYEE'), stockController.exportStockExcel);
router.get('/export/inward', requireRole('ADMIN', 'EMPLOYEE'), stockController.exportInwardExcel);

export default router;
