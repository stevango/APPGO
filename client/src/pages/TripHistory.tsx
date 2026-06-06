import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { MapPin, Clock, Gauge, ArrowLeft, Route, Calendar, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MapView, createDot, createPolyline, fitToPoints } from "@/components/Map";
import { useActiveVehicleId, pickActiveVehicle } from "@/lib/activeVehicle";

export default function TripHistory() {
  const go360 = trpc.go360.status.useQuery();
  if (go360.isLoading) {
    return <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center"><Loader2 className="w-6 h-6 text-white/50 animate-spin" /></div>;
  }
  return go360.data?.enabled ? <Go360RouteHistory /> : <LocalTripHistory />;
}

const RANGES = [
  { key: "hoje", label: "Hoje", hours: 0 },
  { key: "24h", label: "24h", hours: 24 },
  { key: "7d", label: "7 dias", hours: 24 * 7 },
  { key: "30d", label: "30 dias", hours: 24 * 30 },
] as const;

function Go360RouteHistory() {
  const [, navigate] = useLocation();
  const activeId = useActiveVehicleId();
  const vehiclesQuery = trpc.vehicles.list.useQuery();
  const vehicle = pickActiveVehicle(vehiclesQuery.data, activeId);
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("hoje");

  const { desde, ate } = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.key === "hoje") {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      return { desde: d.toISOString(), ate: undefined as string | undefined };
    }
    return { desde: new Date(Date.now() - r.hours * 3600_000).toISOString(), ate: undefined };
  }, [range]);

  const histQuery = trpc.go360.historico.useQuery(
    { vehicleId: vehicle?.id || 0, desde, ate, limit: 500 },
    { enabled: !!vehicle?.id },
  );
  const points = (histQuery.data?.ok ? histQuery.data.points : []) ?? [];

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1c]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111827] border-b border-white/10 shrink-0">
        <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold text-sm">Histórico de Trajetos</h1>
          <p className="text-white/60 text-xs truncate">{vehicle ? `${vehicle.brand ?? ""} ${vehicle.model}`.trim() : ""} • {vehicle?.plate}</p>
        </div>
      </div>

      {/* Quick ranges */}
      <div className="flex gap-2 px-4 py-3 bg-[#111827] border-b border-white/10 shrink-0 overflow-x-auto no-scrollbar">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition ${range === r.key ? "bg-[#243FF7] text-white" : "bg-white/10 text-white/70"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex-1 relative">
        {histQuery.isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 text-white/50 animate-spin" /></div>
        ) : points.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <Route className="w-10 h-10 text-white/20 mb-3" />
            <p className="text-white/70 text-sm">Nenhum trajeto neste período</p>
            <p className="text-white/40 text-xs mt-1">Os trajetos aparecem conforme o rastreador envia posições.</p>
          </div>
        ) : (
          <>
            <MapView
              key={`${vehicle?.id}-${range}-${points.length}`}
              onMapReady={(map) => {
                const path = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
                createPolyline(map, path, { opacity: 1 });
                createDot(map, path[0], { fill: "#E2FF04", color: "#111", radius: 9, stroke: 2 });
                createDot(map, path[path.length - 1], { fill: "#243FF7", radius: 9, stroke: 2 });
                fitToPoints(map, path, 50);
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
              <Route className="w-5 h-5 text-[#243FF7]" />
              <span className="text-sm text-gray-700">{points.length} pontos registrados no período</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LocalTripHistory() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState<string>("");

  const vehiclesQuery = trpc.vehicles.list.useQuery(undefined, { enabled: !!user });
  const vehicle = vehiclesQuery.data?.[0];

  const tripsQuery = trpc.trips.list.useQuery(
    { vehicleId: vehicle?.id || 0 },
    { enabled: !!vehicle }
  );

  const tripDetailQuery = trpc.trips.get.useQuery(
    { id: selectedTrip || 0 },
    { enabled: !!selectedTrip }
  );

  const tripRouteQuery = trpc.trips.getRoutePoints.useQuery(
    {
      vehicleId: vehicle?.id || 0,
      startedAt: tripDetailQuery.data?.startedAt ? new Date(tripDetailQuery.data.startedAt) : new Date(),
      endedAt: tripDetailQuery.data?.endedAt ? new Date(tripDetailQuery.data.endedAt) : new Date(),
    },
    { enabled: !!tripDetailQuery.data?.startedAt && !!tripDetailQuery.data?.endedAt }
  );

  const filteredTrips = useMemo(() => {
    if (!tripsQuery.data) return [];
    if (!filterDate) return tripsQuery.data;
    return tripsQuery.data.filter(trip => {
      const tripDate = new Date(trip.startedAt).toISOString().split("T")[0];
      return tripDate === filterDate;
    });
  }, [tripsQuery.data, filterDate]);

  function formatDuration(start: string | Date, end: string | Date | null) {
    if (!end) return "Em andamento";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}min`;
  }

  function formatDate(date: string | Date) {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatTime(date: string | Date) {
    return new Date(date).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Map view for trip detail
  if (selectedTrip && tripDetailQuery.data) {
    const trip = tripDetailQuery.data;
    const routePoints = tripRouteQuery.data || [];

    return (
      <div className="flex flex-col h-screen bg-[#0a0f1c]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#111827] border-b border-white/10">
          <button onClick={() => setSelectedTrip(null)} className="p-2 rounded-full hover:bg-white/10 transition">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-semibold text-sm">Detalhes do Trajeto</h1>
            <p className="text-white/60 text-xs">{formatDate(trip.startedAt)} - {formatTime(trip.startedAt)}</p>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapView
            onMapReady={(map) => {
              if (routePoints.length > 0) {
                const path = routePoints.map(p => ({
                  lat: parseFloat(String(p.latitude)),
                  lng: parseFloat(String(p.longitude)),
                }));

                createPolyline(map, path, { opacity: 1 });

                // Start marker (yellow) and end marker (blue)
                createDot(map, path[0], { fill: "#E2FF04", color: "#111", radius: 9, stroke: 2 });
                createDot(map, path[path.length - 1], { fill: "#243FF7", radius: 9, stroke: 2 });

                fitToPoints(map, path, 50);
              } else if (trip.startLatitude && trip.startLongitude) {
                map.setView([
                  parseFloat(String(trip.startLatitude)),
                  parseFloat(String(trip.startLongitude)),
                ], 14);
              }
            }}
          />
        </div>

        {/* Trip info card */}
        <div className="bg-[#111827] border-t border-white/10 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1e293b] rounded-xl p-3 text-center">
              <Route className="w-5 h-5 text-[#243FF7] mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{trip.distanceKm ? `${trip.distanceKm} km` : "--"}</p>
              <p className="text-white/50 text-[10px]">Distância</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-[#E2FF04] mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{formatDuration(trip.startedAt, trip.endedAt)}</p>
              <p className="text-white/50 text-[10px]">Duração</p>
            </div>
            <div className="bg-[#1e293b] rounded-xl p-3 text-center">
              <Gauge className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm">{trip.maxSpeed || "--"} km/h</p>
              <p className="text-white/50 text-[10px]">Vel. Máx</p>
            </div>
          </div>

          <div className="bg-[#1e293b] rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-[#E2FF04] mt-1 shrink-0" />
              <div>
                <p className="text-white/50 text-[10px]">Partida - {formatTime(trip.startedAt)}</p>
                <p className="text-white text-xs">{trip.startAddress || "Endereço não disponível"}</p>
              </div>
            </div>
            <div className="ml-1.5 border-l border-dashed border-white/20 h-4" />
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-[#243FF7] mt-1 shrink-0" />
              <div>
                <p className="text-white/50 text-[10px]">Chegada - {trip.endedAt ? formatTime(trip.endedAt) : "--"}</p>
                <p className="text-white text-xs">{trip.endAddress || "Endereço não disponível"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Trip list view
  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f1c]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111827] border-b border-white/10">
        <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/10 transition">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-semibold">Histórico de Trajetos</h1>
          <p className="text-white/60 text-xs">{vehicle?.plate || "Carregando..."}</p>
        </div>
        <Route className="w-5 h-5 text-[#243FF7]" />
      </div>

      {/* Date filter */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 bg-[#1e293b] rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-white/50" />
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="flex-1 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
            placeholder="Filtrar por data"
          />
          {filterDate && (
            <button onClick={() => setFilterDate("")} className="text-[#E2FF04] text-xs font-medium">
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Trip list */}
      <div className="flex-1 px-4 pb-24 space-y-3">
        {!vehicle ? (
          <div className="text-center py-12">
            <Route className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">Nenhum veículo cadastrado</p>
          </div>
        ) : tripsQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#1e293b] rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                <div className="h-3 bg-white/10 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : tripsQuery.isError ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-400/60 mx-auto mb-3" />
            <p className="text-white/70 text-sm font-medium">Erro ao carregar os trajetos</p>
            <p className="text-white/40 text-xs mt-1 mb-4">Verifique sua conexão e tente novamente.</p>
            <button
              onClick={() => tripsQuery.refetch()}
              disabled={tripsQuery.isRefetching}
              className="inline-flex items-center gap-2 rounded-xl bg-[#243FF7] text-white font-semibold px-5 py-2.5 active:scale-95 disabled:opacity-60"
            >
              {tripsQuery.isRefetching ? "Tentando..." : "Tentar novamente"}
            </button>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="text-center py-12">
            <Route className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/50 text-sm">
              {filterDate ? "Nenhum trajeto nesta data" : "Nenhum trajeto registrado"}
            </p>
            <p className="text-white/30 text-xs mt-1">
              Os trajetos serão registrados automaticamente
            </p>
          </div>
        ) : (
          filteredTrips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => setSelectedTrip(trip.id)}
              className="w-full bg-[#1e293b] rounded-xl p-4 text-left hover:bg-[#263044] transition active:scale-[0.98]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/60 text-xs">
                  {formatDate(trip.startedAt)} • {formatTime(trip.startedAt)}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>

              <div className="flex items-start gap-3 mb-3">
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E2FF04]" />
                  <div className="w-px h-6 bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#243FF7]" />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-white text-xs truncate">{trip.startAddress || "Ponto de partida"}</p>
                  <p className="text-white text-xs truncate">{trip.endAddress || "Ponto de chegada"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-white/50 text-[11px]">
                <span className="flex items-center gap-1">
                  <Route className="w-3 h-3" />
                  {trip.distanceKm ? `${trip.distanceKm} km` : "--"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDuration(trip.startedAt, trip.endedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3" />
                  {trip.maxSpeed ? `${trip.maxSpeed} km/h` : "--"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
