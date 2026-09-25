import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ApiError } from '../utils/apiError';

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient permissions', 'INSUFFICIENT_ROLE'));
    }
    next();
  };
}

export const ADMIN_ONLY: Role[] = ['SUPER_ADMIN'];
export const MANAGER_AND_UP: Role[] = ['SUPER_ADMIN', 'FLEET_MANAGER'];
export const ALL_ROLES: Role[] = ['SUPER_ADMIN', 'FLEET_MANAGER', 'DRIVER', 'VIEWER'];
