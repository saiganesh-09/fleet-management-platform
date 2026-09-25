import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { apiRouter } from './routes/domain.routes';
import { aiRouter, aiDataRouter } from './routes/ai.routes';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Swagger docs — public, mounted before authenticated API routes
  const specPath = path.join(__dirname, '..', 'openapi.yaml');
  if (fs.existsSync(specPath)) {
    const spec = YAML.load(specPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/ai-data', aiDataRouter); // internal token auth, before user JWT routes
  app.use('/api/ai', aiRouter);
  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
