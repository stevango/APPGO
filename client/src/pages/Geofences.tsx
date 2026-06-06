import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronLeft, Plus, MapPin, Home, Briefcase, GraduationCap,
  Wrench, Car, Building, Circle, Trash2, Shield, Crosshair
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import L from "leaflet";
import { MapView, createDot, createCircle } from "@/components/Map";
import { AddressSearch } from "@/components/AddressSearch";

const geofenceTypes = [
  { value: "casa", icon: Home, label: "Casa" },
  { value: "trabalho", icon: Briefcase, label: "Trabalho" },
  { value: "escola", icon: GraduationCap, label: "Escola" },
  { value: "oficina", icon: Wrench, label: "Oficina" },
  { value: "garagem", icon: Car, label: "Garagem" },
  { value: "cidade", icon: Building, label: "Cidade" },
  { value: "personalizada", icon: Circle, label: "Personalizada" },
];

export default function Geofences() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("personalizada");
  const [radius, setRadius] = useState("200");
  const [selectedLat, setSelectedLat] = useState("");
  const [selectedLng, setSelectedLng] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const markerRef = useRef<L.CircleMarker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const radiusRef = useRef(radius);
  const mapRef = useRef<L.Map | null>(null);

  const { data: geofences } = trpc.geofences.list.useQuery();
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const utils = trpc.useUtils();

  // Keep the live circle in sync when the user changes the radius.
  useEffect(() => {
    radiusRef.current = radius;
    if (circleRef.current) circleRef.current.setRadius(parseInt(radius) || 200);
  }, [radius]);

  const createMutation = trpc.geofences.create.useMutation({
    onSuccess: () => {
      toast.success("Cerca criada com sucesso!");
      setShowCreate(false);
      setShowMap(false);
      setName("");
      setType("personalizada");
      setRadius("200");
      setSelectedLat("");
      setSelectedLng("");
      setSelectedAddress("");
      utils.geofences.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao criar cerca.");
    },
  });

  const deleteMutation = trpc.geofences.delete.useMutation({
    onSuccess: () => {
      toast.success("Cerca removida.");
      utils.geofences.list.invalidate();
    },
  });

  // Places the geofence center marker + circle at a point (used by both map
  // taps and address/CEP search).
  const placeAt = useCallback((lat: number, lng: number, address?: string) => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedLat(lat.toString());
    setSelectedLng(lng.toString());

    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = createDot(map, { lat, lng }, { radius: 9 });

    const radiusVal = parseInt(radiusRef.current) || 200;
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radiusVal);
    } else {
      circleRef.current = createCircle(map, { lat, lng }, radiusVal, { fillOpacity: 0.15, strokeOpacity: 1, weight: 2 });
    }

    if (address) {
      setSelectedAddress(address);
    } else {
      setSelectedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      utils.sos.reverseGeocode
        .fetch({ latitude: lat.toString(), longitude: lng.toString() })
        .then((res) => { if (res?.success && res.address) setSelectedAddress(res.address); })
        .catch(() => {});
    }
  }, [utils]);

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => placeAt(e.latlng.lat, e.latlng.lng));
  }, [placeAt]);

  // Fly to a searched address and drop the geofence center there.
  const goToAddress = useCallback((lat: number, lng: number, label: string) => {
    mapRef.current?.setView([lat, lng], 16);
    placeAt(lat, lng, label);
  }, [placeAt]);

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Informe um nome para a cerca.");
      return;
    }
    if (!selectedLat || !selectedLng) {
      toast.error("Selecione uma localização no mapa.");
      return;
    }
    if (!vehicles || vehicles.length === 0) {
      toast.error("Nenhum veículo cadastrado.");
      return;
    }
    createMutation.mutate({
      vehicleId: vehicles[0].id,
      name: name.trim(),
      type: type as any,
      latitude: selectedLat,
      longitude: selectedLng,
      radius: parseInt(radius) || 200,
      alertOnEntry: true,
      alertOnExit: true,
    });
  };

  // Map selection screen
  if (showMap) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => setShowMap(false)} className="go-btn-active" aria-label="Voltar">
            <ChevronLeft className="w-6 h-6 text-[#343C42]" />
          </button>
          <h1 className="text-base font-bold text-[#111111]">Selecione a localização</h1>
        </div>

        <div className="flex-1 relative">
          <MapView
            initialCenter={{ lat: -23.5505, lng: -46.6333 }}
            initialZoom={13}
            onMapReady={handleMapReady}
          />

          {/* Address / CEP search */}
          <div className="absolute top-4 left-4 right-4 z-[1000]">
            <AddressSearch onSelect={(lat, lng, label) => goToAddress(lat, lng, label)} />
            {!selectedLat && (
              <div className="mt-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 shadow-sm">
                <Crosshair className="w-3.5 h-3.5 text-[#243FF7]" />
                <span className="text-[12px] text-gray-600">Busque ou toque no mapa para definir o centro</span>
              </div>
            )}
          </div>

          {/* Selected location info */}
          {selectedLat && (
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-xl p-4 shadow-lg">
              <div className="flex items-start gap-2 mb-3">
                <MapPin className="w-4 h-4 text-[#243FF7] mt-0.5 shrink-0" />
                <span className="text-sm text-gray-700 line-clamp-2">{selectedAddress || "Carregando..."}</span>
              </div>
              <Button
                className="w-full h-11 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active"
                onClick={() => setShowMap(false)}
              >
                Confirmar localização
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Create form
  if (showCreate) {
    return (
      <div className="px-4 pb-4">
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-6 bg-[#F5F6FA]/90 backdrop-blur flex items-center gap-3">
          <button onClick={() => setShowCreate(false)} className="go-btn-active" aria-label="Voltar">
            <ChevronLeft className="w-6 h-6 text-[#343C42]" />
          </button>
          <h1 className="text-lg font-bold text-[#111111]">Nova Cerca</h1>
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Nome da cerca</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Minha casa"
              className="h-12 rounded-xl border-gray-200"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {geofenceTypes.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setType(gt.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors go-btn-active ${
                    type === gt.value
                      ? "border-[#243FF7] bg-[#243FF7]/5"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <gt.icon className={`w-5 h-5 ${type === gt.value ? "text-[#243FF7]" : "text-gray-400"}`} />
                  <span className={`text-[10px] font-medium ${type === gt.value ? "text-[#243FF7]" : "text-gray-500"}`}>
                    {gt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Location Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Localização</label>
            <button
              onClick={() => setShowMap(true)}
              className="w-full h-12 rounded-xl border border-gray-200 px-4 flex items-center gap-3 text-left go-btn-active"
            >
              <MapPin className={`w-5 h-5 ${selectedLat ? "text-[#243FF7]" : "text-gray-400"}`} />
              <span className={`text-sm flex-1 truncate ${selectedLat ? "text-gray-800" : "text-gray-400"}`}>
                {selectedAddress || "Selecionar no mapa"}
              </span>
              {selectedLat && (
                <div className="w-2 h-2 rounded-full bg-green-500" />
              )}
            </button>
          </div>

          {/* Radius */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Raio (metros)</label>
            <Input
              type="number"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              placeholder="200"
              className="h-12 rounded-xl border-gray-200"
            />
          </div>

          {/* Alerts */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Alertas</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Alerta ao entrar</span>
                <div className="w-4 h-4 bg-[#243FF7] rounded-sm flex items-center justify-center">
                  <span className="text-white text-[10px]">✓</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Alerta ao sair</span>
                <div className="w-4 h-4 bg-[#243FF7] rounded-sm flex items-center justify-center">
                  <span className="text-white text-[10px]">✓</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-12 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Criando..." : "Criar Cerca"}
          </Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="px-4 pb-4">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-6 bg-[#F5F6FA]/90 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="go-btn-active" aria-label="Voltar">
            <ChevronLeft className="w-6 h-6 text-[#343C42]" />
          </button>
          <h1 className="text-lg font-bold text-[#111111]">Cerca Eletrônica</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-9 h-9 bg-[#243FF7] rounded-full flex items-center justify-center go-btn-active"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Geofences List */}
      {geofences && geofences.length > 0 ? (
        <div className="space-y-3">
          {geofences.map((fence: any) => {
            const typeInfo = geofenceTypes.find((t) => t.value === fence.type) || geofenceTypes[6];
            const Icon = typeInfo.icon;
            return (
              <div key={fence.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#243FF7]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-[#111111]">{fence.name}</h3>
                    <p className="text-xs text-gray-500">Raio: {fence.radius}m</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${fence.active ? "bg-green-500" : "bg-gray-300"}`} />
                    <button
                      onClick={() => deleteMutation.mutate({ id: fence.id })}
                      className="w-8 h-8 flex items-center justify-center go-btn-active"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-[#243FF7]/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-[#243FF7]" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Nenhuma cerca criada</h3>
          <p className="text-sm text-gray-400 text-center mb-4">
            Crie cercas para receber alertas quando seu veículo entrar ou sair de uma área.
          </p>
          <Button
            className="bg-[#243FF7] text-white rounded-xl go-btn-active"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Criar primeira cerca
          </Button>
        </div>
      )}
    </div>
  );
}
