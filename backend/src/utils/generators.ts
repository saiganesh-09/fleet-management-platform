import { prisma } from '../config/prisma';

/** Generates sequential human-readable trip numbers: TRP-0001, TRP-0002, ... */
export async function nextTripNumber(): Promise<string> {
  const count = await prisma.trip.count();
  return `TRP-${String(count + 1).padStart(4, '0')}`;
}

export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}
