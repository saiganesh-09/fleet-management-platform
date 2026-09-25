import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import {
  registerSchema, loginSchema, refreshSchema, forgotPasswordSchema,
  resetPasswordSchema, changePasswordSchema,
} from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validateBody(loginSchema), authController.login);
authRouter.post('/refresh', authLimiter, validateBody(refreshSchema), authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/change-password', authenticate, validateBody(changePasswordSchema), authController.changePassword);
authRouter.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), authController.resetPassword);
