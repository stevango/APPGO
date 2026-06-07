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

// Tipos de mapa (todos gratuitos, sem chave de API).
type BaseMap = { id: string; label: string; url: string; attribution: string; maxZoom?: number; subdomains?: string };
const BASEMAPS: BaseMap[] = [
  { id: "padrao", label: "Padrão", url: OSM_TILES, attribution: OSM_ATTRIB, maxZoom: 19 },
  { id: "satelite", label: "Satélite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles &copy; Esri", maxZoom: 19 },
  { id: "claro", label: "Claro", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 20, subdomains: "abcd" },
  { id: "escuro", label: "Escuro", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 20, subdomains: "abcd" },
];
const MAP_TYPE_KEY = "go-map-type";

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

    const makeLayer = (b: BaseMap) =>
      L.tileLayer(b.url, { maxZoom: b.maxZoom ?? 19, attribution: b.attribution, subdomains: b.subdomains ?? "abc" });

    let savedId = "padrao";
    try { savedId = localStorage.getItem(MAP_TYPE_KEY) || "padrao"; } catch { /* ignore */ }
    let current = BASEMAPS.find((b) => b.id === savedId) ?? BASEMAPS[0];
    let layer = makeLayer(current).addTo(map);

    // Seletor de tipo de mapa: botão de camadas que abre um menu limpo (com fechar).
    const SwitcherControl = L.Control.extend({
      options: { position: "topright" as L.ControlPosition },
      onAdd: function () {
        const root = L.DomUtil.create("div");
        root.style.cssText = "margin:10px;position:relative;";

        const toggle = L.DomUtil.create("button", "", root) as HTMLButtonElement;
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Tipo de mapa");
        toggle.style.cssText = "width:40px;height:40px;border:0;border-radius:12px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;";
        toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#243FF7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';

        const panel = L.DomUtil.create("div", "", root);
        panel.style.cssText = "position:absolute;top:48px;right:0;background:#fff;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:8px;display:none;min-width:172px;";

        const head = L.DomUtil.create("div", "", panel);
        head.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:2px 6px 8px;";
        const title = L.DomUtil.create("span", "", head);
        title.textContent = "Tipo de mapa";
        title.style.cssText = "font-size:12px;font-weight:700;color:#9aa0a6;";
        const closeBtn = L.DomUtil.create("button", "", head) as HTMLButtonElement;
        closeBtn.type = "button";
        closeBtn.setAttribute("aria-label", "Fechar");
        closeBtn.style.cssText = "border:0;background:transparent;cursor:pointer;padding:2px;display:flex;";
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

        const ICONS: Record<string, string> = { padrao: "🗺️", satelite: "🛰️", claro: "☀️", escuro: "🌙" };
        const items: HTMLButtonElement[] = [];
        const render = () => items.forEach((it, i) => {
          const active = BASEMAPS[i].id === current.id;
          it.style.cssText = `display:flex;align-items:center;gap:10px;width:100%;border:0;cursor:pointer;font-size:13px;font-weight:600;padding:9px 10px;border-radius:9px;text-align:left;margin-top:2px;${active ? "background:#243FF7;color:#fff;" : "background:transparent;color:#222;"}`;
        });
        const setOpen = (o: boolean) => { panel.style.display = o ? "block" : "none"; };

        BASEMAPS.forEach((b) => {
          const it = L.DomUtil.create("button", "", panel) as HTMLButtonElement;
          it.type = "button";
          it.innerHTML = `<span style="font-size:15px">${ICONS[b.id] || "🗺️"}</span><span>${b.label}</span>`;
          it.onclick = () => {
            if (b.id !== current.id) {
              map.removeLayer(layer);
              current = b;
              layer = makeLayer(b).addTo(map);
              try { localStorage.setItem(MAP_TYPE_KEY, b.id); } catch { /* ignore */ }
            }
            render();
            setOpen(false);
          };
          items.push(it);
        });
        render();

        toggle.onclick = () => setOpen(panel.style.display !== "block");
        closeBtn.onclick = () => setOpen(false);
        map.on("click", () => setOpen(false));

        L.DomEvent.disableClickPropagation(root);
        L.DomEvent.disableScrollPropagation(root);
        return root;
      },
    });
    map.addControl(new SwitcherControl());

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
