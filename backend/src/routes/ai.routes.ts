import { Router } from 'express';
import { aiController } from '../controllers/report.controller';
import { aiDataController, internalAuth } from '../controllers/aiData.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize, MANAGER_AND_UP } from '../middleware/authorize';

/** User-facing AI endpoints (authenticated). */
export const aiRouter = Router();
aiRouter.use(authenticate);
aiRouter.post('/ask', authorize(...MANAGER_AND_UP, 'VIEWER'), aiController.ask);
aiRouter.get('/predictive-maintenance/:vehicleId', aiController.maintenanceRisk);
aiRouter.get('/fuel-anomalies', aiController.fuelAnomalies);
aiRouter.get('/health', aiController.health);

/**
 * Internal read-only data endpoints for the Python AI service.
 * Mounted at /api/ai-data and guarded by a shared internal token —
 * the LLM can only access these curated, read-only views.
 */
export const aiDataRouter = Router();
aiDataRouter.use(internalAuth);
aiDataRouter.get('/vehicles', aiDataController.vehicles);
aiDataRouter.get('/drivers', aiDataController.drivers);
aiDataRouter.get('/trips', aiDataController.trips);
aiDataRouter.get('/maintenance', aiDataController.maintenance);
aiDataRouter.get('/fuel', aiDataController.fuel);
aiDataRouter.get('/documents', aiDataController.documents);
