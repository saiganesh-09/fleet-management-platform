import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { emitToAll } from '../realtime';
import { locationService } from './location.service';

/**
 * Deployment-free GPS simulator.
 *
 * Vehicles that are ON_TRIP move along a straight-ish line between their
 * active trip's source and destination coordinates (with jitter). Idle
 * vehicles get a static position near a depot. Every tick we persist the
 * fix and broadcast it over Socket.IO.
 */

interface SimState {
  lat: number;
  lng: number;
  progress: number; // 0..1 along the route
}

const states = new Map<string, SimState>();
let timer: NodeJS.Timeout | null = null;

// Default demo geography: Hyderabad, India region
const DEPOT = { lat: 17.385, lng: 78.4867 };
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const jitter = (v: number, amt = 0.004) => v + rand(-amt, amt);

function initialState(vehicle: { lastLatitude: number | null; lastLongitude: number | null }): SimState {
  return {
    lat: vehicle.lastLatitude ?? jitter(DEPOT.lat, 0.05),
    lng: vehicle.lastLongitude ?? jitter(DEPOT.lng, 0.05),
    progress: 0,
  };
}

async function tick() {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: { in: ['ON_TRIP', 'ASSIGNED', 'AVAILABLE'] } },
      include: {
        assignedDriver: { select: { name: true } },
        trips: {
          where: { status: { in: ['STARTED', 'IN_TRANSIT'] } },
          select: { id: true, sourceLat: true, sourceLng: true, destinationLat: true, destinationLng: true, status: true },
          take: 1,
        },
      },
    });

    const batch: unknown[] = [];
    for (const v of vehicles) {
      const state = states.get(v.id) ?? initialState(v);
      states.set(v.id, state);

      const trip = v.trips[0];
      let speed = 0;

      if (v.status === 'ON_TRIP' && trip?.sourceLat != null && trip?.destinationLat != null) {
        // Move ~2% along the route per tick with speed noise
        state.progress = Math.min(1, state.progress + rand(0.005, 0.025));
        const t = state.progress;
        state.lat = trip.sourceLat + (trip.destinationLat - trip.sourceLat) * t + rand(-0.002, 0.002);
        state.lng = (trip.sourceLng ?? DEPOT.lng) + ((trip.destinationLng ?? DEPOT.lng) - (trip.sourceLng ?? DEPOT.lng)) * t + rand(-0.002, 0.002);
        speed = rand(35, 75);
      } else {
        // Idle drift around current position
        state.lat = jitter(state.lat, 0.0006);
        state.lng = jitter(state.lng, 0.0006);
        state.progress = 0;
        speed = 0;
      }

      await locationService.ingest(v.id, state.lat, state.lng, Math.round(speed * 10) / 10);
      batch.push({
        vehicleId: v.id,
        vehicleNumber: v.vehicleNumber,
        status: v.status,
        lat: state.lat,
        lng: state.lng,
        speed: Math.round(speed * 10) / 10,
        timestamp: new Date().toISOString(),
        driver: v.assignedDriver?.name ?? null,
        trip: trip ? { id: trip.id, status: trip.status } : null,
      });
    }

    if (batch.length) emitToAll('fleet:locations', batch);
  } catch (err) {
    console.error('[gps-simulator] tick failed', err);
  }
}

export const gpsSimulator = {
  start() {
    if (!env.gpsSimulatorEnabled || timer) return;
    timer = setInterval(tick, env.gpsSimulatorIntervalMs);
    console.log(`[gps-simulator] started (every ${env.gpsSimulatorIntervalMs}ms)`);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
  },
};
