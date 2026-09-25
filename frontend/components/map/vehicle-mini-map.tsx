'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons broken by bundlers
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [map, points]);
  return null;
}

export default function VehicleMiniMap({ lat, lng, trail, label }: {
  lat: number; lng: number; trail?: { lat: number; lng: number }[]; label?: string;
}) {
  const path: [number, number][] = (trail ?? []).map((p) => [p.lat, p.lng] as [number, number]).reverse();
  if (!path.length) path.push([lat, lng]);

  return (
    <MapContainer center={[lat, lng]} zoom={13} style={{ height: 320, width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={icon} title={label} />
      {path.length > 1 && <Polyline positions={path} color="#3b82f6" weight={3} opacity={0.7} />}
      <FitBounds points={path} />
    </MapContainer>
  );
}
