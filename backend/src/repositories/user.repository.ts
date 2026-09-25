import { Prisma, Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { PageParams } from '../utils/pagination';

const safeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  driverProfile: { select: { id: true, employeeId: true, name: true } },
} satisfies Prisma.UserSelect;

export const userRepository = {
  async findMany(params: PageParams, filters: { role?: Role; status?: UserStatus }) {
    const where: Prisma.UserWhereInput = {
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' }, skip: params.skip, take: params.limit }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: safeSelect });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data, select: safeSelect });
  },

  update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data, select: safeSelect });
  },

  delete(id: string) {
    return prisma.user.delete({ where: { id } });
  },
};
