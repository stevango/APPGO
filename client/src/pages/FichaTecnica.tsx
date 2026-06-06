import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, FileText, ExternalLink } from "lucide-react";

/** Abre a ficha técnica (página pública da GO360) DENTRO do app, num iframe. */
export default function FichaTecnica() {
  const [, params] = useRoute("/ficha/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.find((v) => v.id === id);
  const [loaded, setLoaded] = useState(false);

  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation(`/vehicle/${id}`));
  const url = vehicle?.fichaUrl || null;

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 68px)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button onClick={goBack} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-[#111111] leading-tight truncate">Ficha técnica</h1>
          {vehicle && <p className="text-[11px] text-gray-400 truncate">{vehicle.brand} {vehicle.model}</p>}
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-gray-400 go-btn-active p-1" aria-label="Abrir em nova aba">
            <ExternalLink className="w-4.5 h-4.5" />
          </a>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative flex-1 bg-gray-50">
        {!url ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700">Ficha técnica em breve</p>
            <p className="text-sm text-gray-400 mt-1">A GO360 vai disponibilizar a ficha técnica deste veículo.</p>
          </div>
        ) : (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-gray-200 border-t-[#243FF7] rounded-full animate-spin" />
              </div>
            )}
            <iframe
              src={`/api/ficha/${id}`}
              title="Ficha técnica do veículo"
              onLoad={() => setLoaded(true)}
              className="w-full h-full border-0"
            />
          </>
        )}
      </div>
    </div>
  );
}
