import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ok, created } from '../utils/apiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const meta = (req: Request) => ({ userAgent: req.headers['user-agent'], ip: req.ip });

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body, meta(req));
    created(res, result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body, meta(req));
    ok(res, result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken, meta(req));
    ok(res, result);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.body?.refreshToken);
    ok(res, { message: 'Logged out' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await authService.me(req.user!.id));
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    ok(res, { message: 'Password changed. Please log in again.' });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    ok(res, { message: 'If the email exists, a reset link has been sent', ...(result ?? {}) });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body.token, req.body.password);
    ok(res, { message: 'Password has been reset' });
  }),
};
