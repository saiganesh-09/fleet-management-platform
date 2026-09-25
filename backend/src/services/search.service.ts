import { prisma } from '../config/prisma';

/** Global search across vehicles, drivers, trips and documents. */
export const searchService = {
  async global(q: string) {
    if (!q || q.length < 2) return { vehicles: [], drivers: [], trips: [], documents: [] };
    const contains = { contains: q, mode: 'insensitive' as const };
    const [vehicles, drivers, trips, documents] = await prisma.$transaction([
      prisma.vehicle.findMany({
        where: { OR: [{ vehicleNumber: contains }, { registrationNumber: contains }, { manufacturer: contains }, { model: contains }] },
        select: { id: true, vehicleNumber: true, registrationNumber: true, status: true, vehicleType: true },
        take: 8,
      }),
      prisma.driver.findMany({
        where: { OR: [{ name: contains }, { employeeId: contains }, { licenseNumber: contains }] },
        select: { id: true, name: true, employeeId: true, status: true },
        take: 8,
      }),
      prisma.trip.findMany({
        where: { OR: [{ tripNumber: contains }, { source: contains }, { destination: contains }] },
        select: { id: true, tripNumber: true, source: true, destination: true, status: true },
        take: 8,
      }),
      prisma.document.findMany({
        where: { OR: [{ documentNumber: contains }] },
        select: { id: true, documentType: true, documentNumber: true, entityType: true, entityId: true, status: true, expiryDate: true },
        take: 8,
      }),
    ]);
    return { vehicles, drivers, trips, documents };
  },
};
