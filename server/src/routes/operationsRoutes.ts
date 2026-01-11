import { Router } from 'express';
import { getShipments, getOrders, exportShipmentsReport, exportOrdersReport } from '../controllers/operationsController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/shipments', authenticate, getShipments);
router.get('/orders', authenticate, getOrders);
router.get('/shipments/export/report', authenticate, exportShipmentsReport);
router.get('/orders/export/report', authenticate, exportOrdersReport);

export default router;
