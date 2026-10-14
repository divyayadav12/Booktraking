import { Router } from 'express';
import * as scannerSyncController from '../controllers/scannerSync.controller';

const router = Router();

// Mobile sends scanned barcode
router.post('/push', scannerSyncController.pushScan);

// Desktop polls for incoming scans
router.get('/poll', scannerSyncController.pollScans);

// Mobile pairs/registers
router.post('/connect', scannerSyncController.registerPhone);

export default router;
