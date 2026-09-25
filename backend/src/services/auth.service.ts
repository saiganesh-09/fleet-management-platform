import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { userRepository } from '../repositories/user.repository';
import { ApiError } from '../utils/apiError';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  generateRefreshToken,
  hashToken,
  refreshTokenTtlMs,
  signAccessToken,
} from '../utils/jwt';
import { audit } from '../utils/audit';
import { notificationService } from './notification.service';
import { Role } from '@prisma/client';

const publicUser = {
  id: true, name: true, email: true, role: true, phone: true, status: true, createdAt: true,
  driverProfile: { select: { id: true, employeeId: true } },
} as const;

async function issueSession(userId: string, email: string, role: Role, meta: { userAgent?: string; ip?: string }) {
  const accessToken = signAccessToken({ sub: userId, email, role });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      userAgent: meta.userAgent,
      ip: meta.ip,
    },
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: { name: string; email: string; password: string; phone?: string; role?: Role }, meta: { userAgent?: string; ip?: string }) {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw ApiError.conflict('Email is already registered', 'EMAIL_TAKEN');

    // Only allow privileged roles to be self-assigned when no users exist yet
    // (bootstrap) — otherwise privileged roles must be granted by an admin.
    const userCount = await prisma.user.count();
    const role: Role = userCount === 0 ? (input.role ?? 'SUPER_ADMIN') : 'VIEWER';

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        role,
        passwordHash: await hashPassword(input.password),
      },
      select: publicUser,
    });
    await audit({ userId: user.id, action: 'USER_REGISTERED', entity: 'User', entityId: user.id, newValue: { email: user.email, role } });
    await notificationService.notifyUser(user.id, {
      title: 'Welcome to FleetOps',
      message: `Hi ${user.name.split(' ')[0]} — your account is ready with the ${role.replace(/_/g, ' ')} role. Explore the dashboard, live map and reports.`,
      type: 'SUCCESS',
    });
    const tokens = await issueSession(user.id, user.email, user.role, meta);
    return { user, ...tokens };
  },

  async login(input: { email: string; password: string }, meta: { userAgent?: string; ip?: string }) {
    const user = await userRepository.findByEmail(input.email);
    if (!user) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
    if (user.status !== 'ACTIVE') throw ApiError.unauthorized('Account is not active', 'ACCOUNT_INACTIVE');

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');

    const tokens = await issueSession(user.id, user.email, user.role, meta);
    const { passwordHash: _ph, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  },

  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }) {
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!stored || stored.user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Refresh token is invalid or expired', 'REFRESH_INVALID');
    }
    // Rotate: revoke old token, issue a fresh pair
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const tokens = await issueSession(stored.userId, stored.user.email, stored.user.role, meta);
    const { passwordHash: _ph, ...safeUser } = stored.user;
    return { user: safeUser, ...tokens };
  },

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser });
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User not found');
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw ApiError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
    }
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword) } });
    // Invalidate all sessions so the old password can't be used anywhere
    await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
  },

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmail(email);
    // Always succeed silently — do not leak whether an email is registered
    if (!user) return;
    const raw = crypto.randomBytes(32).toString('base64url');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    // In a real deployment this token would be emailed. For the demo, log it.
    console.log(`[password-reset] token for ${email}: ${raw}`);
    return { resetToken: raw }; // returned for demo/dev convenience
  },

  async resetPassword(token: string, newPassword: string) {
    const stored = await prisma.passwordResetToken.findFirst({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw ApiError.badRequest('Reset token is invalid or expired', 'RESET_TOKEN_INVALID');
    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash: await hashPassword(newPassword) } }),
      prisma.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.updateMany({ where: { userId: stored.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await audit({ userId: stored.userId, action: 'PASSWORD_RESET', entity: 'User', entityId: stored.userId });
  },
};
