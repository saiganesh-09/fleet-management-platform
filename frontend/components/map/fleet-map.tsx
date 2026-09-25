'use client';

import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDateTime, timeAgo } from '@/lib/utils';
import type { LiveLocation } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  ON_TRIP: '#6366f1',
  ASSIGNED: '#3b82f6',
  AVAILABLE: '#10b981',
  MAINTENANCE: '#f59e0b',
  INACTIVE: '#94a3b8',
};

function markerIcon(status: string) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  return L.divIcon({
    className: 'fleet-marker',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export default function FleetMap({ vehicles }: { vehicles: LiveLocation[] }) {
  const center: [number, number] = useMemo(() => {
    const withPos = vehicles.filter((v) => (v.lat ?? v.lastLatitude) != null);
    if (!withPos.length) return [17.385, 78.4867];
    const lat = withPos.reduce((s, v) => s + (v.lat ?? v.lastLatitude ?? 0), 0) / withPos.length;
    const lng = withPos.reduce((s, v) => s + (v.lng ?? v.lastLongitude ?? 0), 0) / withPos.length;
    return [lat, lng];
  }, [vehicles]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const tileUrl = mapboxToken
    ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  const attribution = mapboxToken
    ? '&copy; Mapbox &copy; OpenStreetMap'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%', minHeight: 500 }}>
      <TileLayer attribution={attribution} url={tileUrl} tileSize={mapboxToken ? 512 : 256} zoomOffset={mapboxToken ? -1 : 0} />
      {vehicles
        .filter((v) => (v.lat ?? v.lastLatitude) != null && (v.lng ?? v.lastLongitude) != null)
        .map((v) => {
          const lat = v.lat ?? v.lastLatitude!;
          const lng = v.lng ?? v.lastLongitude!;
          const speed = v.speed ?? v.lastSpeed ?? 0;
          const updated = v.timestamp ?? v.lastLocationAt;
          const trip = v.trips?.[0] ?? v.trip;
          const driver = v.driver ?? v.assignedDriver;
          return (
            <Marker key={v.id ?? v.vehicleId} position={[lat, lng]} icon={markerIcon(v.status)}>
              <Popup>
                <div className="min-w-44 text-xs leading-5">
                  <p className="font-semibold">{v.vehicleNumber}</p>
                  <p>Driver: {driver?.name ?? 'Unassigned'}</p>
                  <p>Speed: {Math.round(speed)} km/h</p>
                  <p>Status: {v.status.replace(/_/g, ' ')}{trip ? ` · ${trip.status.replace(/_/g, ' ')}` : ''}</p>
                  <p className="text-slate-500">Updated: {updated ? timeAgo(updated) : '—'} ({updated ? formatDateTime(updated) : ''})</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </MapContainer>
  );
}
