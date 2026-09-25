import { prisma } from '../config/prisma';
import { documentService } from './document.service';
import { notificationService } from './notification.service';
import { daysUntil } from '../utils/generators';

/**
 * Periodic background checks that generate notifications:
 * - documents expiring soon / expired
 * - driver licenses expiring
 * - scheduled maintenance due/overdue
 * - vehicles approaching next-service odometer
 *
 * Runs on an interval; a `lastAlerted` in-memory map prevents alert spam.
 */
const alerted = new Map<string, number>();
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h

function recentlyAlerted(key: string): boolean {
  const at = alerted.get(key);
  if (at && Date.now() - at < ALERT_COOLDOWN_MS) return true;
  alerted.set(key, Date.now());
  return false;
}

export const alertService = {
  async runChecks() {
    await documentService.refreshStatuses();

    // --- Document expiry alerts ---
    const docs = await prisma.document.findMany({
      where: { expiryDate: { not: null }, status: { in: ['EXPIRING_SOON', 'EXPIRED'] } },
    });
    for (const doc of docs) {
      const days = daysUntil(doc.expiryDate!);
      const key = `doc:${doc.id}:${doc.status}`;
      if (recentlyAlerted(key)) continue;
      const label = doc.status === 'EXPIRED' ? 'has expired' : `expires in ${days} day${days === 1 ? '' : 's'}`;
      await notificationService.notifyManagers({
        title: `${doc.documentType.replace(/_/g, ' ')} ${doc.status === 'EXPIRED' ? 'expired' : 'expiring'}`,
        message: `${doc.documentType.replace(/_/g, ' ')} (${doc.documentNumber ?? doc.id}) for ${doc.entityType.toLowerCase()} ${label}`,
        type: doc.status === 'EXPIRED' ? 'ALERT' : 'WARNING',
      });
    }

    // --- Driver license expiry ---
    const drivers = await prisma.driver.findMany({
      where: { status: { not: 'INACTIVE' }, licenseExpiry: { lt: new Date(Date.now() + 30 * 86_400_000) } },
    });
    for (const d of drivers) {
      const days = daysUntil(d.licenseExpiry);
      const key = `license:${d.id}:${days < 0 ? 'expired' : 'soon'}`;
      if (recentlyAlerted(key)) continue;
      await notificationService.notifyManagers({
        title: days < 0 ? 'Driver license expired' : 'Driver license expiring',
        message: `${d.name}'s license ${days < 0 ? 'has expired' : `expires in ${days} days`}`,
        type: days < 0 ? 'ALERT' : 'WARNING',
      });
    }

    // --- Maintenance due (scheduled date passed, still not done) ---
    const overdueMaint = await prisma.maintenanceRecord.findMany({
      where: { status: 'SCHEDULED', serviceDate: { lt: new Date() } },
      include: { vehicle: { select: { vehicleNumber: true } } },
    });
    for (const m of overdueMaint) {
      const key = `maint-overdue:${m.id}`;
      if (recentlyAlerted(key)) continue;
      await notificationService.notifyManagers({
        title: 'Service overdue',
        message: `${m.vehicle.vehicleNumber}: ${m.serviceType} was due ${m.serviceDate.toDateString()}`,
        type: 'WARNING',
      });
    }

    // --- Odometer-based service due ---
    const vehicles = await prisma.vehicle.findMany({
      include: {
        maintenanceRecords: {
          where: { status: 'COMPLETED', nextServiceOdometer: { not: null } },
          orderBy: { serviceDate: 'desc' },
          take: 1,
        },
      },
    });
    for (const v of vehicles) {
      const last = v.maintenanceRecords[0];
      if (!last?.nextServiceOdometer) continue;
      const remaining = last.nextServiceOdometer - v.currentOdometer;
      if (remaining > 1500) continue;
      const key = `odo:${v.id}:${remaining <= 0 ? 'over' : 'soon'}`;
      if (recentlyAlerted(key)) continue;
      await notificationService.notifyManagers({
        title: remaining <= 0 ? 'Service overdue (odometer)' : 'Service due soon',
        message: `${v.vehicleNumber} is ${remaining <= 0 ? `${Math.abs(remaining).toFixed(0)} km past` : `${remaining.toFixed(0)} km from`} its next service`,
        type: remaining <= 0 ? 'ALERT' : 'WARNING',
      });
    }

    // --- Delayed scheduled trips (start time passed, never started) ---
    const staleTrips = await prisma.trip.findMany({
      where: { status: 'SCHEDULED', startTime: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
      include: { vehicle: { select: { vehicleNumber: true } } },
    });
    for (const t of staleTrips) {
      const key = `trip-stale:${t.id}`;
      if (recentlyAlerted(key)) continue;
      await notificationService.notifyManagers({
        title: 'Trip not started',
        message: `Trip ${t.tripNumber} (${t.vehicle.vehicleNumber}) was scheduled to start at ${t.startTime.toISOString()}`,
        type: 'WARNING',
      });
    }
  },
};
