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

import { useEffect, useRef, createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

function arrowIcon(heading: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "go-arrow-marker",
    html: `<div style="transform: rotate(${heading}deg); width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round">
        <path d="M12 2 L20 21 L12 16 L4 21 Z" />
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** A vehicle marker rendered as a rotatable navigation arrow. */
export function createArrowMarker(
  map: L.Map,
  pos: LatLngLiteral,
  heading = 0,
  opts: { color?: string; title?: string } = {},
): L.Marker {
  return L.marker([pos.lat, pos.lng], {
    icon: arrowIcon(heading, opts.color ?? BRAND),
    title: opts.title,
  }).addTo(map);
}

/** Move/rotate an existing arrow marker (used for live position updates). */
export function updateArrowMarker(
  marker: L.Marker,
  pos: LatLngLiteral,
  heading = 0,
  color: string = BRAND,
): void {
  marker.setLatLng([pos.lat, pos.lng]);
  marker.setIcon(arrowIcon(heading, color));
}

type IconLike = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function assetPinIcon(Icon: IconLike, color: string): L.DivIcon {
  const svg = renderToStaticMarkup(createElement(Icon, { size: 19, color: "#ffffff", strokeWidth: 2.2 }));
  const html = `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));">
      <div style="width:38px;height:38px;border-radius:50%;background:${color};border:3px solid #fff;display:flex;align-items:center;justify-content:center;">${svg}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #fff;margin-top:-2px;"></div>
    </div>`;
  return L.divIcon({ className: "go-asset-pin", html, iconSize: [38, 46], iconAnchor: [19, 46] });
}

/** A pin marker showing the asset's icon (car, pet, instrument, …). */
export function createAssetMarker(
  map: L.Map,
  pos: LatLngLiteral,
  Icon: IconLike,
  opts: { color?: string; title?: string } = {},
): L.Marker {
  return L.marker([pos.lat, pos.lng], {
    icon: assetPinIcon(Icon, opts.color ?? BRAND),
    title: opts.title,
  }).addTo(map);
}

/** Move an existing asset marker to a new position. */
export function updateAssetMarker(marker: L.Marker, pos: LatLngLiteral): void {
  marker.setLatLng([pos.lat, pos.lng]);
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

    onMapReady?.(map);

    // Flex / lazily-mounted containers often report a 0 size on the first paint,
    // which leaves Leaflet without tiles. Recompute the size as soon as the
    // container actually has dimensions (ResizeObserver) and after paint (rAF).
    const refresh = () => map.invalidateSize();
    requestAnimationFrame(refresh);
    const t1 = setTimeout(refresh, 200);
    const t2 = setTimeout(refresh, 600);

    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(containerRef.current);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={cn("w-full h-[500px] min-h-[240px]", className)} />;
}
