import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { ApiError } from '../utils/apiError';
import { prisma } from '../config/prisma';

/** Verifies the Bearer access token and attaches req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Missing or malformed Authorization header', 'TOKEN_MISSING');
    }
    const payload = verifyAccessToken(header.slice(7));

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw ApiError.unauthorized('Account is inactive or no longer exists', 'ACCOUNT_INACTIVE');
    }
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized('Invalid or expired access token', 'TOKEN_INVALID'));
  }
}
