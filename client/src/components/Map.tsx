/**
 * OpenStreetMap map component (Leaflet) — no API key, no billing.
 *
 * USAGE:
 *   const mapRef = useRef<L.Map | null>(null);
 *   <MapView
 *     initialCenter={{ lat: -23.55, lng: -46.63 }}
 *     initialZoom={15}
 *     onMapReady={(map) => { mapRef.current = map; }}
 *   />
 *
 * Helpers below cover the common needs (markers, circles, routes, fit-bounds)
 * so pages don't depend on Leaflet internals directly.
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

const BRAND = "#243FF7";

export type LatLngLiteral = { lat: number; lng: number };

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// -----------------------------------------------------------------------------
// Map helpers
// -----------------------------------------------------------------------------

/** A circular dot marker (replaces Google's SymbolPath.CIRCLE markers). */
export function createDot(
  map: L.Map,
  pos: LatLngLiteral,
  opts: { color?: string; fill?: string; radius?: number; stroke?: number } = {},
): L.CircleMarker {
  return L.circleMarker([pos.lat, pos.lng], {
    radius: opts.radius ?? 9,
    color: opts.stroke === 0 ? undefined : opts.color ?? "#ffffff",
    weight: opts.stroke ?? 3,
    fillColor: opts.fill ?? BRAND,
    fillOpacity: 1,
  }).addTo(map);
}

/** A vehicle marker rendered as a rotatable navigation arrow. */
export function createArrowMarker(
  map: L.Map,
  pos: LatLngLiteral,
  heading = 0,
  opts: { color?: string; title?: string } = {},
): L.Marker {
  const color = opts.color ?? BRAND;
  const icon = L.divIcon({
    className: "go-arrow-marker",
    html: `<div style="transform: rotate(${heading}deg); width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round">
        <path d="M12 2 L20 21 L12 16 L4 21 Z" />
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
  return L.marker([pos.lat, pos.lng], { icon, title: opts.title }).addTo(map);
}

/** A radius circle in meters (geofence, accuracy ring). */
export function createCircle(
  map: L.Map,
  pos: LatLngLiteral,
  radiusMeters: number,
  opts: { color?: string; fillOpacity?: number; strokeOpacity?: number; weight?: number } = {},
): L.Circle {
  return L.circle([pos.lat, pos.lng], {
    radius: radiusMeters,
    color: opts.color ?? BRAND,
    opacity: opts.strokeOpacity ?? 0.3,
    weight: opts.weight ?? 1,
    fillColor: opts.color ?? BRAND,
    fillOpacity: opts.fillOpacity ?? 0.1,
  }).addTo(map);
}

/** A route polyline. */
export function createPolyline(
  map: L.Map,
  points: LatLngLiteral[],
  opts: { color?: string; weight?: number; opacity?: number } = {},
): L.Polyline {
  const latlngs = points.map(p => [p.lat, p.lng] as [number, number]);
  return L.polyline(latlngs, {
    color: opts.color ?? BRAND,
    weight: opts.weight ?? 4,
    opacity: opts.opacity ?? 0.9,
  }).addTo(map);
}

/** Fit the viewport to a set of points with pixel padding. */
export function fitToPoints(map: L.Map, points: LatLngLiteral[], paddingPx = 40): void {
  if (points.length === 0) return;
  const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
  map.fitBounds(bounds, { padding: [paddingPx, paddingPx] });
}

// -----------------------------------------------------------------------------
// MapView component
// -----------------------------------------------------------------------------

interface MapViewProps {
  className?: string;
  initialCenter?: LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: -23.5505, lng: -46.6333 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIB }).addTo(map);
    mapRef.current = map;

    // Flex/late-mounted containers can report a wrong size on first paint.
    setTimeout(() => map.invalidateSize(), 0);

    onMapReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={cn("w-full h-[500px]", className)} />;
}
