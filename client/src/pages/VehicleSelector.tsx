import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronDown, Plus, Check, Pencil, Car, ChevronLeft, Info
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark, LicensePlate, AssetTag } from "@/lib/vehicle";
import VehicleDetailsSheet from "@/components/VehicleDetailsSheet";
import { ASSET_ICONS, ASSET_GROUPS, isVehicleAsset } from "@/lib/assetIcons";
import { useActiveVehicleId, setActiveVehicleId } from "@/lib/activeVehicle";

export default function VehicleSelector() {
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery();
  const utils = trpc.useUtils();
  const [editMode, setEditMode] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState<number | null>(null);
  const [detailsFor, setDetailsFor] = useState<number | null>(null);
  const activeId = useActiveVehicleId();

  const setIconType = trpc.vehicles.setIconType.useMutation({
    onSuccess: () => {
      utils.vehicles.list.invalidate();
      setIconPickerFor(null);
      toast.success("Ícone atualizado!");
    },
    onError: () => toast.error("Não foi possível atualizar o ícone."),
  });

  const handleSelect = (id: number) => {
    setActiveVehicleId(id);
    toast.success("Equipamento selecionado!");
    setTimeout(() => setLocation("/"), 300);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => setLocation("/")} className="go-btn-active p-1">
          <ChevronDown className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Equipamentos</h1>
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
              const isSelected = (activeId ?? vehicles[0]?.id) === vehicle.id;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => !editMode && handleSelect(vehicle.id)}
                  className={`bg-white py-5 px-4 flex items-center gap-4 transition-all cursor-pointer go-btn-active ${
                    editMode ? "cursor-default" : ""
                  }`}
                >
                  {/* Logo/Imagem da marca */}
                  <BrandMark brand={vehicle.brand} iconType={vehicle.iconType} className="w-20 h-20 flex-shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      {vehicle.model || "Equipamento"}
                    </p>
                    <div className="mt-1.5">
                      {isVehicleAsset(vehicle.iconType) ? (
                        <LicensePlate plate={vehicle.plate} size="md" />
                      ) : (
                        <AssetTag label={vehicle.plate} size="md" />
                      )}
                    </div>
                    {vehicle.color && (
                      <p className="text-xs text-gray-400 mt-1.5">{vehicle.color} {vehicle.year ? `• ${vehicle.year}` : ""}</p>
                    )}
                    {isVehicleAsset(vehicle.iconType) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDetailsFor(vehicle.id); }}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#243FF7] bg-[#243FF7]/8 rounded-full px-2.5 py-1 go-btn-active"
                      >
                        <Info className="w-3 h-3" /> Ver todos os dados
                      </button>
                    )}
                  </div>

                  {/* Selection indicator ou Edit */}
                  {editMode ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIconPickerFor(vehicle.id);
                      }}
                      className="flex items-center gap-1.5 h-10 px-3 rounded-full bg-gray-100 go-btn-active"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs font-medium text-gray-600">Ícone</span>
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
            <p className="text-base font-semibold text-[#111111] mb-1">Nenhum equipamento cadastrado</p>
            <p className="text-sm text-gray-500 mb-6">Adicione seu primeiro equipamento para começar</p>
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

      {/* Icon picker sheet */}
      {iconPickerFor !== null && (() => {
        const current = vehicles?.find(v => v.id === iconPickerFor);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIconPickerFor(null)} />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-bold text-[#111111] mb-1">Escolha o ícone</h3>
              <p className="text-xs text-gray-500 mb-5">Selecione o que melhor representa seu bem.</p>

              {ASSET_GROUPS.map((group) => (
                <div key={group} className="mb-5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{group}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {ASSET_ICONS.filter(a => a.group === group).map(({ key, label, Icon }) => {
                      const active = (current?.iconType ?? "car") === key;
                      return (
                        <button
                          key={key}
                          disabled={setIconType.isPending}
                          onClick={() => setIconType.mutate({ vehicleId: iconPickerFor, iconType: key })}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all go-btn-active ${
                            active ? "border-[#243FF7] bg-[#243FF7]/5" : "border-gray-100 bg-gray-50"
                          }`}
                        >
                          <Icon className={`w-6 h-6 ${active ? "text-[#243FF7]" : "text-gray-500"}`} />
                          <span className={`text-[10px] font-medium ${active ? "text-[#243FF7]" : "text-gray-500"}`}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Detalhes completos do veículo */}
      {detailsFor !== null && (
        <VehicleDetailsSheet
          vehicle={vehicles?.find(x => x.id === detailsFor)}
          onClose={() => setDetailsFor(null)}
        />
      )}
    </div>
  );
}
