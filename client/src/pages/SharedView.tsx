import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { MapPin, Clock, Gauge, Wifi, WifiOff, Car } from "lucide-react";
import L from "leaflet";
import { MapView, createDot, createCircle } from "@/components/Map";
import { useRef, useEffect } from "react";

export default function SharedView() {
  const params = useParams<{ token: string }>();
  const { data, isLoading, error } = trpc.sharing.view.useQuery(
    { token: params.token || "" },
    { refetchInterval: 15000 } // Atualiza a cada 15s
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#243FF7]/20 flex items-center justify-center animate-pulse mb-4">
            <MapPin size={24} className="text-[#243FF7]" />
          </div>
          <p className="text-white/60 text-sm">Carregando localização...</p>
        </div>
      </div>
    );
  }

  if (error || (data && 'error' in data)) {
    const errorMsg = data && 'error' in data ? data.error : "Erro ao carregar";
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <WifiOff size={28} className="text-red-400" />
          </div>
          <h2 className="text-white text-lg font-semibold mb-2">Link indisponível</h2>
          <p className="text-white/50 text-sm">{errorMsg}</p>
          <div className="mt-6 bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-white/40">
              Este link pode ter expirado ou sido revogado pelo proprietário do veículo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !('vehicle' in data)) return null;

  const { vehicle, expiresAt, label } = data;
  const timeLeft = getTimeLeft(expiresAt);
  const lat = parseFloat(vehicle.latitude || "0");
  const lng = parseFloat(vehicle.longitude || "0");
  const hasLocation = lat !== 0 && lng !== 0;
  const markerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Atualizar marcador e mapa quando dados refetcham
  useEffect(() => {
    if (mapRef.current && markerRef.current && hasLocation) {
      const position: [number, number] = [lat, lng];
      markerRef.current.setLatLng(position);
      circleRef.current?.setLatLng(position);
      mapRef.current.panTo(position);
    }
  }, [lat, lng, hasLocation]);

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white flex flex-col">
      {/* Header com branding GO */}
      <div className="bg-gradient-to-r from-[#243FF7] to-[#1a2fd4] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold">Go<span className="text-[#E2FF04]">!</span></span>
          <span className="text-xs text-white/70">Localização compartilhada</span>
        </div>
        <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
          <Clock size={12} />
          <span className="text-xs">{timeLeft}</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="flex-1 relative min-h-[50vh]">
        {hasLocation ? (
          <MapView
            onMapReady={(map) => {
              mapRef.current = map;
              map.setView([lat, lng], 15);
              markerRef.current = createDot(map, { lat, lng }, { radius: 11 });
              circleRef.current = createCircle(map, { lat, lng }, 50, {
                fillOpacity: 0.1,
                strokeOpacity: 0.3,
                weight: 1,
              });
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-white/5">
            <p className="text-white/40 text-sm">Localização não disponível</p>
          </div>
        )}
      </div>

      {/* Info panel */}
      <div className="bg-[#0a0f1c] border-t border-white/10 px-4 py-4 space-y-3">
        {label && (
          <p className="text-xs text-white/40">Compartilhado com: <span className="text-white/70">{label}</span></p>
        )}

        {/* Veículo */}
        <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
          <div className="w-10 h-10 rounded-full bg-[#243FF7]/20 flex items-center justify-center">
            <Car size={18} className="text-[#243FF7]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{vehicle.brand} {vehicle.model}</p>
            <p className="text-xs text-white/50">{vehicle.plate}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
            vehicle.trackerStatus === "online" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          }`}>
            {vehicle.trackerStatus === "online" ? <Wifi size={12} /> : <WifiOff size={12} />}
            {vehicle.trackerStatus === "online" ? "Online" : "Offline"}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={14} className="text-[#E2FF04]" />
              <span className="text-xs text-white/50">Endereço</span>
            </div>
            <p className="text-xs text-white/80 line-clamp-2">{vehicle.address || "Não disponível"}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Gauge size={14} className="text-[#E2FF04]" />
              <span className="text-xs text-white/50">Velocidade</span>
            </div>
            <p className="text-sm font-semibold">{vehicle.speed || 0} <span className="text-xs font-normal text-white/50">km/h</span></p>
          </div>
        </div>

        {/* Última atualização */}
        <div className="text-center">
          <p className="text-xs text-white/30">
            Última atualização: {vehicle.lastSignalAt ? new Date(vehicle.lastSignalAt).toLocaleString("pt-BR") : "—"}
          </p>
          <p className="text-xs text-white/20 mt-1">Atualiza automaticamente a cada 15 segundos</p>
        </div>

        {/* Branding */}
        <div className="text-center pt-2 border-t border-white/5">
          <p className="text-xs text-white/30">
            Rastreamento por <span className="text-[#243FF7] font-medium">GO Direction</span> — Tecnologia que protege.
          </p>
        </div>
      </div>
    </div>
  );
}

function getTimeLeft(expiresAt: string | Date): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}
