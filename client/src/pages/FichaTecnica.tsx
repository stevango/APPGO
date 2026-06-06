import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText } from "lucide-react";
import { getVehicleImageUrl } from "@/lib/vehicleImage";
import { useState } from "react";

const humanize = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());

const renderValue = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.map(renderValue).join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return Object.values(v).map(renderValue).join(" · ");
  return String(v);
};

function Rows({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-3 py-2.5">
          <span className="text-[13px] text-gray-500 shrink-0">{humanize(k)}</span>
          <span className="text-[13px] font-semibold text-[#111111] text-right">{renderValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

export default function FichaTecnica() {
  const [, params] = useRoute("/ficha/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.find((v) => v.id === id);
  const [imgOk, setImgOk] = useState(true);

  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation(`/vehicle/${id}`));
  const ficha = (vehicle?.fichaData as Record<string, any> | null) || null;

  // Separa campos simples (rows diretas) de grupos (objetos aninhados → seções).
  const simple: Record<string, any> = {};
  const groups: Array<[string, Record<string, any>]> = [];
  if (ficha) {
    for (const [k, v] of Object.entries(ficha)) {
      if (v && typeof v === "object" && !Array.isArray(v)) groups.push([k, v as Record<string, any>]);
      else simple[k] = v;
    }
  }
  const hasFicha = !!ficha && (Object.keys(simple).length > 0 || groups.length > 0);
  const imgUrl = vehicle ? getVehicleImageUrl(vehicle) : null;
  const showImg = !!imgUrl && imgOk;

  return (
    <div className="px-4 pb-8">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-2 bg-[#F5F6FA]/90 backdrop-blur flex items-center gap-3">
        <button onClick={goBack} className="go-btn-active" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#111111] leading-tight">Ficha técnica</h1>
          {vehicle && <p className="text-[11px] text-gray-500 truncate">{vehicle.brand} {vehicle.model}</p>}
        </div>
      </div>

      {!hasFicha ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <p className="font-semibold text-gray-700">Ficha técnica em breve</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            A GO360 vai disponibilizar as especificações deste veículo. Assim que chegarem, aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          {showImg && (
            <div className="relative mb-4 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 h-36 overflow-hidden flex items-center justify-center">
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-28 bg-white/60 blur-2xl rounded-full pointer-events-none" />
              <img
                src={imgUrl!}
                alt={`${vehicle?.brand} ${vehicle?.model}`}
                onError={() => setImgOk(false)}
                loading="lazy"
                className="relative h-[132px] w-auto max-w-[88%] object-contain pointer-events-none drop-shadow-[0_14px_18px_rgba(15,23,42,0.22)]"
              />
            </div>
          )}

          {Object.keys(simple).length > 0 && (
            <div className="go-card p-4 mb-3">
              <Rows data={simple} />
            </div>
          )}

          {groups.map(([title, data]) => (
            <div key={title} className="go-card p-4 mb-3">
              <h3 className="text-[13px] font-bold text-[#243FF7] mb-1.5">{humanize(title)}</h3>
              <Rows data={data} />
            </div>
          ))}

          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed px-1">
            Especificações fornecidas pela GO360 / fabricante. Valores podem variar por versão.
          </p>
        </>
      )}
    </div>
  );
}
