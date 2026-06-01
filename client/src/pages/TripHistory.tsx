import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { MapPin, Clock, Gauge, ArrowLeft, Route, Calendar, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { MapView } from "@/components/Map";

export default function TripHistory() {
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

                new google.maps.Polyline({
                  path,
                  geodesic: true,
                  strokeColor: "#243FF7",
                  strokeOpacity: 1.0,
                  strokeWeight: 4,
                  map,
                });

                // Start marker
                new google.maps.Marker({
                  position: path[0],
                  map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#E2FF04",
                    fillOpacity: 1,
                    strokeColor: "#111",
                    strokeWeight: 2,
                  },
                  title: "Início",
                });

                // End marker
                new google.maps.Marker({
                  position: path[path.length - 1],
                  map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 10,
                    fillColor: "#243FF7",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 2,
                  },
                  title: "Fim",
                });

                const bounds = new google.maps.LatLngBounds();
                path.forEach(p => bounds.extend(p));
                map.fitBounds(bounds, 50);
              } else if (trip.startLatitude && trip.startLongitude) {
                map.setCenter({
                  lat: parseFloat(String(trip.startLatitude)),
                  lng: parseFloat(String(trip.startLongitude)),
                });
                map.setZoom(14);
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
