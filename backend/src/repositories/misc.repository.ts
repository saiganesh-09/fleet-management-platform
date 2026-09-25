import { DocumentEntityType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

// ---------- Documents ----------

export const documentRepository = {
  async findMany(
    params: PageParams,
    filters: { entityType?: DocumentEntityType; entityId?: string; status?: string; expiringInDays?: number },
  ) {
    const where: Prisma.DocumentWhereInput = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.expiringInDays
        ? { expiryDate: { lte: new Date(Date.now() + filters.expiringInDays * 86_400_000) } }
        : {}),
      ...(params.search
        ? {
            OR: [
              { documentNumber: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.document.findMany({ where, orderBy: { expiryDate: 'asc' }, skip: params.skip, take: params.limit }),
      prisma.document.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.document.findUnique({ where: { id } });
  },

  create(data: Prisma.DocumentCreateInput) {
    return prisma.document.create({ data });
  },

  update(id: string, data: Prisma.DocumentUpdateInput) {
    return prisma.document.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.document.delete({ where: { id } });
  },
};

// ---------- Notifications ----------

export const notificationRepository = {
  async findForUser(userId: string, params: PageParams, unreadOnly?: boolean) {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [items, total, unread] = await prisma.$transaction([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return { items, total, unread };
  },

  create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({ data });
  },

  createMany(data: Prisma.NotificationCreateManyInput[]) {
    return prisma.notification.createMany({ data });
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },
};

// ---------- Audit ----------

export const auditRepository = {
  async findMany(params: PageParams, filters: { entity?: string; userId?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        skip: params.skip,
        take: params.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};

// ---------- GPS ----------

export const locationRepository = {
  create(data: Prisma.GpsLocationCreateInput) {
    return prisma.gpsLocation.create({ data });
  },

  latestForVehicles() {
    return prisma.vehicle.findMany({
      where: { lastLatitude: { not: null }, status: { in: ['ON_TRIP', 'ASSIGNED', 'AVAILABLE'] } },
      select: {
        id: true,
        vehicleNumber: true,
        status: true,
        lastLatitude: true,
        lastLongitude: true,
        lastSpeed: true,
        lastLocationAt: true,
        assignedDriver: { select: { id: true, name: true } },
        trips: {
          where: { status: { in: ['STARTED', 'IN_TRANSIT'] } },
          select: { id: true, tripNumber: true, status: true, destination: true },
          take: 1,
        },
      },
    });
  },

  historyForVehicle(vehicleId: string, limit = 100) {
    return prisma.gpsLocation.findMany({
      where: { vehicleId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  },
};
