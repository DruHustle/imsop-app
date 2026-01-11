import { Router } from 'express';
import { getTelemetry, postTelemetry } from '../controllers/telemetryController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getTelemetry);
router.post('/', postTelemetry); // Ingest might be public or use different auth

export default router;
