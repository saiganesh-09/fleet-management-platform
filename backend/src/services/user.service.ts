import { Role, UserStatus } from '@prisma/client';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { PageParams } from '../utils/pagination';
import { hashPassword } from '../utils/password';
import { audit } from '../utils/audit';
import { prisma } from '../config/prisma';

export const userService = {
  async list(params: PageParams, filters: { role?: Role; status?: UserStatus }) {
    const { items, total } = await userRepository.findMany(params, filters);
    return { items, total, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  },

  async get(id: string) {
    const user = await userRepository.findById(id);
    if (!user) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    return user;
  },

  async create(input: { name: string; email: string; password: string; phone?: string; role: Role; status?: UserStatus }, actorId: string) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('Email is already registered', 'EMAIL_TAKEN');
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      status: input.status ?? 'ACTIVE',
      passwordHash: await hashPassword(input.password),
    });
    await audit({ userId: actorId, action: 'USER_CREATED', entity: 'User', entityId: user.id, newValue: { email: user.email, role: user.role } });
    return user;
  },

  async update(id: string, input: Partial<{ name: string; email: string; phone: string; role: Role; status: UserStatus }>, actorId: string) {
    const existing = await userRepository.findById(id);
    if (!existing) throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
    if (id === actorId && input.role && input.role !== existing.role) {
      throw ApiError.badRequest('You cannot change your own role', 'SELF_ROLE_CHANGE');
    }
    if (id === actorId && input.status && input.status !== 'ACTIVE') {
      throw ApiError.badRequest('You cannot deactivate your own account', 'SELF_DEACTIVATE');
    }
    const user = await userRepository.update(id, input);
    if (input.status && input.status !== 'ACTIVE') {
      await prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await audit({ userId: actorId, action: 'USER_UPDATED', entity: 'User', entityId: id, oldValue: existing, newValue: input });
    return user;
  },
};
