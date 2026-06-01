import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronDown, Plus, Check, Pencil, Car, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Mapeamento de logos de marcas (SVG inline simplificado)
const BRAND_LOGOS: Record<string, string> = {
  toyota: "https://www.carlogos.org/car-logos/toyota-logo.png",
  honda: "https://www.carlogos.org/car-logos/honda-logo.png",
  ford: "https://www.carlogos.org/car-logos/ford-logo.png",
  chevrolet: "https://www.carlogos.org/car-logos/chevrolet-logo.png",
  volkswagen: "https://www.carlogos.org/car-logos/volkswagen-logo.png",
  fiat: "https://www.carlogos.org/car-logos/fiat-logo.png",
  hyundai: "https://www.carlogos.org/car-logos/hyundai-logo.png",
  jeep: "https://www.carlogos.org/car-logos/jeep-logo.png",
  bmw: "https://www.carlogos.org/car-logos/bmw-logo.png",
  mercedes: "https://www.carlogos.org/car-logos/mercedes-benz-logo.png",
  nissan: "https://www.carlogos.org/car-logos/nissan-logo.png",
  renault: "https://www.carlogos.org/car-logos/renault-logo.png",
  peugeot: "https://www.carlogos.org/car-logos/peugeot-logo.png",
  citroen: "https://www.carlogos.org/car-logos/citroen-logo.png",
  kia: "https://www.carlogos.org/car-logos/kia-logo.png",
  mitsubishi: "https://www.carlogos.org/car-logos/mitsubishi-logo.png",
  byd: "https://www.carlogos.org/car-logos/byd-logo.png",
  audi: "https://www.carlogos.org/car-logos/audi-logo.png",
  volvo: "https://www.carlogos.org/car-logos/volvo-logo.png",
  subaru: "https://www.carlogos.org/car-logos/subaru-logo.png",
  suzuki: "https://www.carlogos.org/car-logos/suzuki-logo.png",
  ram: "https://www.carlogos.org/car-logos/ram-logo.png",
  caoa: "https://www.carlogos.org/car-logos/chery-logo.png",
};

function getBrandLogo(brand: string | null | undefined): string | null {
  if (!brand) return null;
  const key = brand.toLowerCase().trim();
  return BRAND_LOGOS[key] || null;
}

function formatPlate(plate: string): string {
  // Formata placa no padrão brasileiro: ABC 1D23 ou ABC-1234
  const clean = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 7) {
    return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  }
  return clean;
}

export default function VehicleSelector() {
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Auto-select first vehicle
  const activeVehicle = vehicles?.find(v => v.id === selectedId) || vehicles?.[0];

  const handleSelect = (id: number) => {
    setSelectedId(id);
    toast.success("Veículo selecionado!");
    // Navegar de volta após seleção
    setTimeout(() => setLocation("/"), 300);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => setLocation("/")} className="go-btn-active p-1">
          <ChevronDown className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Veículos</h1>
        <button
          onClick={() => setEditMode(!editMode)}
          className="text-sm font-semibold text-[#243FF7] go-btn-active px-2 py-1 rounded-lg"
        >
          {editMode ? "Pronto" : "Editar"}
        </button>
      </div>

      {/* Vehicle List */}
      <div className="px-4 pt-4 space-y-0">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-20" />
                    <div className="h-6 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {vehicles.map((vehicle) => {
              const brandLogo = getBrandLogo(vehicle.brand);
              const isSelected = (selectedId ?? vehicles[0]?.id) === vehicle.id;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => !editMode && handleSelect(vehicle.id)}
                  className={`bg-white py-5 px-4 flex items-center gap-4 transition-all cursor-pointer go-btn-active ${
                    editMode ? "cursor-default" : ""
                  }`}
                >
                  {/* Logo/Imagem da marca */}
                  <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                    {brandLogo ? (
                      <img
                        src={brandLogo}
                        alt={vehicle.brand || ""}
                        className="w-16 h-16 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div className={`w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center ${brandLogo ? "hidden" : ""}`}>
                      <Car className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {vehicle.model || "Veículo"}
                    </p>
                    <p className="text-2xl font-mono font-bold text-[#111111] tracking-wider mt-0.5">
                      {formatPlate(vehicle.plate)}
                    </p>
                    {vehicle.color && (
                      <p className="text-xs text-gray-400 mt-0.5">{vehicle.color} {vehicle.year ? `• ${vehicle.year}` : ""}</p>
                    )}
                  </div>

                  {/* Selection indicator ou Edit */}
                  {editMode ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast("Edição de veículo em breve", { description: "Feature coming soon" });
                      }}
                      className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center go-btn-active"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                  ) : (
                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? "border-[#243FF7] bg-[#243FF7]"
                        : "border-gray-300"
                    }`}>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Car className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-base font-semibold text-[#111111] mb-1">Nenhum veículo cadastrado</p>
            <p className="text-sm text-gray-500 mb-6">Adicione seu primeiro veículo para começar</p>
          </div>
        )}
      </div>

      {/* Add Vehicle Button */}
      <div className="flex justify-center py-8">
        <button
          onClick={() => setLocation("/onboarding")}
          className="w-14 h-14 bg-[#243FF7] rounded-full flex items-center justify-center shadow-lg shadow-[#243FF7]/30 go-btn-active transition-transform hover:scale-105"
        >
          <Plus className="w-7 h-7 text-white" />
        </button>
      </div>
    </div>
  );
}
