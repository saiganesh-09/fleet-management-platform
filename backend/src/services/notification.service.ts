import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { notificationRepository } from '../repositories/misc.repository';
import { PageParams } from '../utils/pagination';
import { emitToUser, emitToRole } from '../realtime';

interface NotifyInput {
  title: string;
  message: string;
  type: NotificationType;
}

export const notificationService = {
  async listForUser(userId: string, params: PageParams, unreadOnly?: boolean) {
    const { items, total, unread } = await notificationRepository.findForUser(userId, params, unreadOnly);
    return { items, total, unread, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  /** Create a notification for one user and push it over Socket.IO. */
  async notifyUser(userId: string, input: NotifyInput) {
    const notification = await notificationRepository.create({
      user: { connect: { id: userId } },
      title: input.title,
      message: input.message,
      type: input.type,
    });
    emitToUser(userId, 'notification:new', notification);
    return notification;
  },

  /** Notify all SUPER_ADMIN + FLEET_MANAGER users. */
  async notifyManagers(input: NotifyInput) {
    const users = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'FLEET_MANAGER'] }, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!users.length) return;
    await notificationRepository.createMany(
      users.map((u) => ({ userId: u.id, title: input.title, message: input.message, type: input.type })),
    );
    emitToRole('SUPER_ADMIN', 'notification:new', input);
    emitToRole('FLEET_MANAGER', 'notification:new', input);
  },

  markRead(id: string, userId: string) {
    return notificationRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationRepository.markAllRead(userId);
  },
};

export type { NotifyInput };
export type NotifyPayload = Prisma.NotificationCreateInput;
