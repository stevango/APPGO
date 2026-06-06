import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Copy, Car, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark, LicensePlate, AssetTag } from "@/lib/vehicle";
import { isVehicleAsset } from "@/lib/assetIcons";
import { getVehicleImageUrl } from "@/lib/vehicleImage";

export default function VehicleDetails() {
  const [, params] = useRoute("/vehicle/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.find((v) => v.id === id);
  const [imgOk, setImgOk] = useState(true);

  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation("/"));

  if (isLoading) {
    return (
      <div className="px-4 pt-6">
        <Skeleton className="w-40 h-6 mb-4" />
        <Skeleton className="w-full h-44 rounded-3xl mb-4" />
        <Skeleton className="w-full h-72 rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="px-4 pt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Car className="w-8 h-8 text-gray-300" />
        </div>
        <p className="font-semibold text-gray-700">Veículo não encontrado</p>
        <button onClick={() => setLocation("/")} className="mt-4 text-[#243FF7] font-semibold go-btn-active">Voltar ao início</button>
      </div>
    );
  }

  const imgUrl = getVehicleImageUrl(vehicle);
  const showImg = !!imgUrl && imgOk;

  const rows: Array<{ label: string; value: any; copy?: boolean }> = [
    { label: "Marca", value: vehicle.brand },
    { label: "Modelo", value: vehicle.model },
    { label: "Placa", value: vehicle.plate },
    { label: "Cor", value: vehicle.color },
    { label: "Ano de fabricação", value: vehicle.anoFabricacao },
    { label: "Ano do modelo", value: vehicle.anoModelo ?? vehicle.year },
    { label: "Chassi", value: vehicle.chassi, copy: true },
    { label: "Renavam", value: vehicle.renavam, copy: true },
    { label: "Combustível", value: vehicle.fuel },
    { label: "Município/UF", value: vehicle.cityState },
    { label: "Rastreador", value: vehicle.trackerModel },
    { label: "Série / IMEI", value: vehicle.trackerSerial, copy: true },
  ].filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

  return (
    <div className="px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={goBack} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Detalhes do veículo</h1>
      </div>

      {/* Hero */}
      {showImg ? (
        <div className="relative mb-4 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-200 h-48 overflow-hidden flex items-center justify-center">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 bg-white/60 blur-2xl rounded-full pointer-events-none" />
          <img
            src={imgUrl!}
            alt={`${vehicle.brand} ${vehicle.model}`}
            onError={() => setImgOk(false)}
            loading="lazy"
            className="relative h-[180px] w-auto max-w-[92%] object-contain pointer-events-none drop-shadow-[0_18px_22px_rgba(15,23,42,0.25)]"
          />
        </div>
      ) : (
        <div className="mb-4 flex justify-center">
          <BrandMark brand={vehicle.brand} iconType={vehicle.iconType} className="w-24 h-24" />
        </div>
      )}

      {/* Título + placa (placa em linha própria para não quebrar) */}
      <div className="mb-4">
        <h2 className="text-[17px] font-extrabold text-[#0f172a] leading-tight">{vehicle.brand} {vehicle.model}</h2>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">Ficha completa</p>
        {isVehicleAsset(vehicle.iconType) ? (
          <LicensePlate plate={vehicle.plate} size="md" />
        ) : (
          <AssetTag label={vehicle.plate} size="md" />
        )}
      </div>

      {/* Ficha */}
      <div className="go-card p-4">
        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px] text-gray-500">{r.label}</span>
              <span className="text-[13px] font-semibold text-[#111111] text-right flex items-center gap-1.5 min-w-0">
                <span className="truncate">{String(r.value)}</span>
                {r.copy && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(String(r.value)); toast.success("Copiado!"); }}
                    className="go-btn-active text-gray-400 shrink-0"
                    aria-label={`Copiar ${r.label}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Localização atalho */}
      <button
        onClick={() => setLocation("/tracking")}
        className="mt-3 w-full go-card p-4 flex items-center gap-3 text-left go-btn-active"
      >
        <div className="w-10 h-10 rounded-xl bg-[#243FF7]/8 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-[#243FF7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#111111]">Ver no mapa</p>
          <p className="text-[11px] text-gray-400 truncate">{vehicle.lastAddress || "Acompanhe a localização"}</p>
        </div>
        <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
      </button>

      {/* Ficha técnica (chega pela GO360) */}
      <button
        onClick={() => toast("Ficha técnica chegando em breve, direto da GO360. 🚗")}
        className="mt-3 w-full go-card p-4 flex items-center gap-3 text-left go-btn-active"
      >
        <div className="w-10 h-10 rounded-xl bg-[#243FF7]/8 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-[#243FF7]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-[#111111]">Ficha técnica do veículo</p>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">EM BREVE</span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">Motor, potência, consumo e mais — via GO360</p>
        </div>
        <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
      </button>

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed px-1">
        Dados fornecidos pelo cadastro do veículo. Encontrou algo errado? Fale com a gente pelo suporte.
      </p>
    </div>
  );
}
