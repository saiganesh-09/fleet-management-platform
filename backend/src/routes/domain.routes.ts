import { Router } from 'express';
import {
  vehicleController, driverController, tripController, maintenanceController,
  fuelController, documentController, notificationController, userController,
  auditController, locationController, searchController,
} from '../controllers/domain.controller';
import { analyticsController, reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize, ADMIN_ONLY, MANAGER_AND_UP } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { createVehicleSchema, updateVehicleSchema, assignDriverSchema, reportIssueSchema } from '../validators/vehicle.validator';
import { createDriverSchema, updateDriverSchema } from '../validators/driver.validator';
import { createTripSchema, updateTripSchema } from '../validators/trip.validator';
import { createMaintenanceSchema, updateMaintenanceSchema } from '../validators/maintenance.validator';
import { createFuelSchema } from '../validators/fuel.validator';
import { createDocumentSchema, updateDocumentSchema } from '../validators/document.validator';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';

// All routes here require a valid access token
export const apiRouter = Router();
apiRouter.use(authenticate);

// ---------- Vehicles ----------
const vehicles = Router();
vehicles.get('/', vehicleController.list);
vehicles.get('/:id', vehicleController.get);
vehicles.post('/', authorize(...MANAGER_AND_UP), validateBody(createVehicleSchema), vehicleController.create);
vehicles.put('/:id', authorize(...MANAGER_AND_UP), validateBody(updateVehicleSchema), vehicleController.update);
vehicles.delete('/:id', authorize(...MANAGER_AND_UP), vehicleController.deactivate);
vehicles.post('/:id/assign-driver', authorize(...MANAGER_AND_UP), validateBody(assignDriverSchema), vehicleController.assignDriver);
vehicles.post('/:id/report-issue', authorize('DRIVER', ...MANAGER_AND_UP), validateBody(reportIssueSchema), vehicleController.reportIssue);
apiRouter.use('/vehicles', vehicles);

// ---------- Drivers ----------
const drivers = Router();
drivers.get('/', driverController.list);
drivers.get('/me/profile', driverController.myProfile); // before /:id
drivers.get('/:id', driverController.get);
drivers.post('/', authorize(...MANAGER_AND_UP), validateBody(createDriverSchema), driverController.create);
drivers.put('/:id', authorize(...MANAGER_AND_UP), validateBody(updateDriverSchema), driverController.update);
drivers.patch('/:id/status', authorize(...MANAGER_AND_UP), driverController.setStatus);
apiRouter.use('/drivers', drivers);

// ---------- Trips ----------
const trips = Router();
trips.get('/', tripController.list);
trips.get('/mine', tripController.myTrips); // before /:id
trips.get('/:id', tripController.get);
trips.post('/', authorize(...MANAGER_AND_UP), validateBody(createTripSchema), tripController.create);
trips.put('/:id', authorize(...MANAGER_AND_UP), validateBody(updateTripSchema), tripController.update);
trips.put('/:id/start', tripController.transition('STARTED'));      // manager OR assigned driver
trips.put('/:id/transit', tripController.transition('IN_TRANSIT'));
trips.put('/:id/complete', tripController.transition('COMPLETED'));
trips.put('/:id/cancel', tripController.transition('CANCELLED'));
trips.put('/:id/delay', tripController.transition('DELAYED'));
apiRouter.use('/trips', trips);

// ---------- Maintenance ----------
const maintenance = Router();
maintenance.get('/', maintenanceController.list);
maintenance.get('/dashboard', maintenanceController.dashboard); // before /:id
maintenance.get('/:id', maintenanceController.get);
maintenance.post('/', authorize(...MANAGER_AND_UP), validateBody(createMaintenanceSchema), maintenanceController.create);
maintenance.put('/:id', authorize(...MANAGER_AND_UP), validateBody(updateMaintenanceSchema), maintenanceController.update);
apiRouter.use('/maintenance', maintenance);

// ---------- Fuel ----------
const fuel = Router();
fuel.get('/', fuelController.list);
fuel.get('/efficiency', fuelController.efficiency); // before /:id
fuel.get('/:id', fuelController.get);
fuel.post('/', authorize('SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER'), validateBody(createFuelSchema), fuelController.create);
fuel.delete('/:id', authorize(...MANAGER_AND_UP), fuelController.delete);
apiRouter.use('/fuel', fuel);

// ---------- Documents ----------
const documents = Router();
documents.get('/', documentController.list);
documents.get('/:id', documentController.get);
documents.post('/', authorize(...MANAGER_AND_UP), validateBody(createDocumentSchema), documentController.create);
documents.put('/:id', authorize(...MANAGER_AND_UP), validateBody(updateDocumentSchema), documentController.update);
documents.delete('/:id', authorize(...MANAGER_AND_UP), documentController.delete);
apiRouter.use('/documents', documents);

// ---------- Notifications ----------
const notifications = Router();
notifications.get('/', notificationController.list);
notifications.patch('/read-all', notificationController.markAllRead); // before /:id
notifications.patch('/:id/read', notificationController.markRead);
apiRouter.use('/notifications', notifications);

// ---------- Users (admin) ----------
const users = Router();
users.get('/', authorize(...ADMIN_ONLY), userController.list);
users.get('/:id', authorize(...ADMIN_ONLY), userController.get);
users.post('/', authorize(...ADMIN_ONLY), validateBody(createUserSchema), userController.create);
users.put('/:id', authorize(...ADMIN_ONLY), validateBody(updateUserSchema), userController.update);
apiRouter.use('/users', users);

// ---------- Locations / live map ----------
apiRouter.get('/locations/live', locationController.live);
apiRouter.get('/locations/:vehicleId/history', locationController.history);

// ---------- Analytics & reports ----------
apiRouter.get('/analytics/dashboard', analyticsController.dashboard);
apiRouter.get('/analytics/charts', analyticsController.charts);
apiRouter.get('/analytics/fuel', analyticsController.fuel);
apiRouter.get('/reports/fleet', reportController.fleet);
apiRouter.get('/reports/fuel', reportController.fuel);
apiRouter.get('/reports/maintenance', reportController.maintenance);
apiRouter.get('/reports/trips', reportController.trips);

// ---------- Audit logs (admin) ----------
apiRouter.get('/audit-logs', authorize(...ADMIN_ONLY), auditController.list);

// ---------- Global search ----------
apiRouter.get('/search', searchController.global);
