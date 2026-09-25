import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';
import { ok } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { computeEfficiency } from '../services/fuel.service';
import { documentStatus } from '../services/document.service';
import { daysUntil } from '../utils/generators';

/**
 * Internal, read-only data endpoints consumed ONLY by the AI service.
 * Authenticated by a shared internal token — NOT by user JWT. This keeps the
 * LLM sandboxed: it can only read pre-approved, aggregated data and can never
 * run arbitrary SQL.
 */
export function internalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers['x-internal-token'];
  if (token !== env.aiInternalToken) return next(ApiError.unauthorized('Invalid internal token', 'INTERNAL_AUTH'));
  next();
}

export const aiDataController = {
  vehicles: asyncHandler(async (_req: Request, res: Response) => {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        assignedDriver: { select: { name: true } },
        _count: { select: { trips: true, maintenanceRecords: true, fuelRecords: true } },
      },
      orderBy: { vehicleNumber: 'asc' },
    });
    ok(res, vehicles.map((v) => ({
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      registrationNumber: v.registrationNumber,
      type: v.vehicleType,
      manufacturer: v.manufacturer,
      model: v.model,
      year: v.manufacturingYear,
      fuelType: v.fuelType,
      status: v.status,
      odometer: v.currentOdometer,
      assignedDriver: v.assignedDriver?.name ?? null,
      tripCount: v._count.trips,
      maintenanceCount: v._count.maintenanceRecords,
      fuelRecordCount: v._count.fuelRecords,
      lastLocationAt: v.lastLocationAt,
    })));
  }),

  drivers: asyncHandler(async (_req: Request, res: Response) => {
    const drivers = await prisma.driver.findMany({
      include: { _count: { select: { trips: true } }, assignedVehicles: { select: { vehicleNumber: true } } },
      orderBy: { name: 'asc' },
    });
    ok(res, drivers.map((d) => ({
      id: d.id,
      name: d.name,
      employeeId: d.employeeId,
      status: d.status,
      licenseExpiry: d.licenseExpiry,
      licenseExpiresInDays: daysUntil(d.licenseExpiry),
      experienceYears: d.experienceYears,
      tripCount: d._count.trips,
      assignedVehicle: d.assignedVehicles[0]?.vehicleNumber ?? null,
    })));
  }),

  trips: asyncHandler(async (_req: Request, res: Response) => {
    const trips = await prisma.trip.findMany({
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    ok(res, trips.map((t) => ({
      id: t.id,
      tripNumber: t.tripNumber,
      vehicle: t.vehicle.vehicleNumber,
      driver: t.driver.name,
      source: t.source,
      destination: t.destination,
      status: t.status,
      startTime: t.startTime,
      expectedEndTime: t.expectedEndTime,
      actualEndTime: t.actualEndTime,
      distance: t.distance,
    })));
  }),

  maintenance: asyncHandler(async (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    const records = await prisma.maintenanceRecord.findMany({
      where: vehicleId ? { vehicleId } : {},
      include: { vehicle: { select: { vehicleNumber: true, currentOdometer: true, manufacturingYear: true } } },
      orderBy: { serviceDate: 'desc' },
      take: 300,
    });
    ok(res, records.map((r) => ({
      id: r.id,
      vehicleId: r.vehicleId,
      vehicleNumber: r.vehicle.vehicleNumber,
      vehicleOdometer: r.vehicle.currentOdometer,
      vehicleYear: r.vehicle.manufacturingYear,
      serviceType: r.serviceType,
      serviceDate: r.serviceDate,
      odometer: r.odometer,
      nextServiceOdometer: r.nextServiceOdometer,
      nextServiceDate: r.nextServiceDate,
      cost: r.cost,
      status: r.status,
      workshop: r.workshop,
    })));
  }),

  fuel: asyncHandler(async (req: Request, res: Response) => {
    const vehicleId = req.query.vehicleId as string | undefined;
    const records = await prisma.fuelRecord.findMany({
      where: vehicleId ? { vehicleId } : {},
      include: { vehicle: { select: { vehicleNumber: true } }, driver: { select: { name: true } } },
      orderBy: { fuelDate: 'asc' },
      take: 500,
    });
    const vehicles = await prisma.vehicle.findMany({ select: { id: true, vehicleNumber: true } });
    const efficiency = vehicles.map((v) => {
      const vr = records.filter((r) => r.vehicleId === v.id);
      const { avg, recent } = computeEfficiency(vr);
      return { vehicleId: v.id, vehicleNumber: v.vehicleNumber, avgEfficiency: avg, recentEfficiency: recent, records: vr.length };
    });
    ok(res, {
      records: records.map((r) => ({
        id: r.id,
        vehicle: r.vehicle.vehicleNumber,
        vehicleId: r.vehicleId,
        driver: r.driver?.name ?? null,
        date: r.fuelDate,
        fuelType: r.fuelType,
        liters: r.liters,
        pricePerLiter: r.pricePerLiter,
        totalCost: r.totalCost,
        odometer: r.odometer,
        station: r.station,
      })),
      efficiency,
    });
  }),

  documents: asyncHandler(async (_req: Request, res: Response) => {
    const docs = await prisma.document.findMany({ orderBy: { expiryDate: 'asc' } });
    ok(res, docs.map((d) => ({
      id: d.id,
      entityType: d.entityType,
      entityId: d.entityId,
      documentType: d.documentType,
      documentNumber: d.documentNumber,
      expiryDate: d.expiryDate,
      status: documentStatus(d.expiryDate),
      expiresInDays: d.expiryDate ? daysUntil(d.expiryDate) : null,
    })));
  }),
};
