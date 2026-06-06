import { trpc } from "@/lib/trpc";
import { MapPin, Navigation, Clock, Wifi, Car, ChevronLeft, Route, ChevronUp, ChevronDown, Gauge, Compass, Battery, Satellite, Zap, Power, Activity, AlertTriangle, Layers, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import FullScreenModal from "@/components/FullScreenModal";
import L from "leaflet";
import { MapView, createAssetMarker, updateAssetMarker, createPolyline, fitToPoints, createDot } from "@/components/Map";
import { getAssetIcon, isVehicleAsset } from "@/lib/assetIcons";
import { useActiveVehicleId, setActiveVehicleId, pickActiveVehicle, dedupeVehicles } from "@/lib/activeVehicle";
import { getTrackerStatus } from "@/lib/trackerStatus";
import DistanceToVehicle from "@/components/DistanceToVehicle";
import { useDeviceCoords } from "@/lib/deviceLocation";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));

/** Compact info card shown when a map marker is tapped (no leaving the map). */
function assetPopupHtml(v: any): string {
  const isVeh = isVehicleAsset(v.iconType);
  const name = esc(`${v.brand ? v.brand + " " : ""}${v.model || "Equipamento"}`);
  const online = v.trackerStatus === "online";
  let headline = "Rastreando";
  if (isVeh) {
    if (v.blocked) headline = "Bloqueado";
    else if (v.ignition && (v.speed ?? 0) > 0) headline = `Em movimento • ${v.speed} km/h`;
    else if (v.ignition) headline = "Ligado, parado";
    else headline = "Estacionado";
  } else {
    headline = v.trackerMode === "active" ? "Rastreador ativo" : "Em repouso";
  }
  const metrics = isVeh
    ? `${v.speed ?? 0} km/h · Bateria ${Number(v.batteryMain ?? 0).toFixed(1)}V`
    : `Bateria ${v.batteryLevel ?? 100}% · ${v.gpsSatellites ?? 0} sat`;
  const addr = esc(v.lastAddress || "Localização não disponível");
  return `<div style="min-width:190px;font-family:inherit">
    <div style="display:flex;align-items:center;gap:6px;">
      <span style="font-weight:700;font-size:14px;color:#111">${name}</span>
      <span style="font-size:10px;font-weight:600;color:${online ? "#16a34a" : "#ef4444"}">● ${online ? "Online" : "Offline"}</span>
    </div>
    <div style="font-size:12px;color:#243FF7;font-weight:600;margin-top:3px">${esc(headline)}</div>
    <div style="font-size:12px;color:#444;margin-top:6px">${esc(metrics)}</div>
    <div style="font-size:11px;color:#999;margin-top:4px">${addr}</div>
  </div>`;
}

export default function Tracking() {
  const [, setLocation] = useLocation();
  const [showRoute, setShowRoute] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const { data: vehiclesRaw } = trpc.vehicles.list.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const vehicles = useMemo(() => dedupeVehicles(vehiclesRaw), [vehiclesRaw]);
  const activeVehicleId = useActiveVehicleId();
  const vehicle = pickActiveVehicle(vehicles, activeVehicleId);

  const { data: routePoints } = trpc.routeHistory.list.useQuery(
    { vehicleId: vehicle?.id || 0, limit: 50 },
    { enabled: !!vehicle?.id && showRoute }
  );

  const mapRef = useRef<L.Map | null>(null);
  const meMarkerRef = useRef<L.CircleMarker | null>(null);
  const deviceCoords = useDeviceCoords();
  const markerRef = useRef<L.Marker | null>(null);
  const markerVehicleId = useRef<number | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const allMarkersRef = useRef<L.Marker[]>([]);
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const [mapReady, setMapReady] = useState(false);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  // Create the marker once the map AND asset position are both available, then
  // keep it moving as the position updates. When the active asset changes, the
  // marker is recreated with the new icon and the map recenters on it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    // In "show all" mode the multi-marker effect owns the map.
    if (showAll) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; markerVehicleId.current = null; }
      return;
    }
    // Trocou de equipamento → remove o marcador antigo (mesmo que o novo não
    // tenha posição), senão o mapa fica mostrando o veículo anterior.
    if (markerRef.current && markerVehicleId.current !== vehicle?.id) {
      markerRef.current.remove();
      markerRef.current = null;
      markerVehicleId.current = null;
    }
    const lat = vehicle?.lastLatitude != null ? parseFloat(String(vehicle.lastLatitude)) : NaN;
    const lng = vehicle?.lastLongitude != null ? parseFloat(String(vehicle.lastLongitude)) : NaN;
    if (!vehicle || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      // Sem posição: garante que não fica marcador velho na tela.
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; markerVehicleId.current = null; }
      return;
    }

    if (!markerRef.current) {
      map.setView([lat, lng], 16);
      markerRef.current = createAssetMarker(map, { lat, lng }, getAssetIcon(vehicle.iconType), {
        title: `${vehicle.brand} ${vehicle.model}`,
      });
      markerRef.current.bindPopup(assetPopupHtml(vehicle), { offset: [0, -42], closeButton: true });
      markerVehicleId.current = vehicle.id;
    } else {
      updateAssetMarker(markerRef.current, { lat, lng });
      markerRef.current.setPopupContent(assetPopupHtml(vehicle));
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
    }
  }, [mapReady, showAll, vehicle?.id, vehicle?.lastLatitude, vehicle?.lastLongitude, vehicle?.iconType, vehicle?.brand, vehicle?.model]);

  // "Ver todos" — render every asset on the map at once. Tap a marker to focus.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const clearAll = () => {
      allMarkersRef.current.forEach((m) => m.remove());
      allMarkersRef.current = [];
    };
    if (!showAll) {
      clearAll();
      return;
    }
    clearAll();
    const pts: { lat: number; lng: number }[] = [];
    (vehiclesRef.current ?? []).forEach((v) => {
      if (!v.lastLatitude || !v.lastLongitude) return;
      const lat = parseFloat(String(v.lastLatitude));
      const lng = parseFloat(String(v.lastLongitude));
      const m = createAssetMarker(map, { lat, lng }, getAssetIcon(v.iconType), {
        title: v.model || v.brand || "Equipamento",
      });
      m.bindPopup(assetPopupHtml(v), { offset: [0, -42], closeButton: true });
      allMarkersRef.current.push(m);
      pts.push({ lat, lng });
    });
    if (pts.length > 0) fitToPoints(map, pts, 60);
    return () => clearAll();
  }, [showAll, mapReady]);

  // Draw route when routePoints change
  useEffect(() => {
    if (showAll || !mapRef.current || !routePoints || routePoints.length === 0) {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      return;
    }

    const path = routePoints
      .slice()
      .reverse()
      .map((p: any) => ({
        lat: parseFloat(String(p.latitude)),
        lng: parseFloat(String(p.longitude)),
      }));

    if (polylineRef.current) {
      polylineRef.current.setLatLngs(path.map((p) => [p.lat, p.lng] as [number, number]));
    } else {
      polylineRef.current = createPolyline(mapRef.current, path, { opacity: 0.8 });
    }

    fitToPoints(mapRef.current, path, 40);
  }, [routePoints, showAll]);

  useEffect(() => {
    if (!showRoute && polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
  }, [showRoute]);

  // Marca a localização do usuário (GPS do celular) no mapa, quando disponível.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (!deviceCoords) {
      if (meMarkerRef.current) { meMarkerRef.current.remove(); meMarkerRef.current = null; }
      return;
    }
    const pos = { lat: deviceCoords.lat, lng: deviceCoords.lng };
    if (meMarkerRef.current) {
      meMarkerRef.current.setLatLng([pos.lat, pos.lng]);
    } else {
      meMarkerRef.current = createDot(map, pos, { fill: "#0ea5e9", color: "#ffffff", radius: 8 });
      meMarkerRef.current.bindPopup("Você está aqui");
    }
  }, [deviceCoords, mapReady]);

  // Demo mode: drive the simulated vehicle in real time while this screen is open.
  const utils = trpc.useUtils();
  const tickMutation = trpc.demo.tick.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      if (showRoute) utils.routeHistory.list.invalidate();
    },
  });
  useEffect(() => {
    // Only the demo car moves; pets/items stay put. Paused while viewing all.
    if (showAll || !vehicle?.isDemo || vehicle?.iconType !== "car") return;
    const id = setInterval(() => tickMutation.mutate(), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle?.isDemo, vehicle?.iconType, showRoute, showAll]);

  function getTrackerModeLabel(mode: string | null | undefined) {
    switch (mode) {
      case "active": return "Ativo";
      case "sleep": return "Modo Sleep";
      case "deep_sleep": return "Hibernação";
      case "emergency": return "Emergência";
      default: return "Ativo";
    }
  }

  function getTrackerModeColor(mode: string | null | undefined) {
    switch (mode) {
      case "active": return "text-green-500";
      case "sleep": return "text-amber-500";
      case "deep_sleep": return "text-orange-500";
      case "emergency": return "text-red-500";
      default: return "text-green-500";
    }
  }

  function getBatteryColor(voltage: number) {
    if (voltage >= 12) return "text-green-500";
    if (voltage >= 11) return "text-amber-500";
    return "text-red-500";
  }

  function getBackupBatteryColor(voltage: number) {
    if (voltage >= 3.8) return "text-green-500";
    if (voltage >= 3.5) return "text-amber-500";
    return "text-red-500";
  }

  function getSimStatusLabel(status: string | null | undefined) {
    switch (status) {
      case "active": return "Ativo";
      case "inactive": return "Inativo";
      case "no_signal": return "Sem sinal";
      default: return "Ativo";
    }
  }

  // Speed alert logic
  const currentSpeed = vehicle?.speed || 0;
  const speedLimit = vehicle?.speedLimit || 120;
  const isOverSpeed = currentSpeed > speedLimit;
  const speedPercentage = Math.min((currentSpeed / speedLimit) * 100, 150);

  function getSpeedColor(speed: number, limit: number) {
    if (speed > limit) return "text-red-500";
    if (speed > limit * 0.85) return "text-amber-500";
    return "text-[#111]";
  }

  function getTimeSince(date: Date | string | null | undefined) {
    if (!date) return "--";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Agora";
    if (diffMin < 60) return `${diffMin}min atrás`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h atrás`;
    return `${Math.floor(diffHours / 24)}d atrás`;
  }

  return (
    <div className="relative h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="go-btn-active" aria-label="Voltar">
              <ChevronLeft className="w-6 h-6 text-[#343C42]" />
            </button>
            <button
              onClick={() => vehicles && vehicles.length > 1 && setShowSwitcher(true)}
              className="text-left go-btn-active"
              disabled={!vehicles || vehicles.length <= 1}
            >
              <h1 className="text-base font-bold text-[#111111] flex items-center gap-1">
                {vehicle?.model || "Rastreamento"}
                {vehicles && vehicles.length > 1 && <ChevronDown className="w-4 h-4 text-gray-400" />}
              </h1>
              {vehicle && (() => {
                const st = getTrackerStatus(vehicle.lastSignalAt);
                return (
                  <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 ${st.text} font-sans font-semibold not-italic`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                    </span>
                    <span className="text-gray-300">•</span> {vehicle.plate}
                  </p>
                );
              })()}
            </button>
          </div>
          <div className="flex items-center gap-2">
            {vehicles && vehicles.length > 1 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all go-btn-active ${
                  showAll ? "bg-[#243FF7] text-white" : "bg-gray-100 text-[#343C42]"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Todos
              </button>
            )}
            {vehicle && !showAll && (
              <button
                onClick={() => setShowRoute(!showRoute)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all go-btn-active ${
                  showRoute
                    ? "bg-[#243FF7] text-white"
                    : "bg-gray-100 text-[#343C42]"
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                Rota
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tracker switcher — tela cheia com X (nav inferior continua visível) */}
      {showSwitcher && vehicles && (
        <FullScreenModal title="Trocar rastreador" onClose={() => setShowSwitcher(false)}>
          <div className="space-y-2">
            {vehicles.map((v) => {
              const Icon = getAssetIcon(v.iconType);
              const active = vehicle != null && v.id != null && v.id === vehicle.id;
              return (
                <button
                  key={v.id}
                  onClick={() => { setActiveVehicleId(v.id); setShowSwitcher(false); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 go-btn-active ${
                    active ? "border-[#243FF7] bg-[#243FF7]/5" : "border-gray-100 bg-white"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${active ? "bg-[#243FF7]/10" : "bg-gray-100"}`}>
                    <Icon className={`w-5 h-5 ${active ? "text-[#243FF7]" : "text-gray-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm text-[#111111] truncate">{v.brand ? v.brand + " " : ""}{v.model}</p>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const st = getTrackerStatus(v.lastSignalAt);
                        return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${st.text}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>;
                      })()}
                      <span className="text-gray-300 text-[10px]">•</span>
                      <span className="text-xs text-gray-400 font-mono">{v.plate}</span>
                    </div>
                  </div>
                  {active && <Check className="w-5 h-5 text-[#243FF7] shrink-0" />}
                </button>
              );
            })}
          </div>
        </FullScreenModal>
      )}

      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapView onMapReady={handleMapReady} className="w-full h-full" />
      </div>

      {/* Sem posição: aviso claro em vez de mostrar o mapa no centro errado */}
      {!showAll && vehicle && !(vehicle.lastLatitude != null && vehicle.lastLongitude != null
        && Number.isFinite(parseFloat(String(vehicle.lastLatitude)))) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-8 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 text-center max-w-xs pointer-events-auto">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-amber-500" />
            </div>
            <p className="font-bold text-[#111111] text-[15px]">Sem localização disponível</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
              Este equipamento ainda não enviou uma posição. Assim que o rastreador comunicar, ela aparece aqui no mapa.
            </p>
            {vehicles && vehicles.length > 1 && (
              <button
                onClick={() => setShowSwitcher(true)}
                className="mt-3 text-[13px] font-semibold text-[#243FF7] go-btn-active"
              >
                Trocar equipamento
              </button>
            )}
          </div>
        </div>
      )}

      {/* Speed Alert Banner */}
      {isOverSpeed && vehicle && (
        <div className="absolute top-16 left-4 right-4 z-30 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-gradient-to-r from-red-600 to-red-500 rounded-xl px-4 py-3 shadow-lg shadow-red-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Velocidade Excessiva!</p>
                <p className="text-white/80 text-xs">
                  {currentSpeed} km/h — Limite: {speedLimit} km/h
                </p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-lg">{currentSpeed}</p>
                <p className="text-white/70 text-[10px]">km/h</p>
              </div>
            </div>
            {/* Speed bar */}
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(speedPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Route info banner */}
      {showRoute && routePoints && (
        <div className={`absolute ${isOverSpeed ? 'top-36' : 'top-16'} left-4 right-4 z-20 bg-[#243FF7]/95 backdrop-blur-sm rounded-xl px-4 py-2.5`}>
          <div className="flex items-center gap-2 text-white">
            <Route className="w-4 h-4" />
            <span className="text-xs font-medium">
              {routePoints.length > 0
                ? `Exibindo ${routePoints.length} pontos do histórico`
                : "Nenhum histórico de rota disponível"}
            </span>
          </div>
        </div>
      )}

      {/* "Ver todos" hint */}
      {showAll && (
        <div className="absolute bottom-24 left-4 right-4 z-20">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-gray-100 flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#243FF7] shrink-0" />
            <span className="text-[13px] text-gray-600">
              Mostrando seus {vehicles?.length ?? 0} equipamentos. Toque em um marcador para ver os detalhes.
            </span>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Panel */}
      {vehicle && !showAll && (
        <div className={`absolute bottom-20 left-0 right-0 z-20 transition-all duration-300 ease-out ${panelExpanded ? "bottom-0" : ""}`}>
          <div className="mx-3 bg-white rounded-t-2xl rounded-b-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Panel handle */}
            <button
              onClick={() => setPanelExpanded(!panelExpanded)}
              className="w-full flex items-center justify-center py-2 hover:bg-gray-50 transition"
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </button>

            {/* Quick Status Bar - Always visible */}
            <div className="px-4 pb-3">
              {/* Vehicle identity */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                    <Car className="w-4.5 h-4.5 text-[#243FF7]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#111111]">{vehicle.brand} {vehicle.model}</h3>
                    <p className="text-[10px] text-gray-400">{vehicle.lastAddress || "Buscando endereço..."}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  {(() => {
                    const st = getTrackerStatus(vehicle.lastSignalAt);
                    return (
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span className={`text-[10px] font-semibold ${st.text}`}>{st.label}</span>
                      </div>
                    );
                  })()}
                  <span className={`text-[10px] ${getTrackerModeColor(vehicle.trackerMode)}`}>
                    {getTrackerModeLabel(vehicle.trackerMode)}
                  </span>
                </div>
              </div>

              {/* Distância até você (GPS do celular) */}
              <DistanceToVehicle vehicle={vehicle} stale={getTrackerStatus(vehicle.lastSignalAt).stale} className="!mt-0 mb-3" />

              {/* Quick metrics row */}
              <div className="grid grid-cols-4 gap-2">
                <MetricPill
                  icon={<Gauge className="w-3.5 h-3.5" />}
                  value={`${vehicle.speed || 0}`}
                  unit="km/h"
                  label="Velocidade"
                  valueColor={getSpeedColor(vehicle.speed || 0, vehicle.speedLimit || 120)}
                  alert={isOverSpeed}
                />
                <MetricPill
                  icon={<Battery className="w-3.5 h-3.5" />}
                  value={`${vehicle.batteryMain || "0"}`}
                  unit="V"
                  label="Bateria"
                  valueColor={getBatteryColor(parseFloat(String(vehicle.batteryMain || 0)))}
                />
                <MetricPill
                  icon={<Satellite className="w-3.5 h-3.5" />}
                  value={`${vehicle.gpsSatellites || 0}`}
                  unit="sat"
                  label="GPS"
                />
                <MetricPill
                  icon={<Power className="w-3.5 h-3.5" />}
                  value={vehicle.ignition ? "ON" : "OFF"}
                  unit=""
                  label="Ignição"
                  valueColor={vehicle.ignition ? "text-green-600" : "text-gray-500"}
                />
              </div>
            </div>

            {/* Expanded panel */}
            {panelExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
                {/* Telemetria Section */}
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Telemetria</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoCard
                      icon={<Compass className="w-4 h-4 text-[#243FF7]" />}
                      label="Direção"
                      value={`${vehicle.heading || 0}°`}
                    />
                    <InfoCard
                      icon={<Activity className="w-4 h-4 text-[#243FF7]" />}
                      label="Odômetro"
                      value={`${formatNumber(vehicle.odometer)} km`}
                    />
                    <InfoCard
                      icon={<Clock className="w-4 h-4 text-[#243FF7]" />}
                      label="Horímetro"
                      value={`${vehicle.hourmeter || "0"} h`}
                    />
                    <InfoCard
                      icon={<Gauge className="w-4 h-4 text-[#243FF7]" />}
                      label="Velocidade"
                      value={`${vehicle.speed || 0} km/h`}
                    />
                  </div>
                </div>

                {/* Energia Section */}
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Energia</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoCard
                      icon={<Battery className="w-4 h-4 text-green-500" />}
                      label="Bateria Principal"
                      value={`${vehicle.batteryMain || "0"} V`}
                      valueColor={getBatteryColor(parseFloat(String(vehicle.batteryMain || 0)))}
                    />
                    <InfoCard
                      icon={<Zap className="w-4 h-4 text-amber-500" />}
                      label="Bateria Backup"
                      value={`${vehicle.batteryBackup || "0"} V`}
                      valueColor={getBackupBatteryColor(parseFloat(String(vehicle.batteryBackup || 0)))}
                    />
                  </div>
                </div>

                {/* Conectividade Section */}
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Conectividade</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoCard
                      icon={<Satellite className="w-4 h-4 text-blue-500" />}
                      label="Satélites GPS"
                      value={`${vehicle.gpsSatellites || 0}`}
                      subtitle={getTimeSince(vehicle.lastGpsAt)}
                    />
                    <InfoCard
                      icon={<Wifi className="w-4 h-4 text-purple-500" />}
                      label="SIM / GPRS"
                      value={getSimStatusLabel(vehicle.simStatus)}
                      subtitle={getTimeSince(vehicle.lastGprsAt)}
                    />
                  </div>
                </div>

                {/* Sensores Section */}
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Sensores</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <SensorBadge
                      label="Ignição"
                      active={vehicle.ignition || false}
                    />
                    <SensorBadge
                      label="Bloqueio"
                      active={vehicle.blocked || false}
                      activeColor="bg-red-500"
                    />
                    <SensorBadge
                      label="Movimento"
                      active={(vehicle.speed || 0) > 0}
                    />
                  </div>
                </div>

                {/* Dispositivo Section */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase">Rastreador</p>
                      <p className="text-sm font-semibold text-[#111]">{vehicle.trackerModel || "ST3xx"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase">Serial</p>
                      <p className="text-xs font-mono text-gray-600">{vehicle.trackerSerial || "---"}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">Última comunicação</span>
                    <span className="text-xs font-medium text-gray-600">
                      {vehicle.lastSignalAt
                        ? new Date(vehicle.lastSignalAt).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "2-digit",
                            hour: "2-digit", minute: "2-digit", second: "2-digit"
                          })
                        : "--"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Expand toggle */}
            <button
              onClick={() => setPanelExpanded(!panelExpanded)}
              className="w-full flex items-center justify-center gap-1 py-2 text-[#243FF7] hover:bg-[#243FF7]/5 transition text-xs font-medium"
            >
              {panelExpanded ? (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Menos detalhes
                </>
              ) : (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Mais detalhes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components
function MetricPill({ icon, value, unit, label, valueColor, alert }: {
  icon: React.ReactNode;
  value: string;
  unit: string;
  label: string;
  valueColor?: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl p-2.5 text-center ${alert ? "bg-red-50 border border-red-200 animate-pulse" : "bg-gray-50"}`}>
      <div className={`flex items-center justify-center mb-1 ${alert ? "text-red-500" : "text-gray-400"}`}>{icon}</div>
      <p className={`text-sm font-bold ${valueColor || "text-[#111]"}`}>
        {value}<span className="text-[9px] font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
      <p className={`text-[9px] mt-0.5 ${alert ? "text-red-500 font-semibold" : "text-gray-400"}`}>{alert ? "EXCESSO!" : label}</p>
    </div>
  );
}

function InfoCard({ icon, label, value, subtitle, valueColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className={`text-sm font-semibold truncate ${valueColor || "text-[#111]"}`}>{value}</p>
        {subtitle && <p className="text-[9px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function SensorBadge({ label, active, activeColor }: {
  label: string;
  active: boolean;
  activeColor?: string;
}) {
  return (
    <div className={`rounded-xl p-2.5 text-center border ${active ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${active ? (activeColor || "bg-green-500") : "bg-gray-300"}`} />
      <p className="text-[10px] font-medium text-gray-600">{label}</p>
      <p className={`text-[9px] font-semibold ${active ? "text-green-600" : "text-gray-400"}`}>
        {active ? "Ativo" : "Inativo"}
      </p>
    </div>
  );
}

function formatNumber(value: any) {
  if (!value) return "0";
  const num = parseFloat(String(value));
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
