import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? process.env.BACKEND_PORT ?? '4000', 10),
  databaseUrl: required('DATABASE_URL', 'postgresql://fleet:fleet@localhost:5432/fleetdb?schema=public'),
  jwtSecret: required('JWT_SECRET', 'dev-access-secret'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  corsOriginSuffixes: (process.env.CORS_ORIGIN_SUFFIXES ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  aiServiceUrl: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  aiInternalToken: process.env.AI_INTERNAL_TOKEN ?? 'dev-internal-token',
  gpsSimulatorEnabled: (process.env.GPS_SIMULATOR_ENABLED ?? 'true') === 'true',
  gpsSimulatorIntervalMs: parseInt(process.env.GPS_SIMULATOR_INTERVAL_MS ?? '3000', 10),
};
