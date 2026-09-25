import { Request, Response } from 'express';
import { VehicleStatus, VehicleType, DriverStatus, TripStatus, MaintenanceStatus, DocumentEntityType, Role, UserStatus } from '@prisma/client';
import { vehicleService } from '../services/vehicle.service';
import { driverService } from '../services/driver.service';
import { tripService } from '../services/trip.service';
import { maintenanceService } from '../services/maintenance.service';
import { fuelService } from '../services/fuel.service';
import { documentService } from '../services/document.service';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';
import { auditService } from '../services/audit.service';
import { locationService } from '../services/location.service';
import { searchService } from '../services/search.service';
import { ok, created, paginated } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePageParams } from '../utils/pagination';

// ---------- Vehicles ----------

export const vehicleController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req, ['vehicleNumber', 'createdAt', 'currentOdometer', 'manufacturingYear']);
    const result = await vehicleService.list(params, {
      status: req.query.status as VehicleStatus | undefined,
      vehicleType: req.query.vehicleType as VehicleType | undefined,
      driverId: req.query.driverId as string | undefined,
    });
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await vehicleService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await vehicleService.create(req.body, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await vehicleService.update(req.params.id, req.body, req.user!.id));
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await vehicleService.deactivate(req.params.id, req.user!.id));
  }),

  assignDriver: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await vehicleService.assignDriver(req.params.id, req.body.driverId ?? null, req.user!.id));
  }),

  reportIssue: asyncHandler(async (req: Request, res: Response) => {
    created(res, await vehicleService.reportIssue(
      req.params.id,
      { description: req.body.description, severity: req.body.severity },
      { id: req.user!.id, name: req.user!.name },
    ));
  }),
};

// ---------- Drivers ----------

export const driverController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req, ['name', 'createdAt', 'experienceYears']);
    const result = await driverService.list(params, { status: req.query.status as DriverStatus | undefined });
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await driverService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await driverService.create(req.body, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await driverService.update(req.params.id, req.body, req.user!.id));
  }),

  setStatus: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await driverService.setStatus(req.params.id, req.body.status, req.user!.id));
  }),

  /** Current driver's own profile + assigned vehicle + trips. */
  myProfile: asyncHandler(async (req: Request, res: Response) => {
    const { prisma } = await import('../config/prisma');
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.id } });
    if (!driver) return ok(res, null);
    ok(res, await driverService.get(driver.id));
  }),
};

// ---------- Trips ----------

export const tripController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req, ['startTime', 'createdAt', 'distance']);
    const result = await tripService.list(params, {
      status: req.query.status as TripStatus | undefined,
      vehicleId: req.query.vehicleId as string | undefined,
      driverId: req.query.driverId as string | undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    paginated(res, result);
  }),

  myTrips: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req);
    const result = await tripService.listForDriverUser(req.user!.id, params);
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await tripService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await tripService.create(req.body, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await tripService.update(req.params.id, req.body, req.user!.id));
  }),

  transition: (target: 'STARTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'DELAYED') =>
    asyncHandler(async (req: Request, res: Response) => {
      ok(res, await tripService.transition(req.params.id, target, req.user!, req.body?.odometer));
    }),
};

// ---------- Maintenance ----------

export const maintenanceController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req);
    const result = await maintenanceService.list(params, {
      vehicleId: req.query.vehicleId as string | undefined,
      status: req.query.status as MaintenanceStatus | undefined,
    });
    paginated(res, result);
  }),

  dashboard: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await maintenanceService.dashboard());
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await maintenanceService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { vehicleId, ...rest } = req.body;
    created(res, await maintenanceService.create({ ...rest, vehicle: { connect: { id: vehicleId } } }, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await maintenanceService.update(req.params.id, req.body, req.user!.id));
  }),
};

// ---------- Fuel ----------

export const fuelController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req);
    const result = await fuelService.list(params, {
      vehicleId: req.query.vehicleId as string | undefined,
      driverId: req.query.driverId as string | undefined,
      from: req.query.from ? new Date(String(req.query.from)) : undefined,
      to: req.query.to ? new Date(String(req.query.to)) : undefined,
    });
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await fuelService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await fuelService.create(req.body, req.user!.id));
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await fuelService.delete(req.params.id, req.user!.id);
    ok(res, { message: 'Fuel record deleted' });
  }),

  efficiency: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await fuelService.efficiencyReport());
  }),
};

// ---------- Documents ----------

export const documentController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req);
    const result = await documentService.list(params, {
      entityType: req.query.entityType as DocumentEntityType | undefined,
      entityId: req.query.entityId as string | undefined,
      status: req.query.status as string | undefined,
      expiringInDays: req.query.expiringInDays ? parseInt(String(req.query.expiringInDays), 10) : undefined,
    });
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await documentService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await documentService.create(req.body, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await documentService.update(req.params.id, req.body, req.user!.id));
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await documentService.delete(req.params.id, req.user!.id);
    ok(res, { message: 'Document deleted' });
  }),
};

// ---------- Notifications ----------

export const notificationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req);
    const result = await notificationService.listForUser(req.user!.id, params, req.query.unread === 'true');
    paginated(res, result);
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markRead(req.params.id, req.user!.id);
    ok(res, { message: 'Marked as read' });
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationService.markAllRead(req.user!.id);
    ok(res, { message: 'All notifications marked as read' });
  }),
};

// ---------- Users (admin) ----------

export const userController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req, ['name', 'email', 'createdAt']);
    const result = await userService.list(params, {
      role: req.query.role as Role | undefined,
      status: req.query.status as UserStatus | undefined,
    });
    paginated(res, result);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await userService.get(req.params.id));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    created(res, await userService.create(req.body, req.user!.id));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await userService.update(req.params.id, req.body, req.user!.id));
  }),
};

// ---------- Audit ----------

export const auditController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const params = parsePageParams(req, ['timestamp']);
    const result = await auditService.list(params, {
      entity: req.query.entity as string | undefined,
      userId: req.query.userId as string | undefined,
    });
    paginated(res, result);
  }),
};

// ---------- Locations ----------

export const locationController = {
  live: asyncHandler(async (_req: Request, res: Response) => {
    ok(res, await locationService.live());
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await locationService.history(req.params.vehicleId, parseInt(String(req.query.limit ?? '100'), 10)));
  }),
};

// ---------- Search ----------

export const searchController = {
  global: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await searchService.global(String(req.query.q ?? '')));
  }),
};
