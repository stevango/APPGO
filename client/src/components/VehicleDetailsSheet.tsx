import { useState } from "react";
import { X, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/lib/vehicle";
import { getVehicleImageUrl } from "@/lib/vehicleImage";

/** Folha (bottom sheet) com todos os dados do veículo + render da imagem. */
export default function VehicleDetailsSheet({ vehicle, onClose }: { vehicle: any; onClose: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  if (!vehicle) return null;
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl p-5 pb-10 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 -mx-5 -mt-5 px-5 pt-3 pb-2 bg-white/95 backdrop-blur z-20 flex items-center justify-between">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-2.5 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center go-btn-active"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {showImg && (
          <div className="relative mt-1 mb-4 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 h-36 overflow-hidden flex items-center justify-center">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-28 bg-white/60 blur-2xl rounded-full pointer-events-none" />
            <img
              src={imgUrl!}
              alt={`${vehicle.brand} ${vehicle.model}`}
              onError={() => setImgOk(false)}
              loading="lazy"
              className="relative h-[132px] w-auto max-w-[88%] object-contain pointer-events-none drop-shadow-[0_14px_18px_rgba(15,23,42,0.22)]"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4 pr-8">
          <BrandMark brand={vehicle.brand} iconType={vehicle.iconType} className="w-12 h-12 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-[#111111] leading-tight truncate">{vehicle.brand} {vehicle.model}</h3>
            <p className="text-xs text-gray-400">Dados do veículo</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2">
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

        <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
          Dados fornecidos pelo cadastro do veículo. Encontrou algo errado? Fale com a gente pelo suporte.
        </p>
        <Button onClick={onClose} className="w-full mt-4 bg-[#243FF7] hover:bg-[#1e35d6]">Fechar</Button>
      </div>
    </div>
  );
}
