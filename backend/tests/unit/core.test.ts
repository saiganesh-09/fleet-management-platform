import { describe, it, expect } from 'vitest';
import { computeEfficiency } from '../../src/services/fuel.service';
import { documentStatus } from '../../src/services/document.service';
import { hashPassword, verifyPassword } from '../../src/utils/password';
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from '../../src/utils/jwt';
import { ApiError } from '../../src/utils/apiError';

describe('fuel efficiency calculation', () => {
  const rec = (liters: number, odometer: number, daysBack = 0) => ({
    liters, odometer, fuelDate: new Date(Date.now() - daysBack * 86_400_000),
  });

  it('computes km/L from consecutive odometer readings', () => {
    // 400km on 40L => 10 km/L, then 600km on 50L => 12 km/L => avg 11
    const { avg, recent } = computeEfficiency([rec(40, 1000), rec(40, 1400), rec(50, 2000)]);
    expect(recent).toBeCloseTo(12);
    expect(avg).toBeCloseTo(11);
  });

  it('returns nulls when insufficient data', () => {
    expect(computeEfficiency([])).toEqual({ avg: null, recent: null });
    expect(computeEfficiency([rec(40, 1000)])).toEqual({ avg: null, recent: null });
  });

  it('ignores records without odometer', () => {
    const { avg } = computeEfficiency([
      { liters: 40, odometer: null, fuelDate: new Date() },
      rec(40, 1000), rec(40, 1500),
    ]);
    expect(avg).toBeCloseTo(12.5);
  });

  it('ignores non-positive distance segments', () => {
    const { avg } = computeEfficiency([rec(40, 2000), rec(40, 1000), rec(40, 3000)]);
    expect(avg).toBeCloseTo(25); // only the 1000→3000 segment counts (unsorted input is sorted first)
  });
});

describe('document status', () => {
  it('VALID when far in the future', () => {
    expect(documentStatus(new Date(Date.now() + 200 * 86_400_000))).toBe('VALID');
  });
  it('EXPIRING_SOON within 30 days', () => {
    expect(documentStatus(new Date(Date.now() + 10 * 86_400_000))).toBe('EXPIRING_SOON');
  });
  it('EXPIRED in the past', () => {
    expect(documentStatus(new Date(Date.now() - 86_400_000))).toBe('EXPIRED');
  });
  it('VALID when no expiry date', () => {
    expect(documentStatus(null)).toBe('VALID');
  });
});

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('Secret123!');
    expect(hash).not.toContain('Secret123!');
    expect(await verifyPassword('Secret123!', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('JWT', () => {
  it('signs and verifies access tokens', () => {
    const token = signAccessToken({ sub: 'u1', email: 'a@b.c', role: 'FLEET_MANAGER' });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('FLEET_MANAGER');
  });

  it('rejects tampered tokens', () => {
    const token = signAccessToken({ sub: 'u1', email: 'a@b.c', role: 'VIEWER' });
    expect(() => verifyAccessToken(token + 'x')).toThrow();
  });

  it('refresh tokens are opaque and hashable', () => {
    const t1 = generateRefreshToken();
    const t2 = generateRefreshToken();
    expect(t1).not.toBe(t2);
    expect(hashToken(t1)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('ApiError', () => {
  it('carries statusCode + errorCode', () => {
    const e = ApiError.conflict('Vehicle is currently under maintenance', 'VEHICLE_UNAVAILABLE');
    expect(e.statusCode).toBe(409);
    expect(e.errorCode).toBe('VEHICLE_UNAVAILABLE');
    expect(e.message).toContain('under maintenance');
  });
});
