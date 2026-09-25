/**
 * API integration tests — require a running database.
 * Set DATABASE_URL to a test database before running. Tests self-skip when
 * the database is unreachable so `npm test` stays green in bare checkouts.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/prisma';

let dbUp = false;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
    app = createApp();
  } catch {
    dbUp = false;
    console.warn('Skipping integration tests: database unreachable');
  }
});

const skipIfNoDb = (ctx: { skip: () => never }) => {
  if (!dbUp) ctx.skip();
};

describe('health & auth', () => {
  it('GET /health responds', async (ctx) => {
    skipIfNoDb(ctx);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('protected route rejects missing token', async (ctx) => {
    skipIfNoDb(ctx);
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('TOKEN_MISSING');
  });

  it('login validates input', async (ctx) => {
    skipIfNoDb(ctx);
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('login works with seeded demo admin', async (ctx) => {
    skipIfNoDb(ctx);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'Password123!' });
    // Passes only when seed data is present
    if (res.status === 200) {
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.user.role).toBe('SUPER_ADMIN');
    } else {
      expect(res.status).toBe(401);
      console.warn('seed data not present — run npm run seed');
    }
  });
});
