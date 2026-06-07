import { useState } from "react";
import { Info } from "lucide-react";
import FullScreenModal from "./FullScreenModal";
import type { TrackerStatus } from "@/lib/trackerStatus";

/**
 * Pill de status TOCÁVEL que abre um explicador honesto da regra de status.
 * Transparência: o cliente entende exatamente o que Online/Standby/Offline
 * significam (e a partir de quando recomendamos manutenção) — reduz dúvida e
 * ticket de CS, e nunca "engana" sobre o estado do rastreador.
 */
function ageLabel(ageH: number): string {
  if (!isFinite(ageH)) return "sem comunicação registrada";
  if (ageH < 1) return "há poucos minutos";
  if (ageH < 24) return `há ${Math.round(ageH)}h`;
  const d = Math.floor(ageH / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}

const ROWS = [
  {
    key: "online",
    dot: "bg-green-500",
    title: "Online",
    range: "Comunicou nas últimas 24h",
    desc: "O rastreador está reportando normalmente. Posição e dados estão atualizados.",
  },
  {
    key: "standby",
    dot: "bg-amber-500",
    title: "Standby · Desatualizado",
    range: "24h a 72h sem comunicar",
    desc: "Pode ser área sem sinal, veículo guardado ou o início de um problema. A partir de 48h recomendamos verificar o equipamento.",
  },
  {
    key: "offline",
    dot: "bg-red-500",
    title: "Offline",
    range: "72h ou mais sem comunicar",
    desc: "É provável que o equipamento não volte a funcionar sem intervenção humana. Recomendamos agendar uma manutenção.",
  },
] as const;

export default function StatusLegend({
  status,
  size = "md",
}: {
  status: TrackerStatus;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const pad = size === "sm" ? "px-2 py-1" : "px-2.5 py-1";
  const txt = size === "sm" ? "text-[11px]" : "text-[11px]";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`flex items-center gap-1.5 rounded-full ${pad} ${status.bg} shadow-sm ring-1 ring-black/[0.03] go-btn-active`}
        aria-label={`Status: ${status.label}. Toque para entender`}
      >
        <span className={`w-2 h-2 rounded-full ${status.dot}`} />
        <span className={`${txt} font-semibold ${status.text}`}>{status.label}</span>
        <Info className={`w-3 h-3 ${status.text} opacity-60`} />
      </button>

      {open && (
        <FullScreenModal
          title="Status do rastreador"
          subtitle="Como interpretamos a comunicação do equipamento"
          onClose={() => setOpen(false)}
        >
          {/* Estado atual deste equipamento */}
          <div className={`rounded-2xl p-4 ${status.bg} mb-5`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
              <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
            </div>
            <p className="text-[13px] text-gray-700 mt-1.5">
              Última comunicação <span className="font-semibold">{ageLabel(status.ageH)}</span>.
            </p>
          </div>

          <div className="space-y-3">
            {ROWS.map((r) => (
              <div
                key={r.key}
                className={`rounded-2xl border p-4 ${
                  r.key === status.key ? "border-gray-300 bg-gray-50" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
                  <span className="font-bold text-[#111111] text-[15px]">{r.title}</span>
                </div>
                <p className="text-[12px] text-gray-500 font-medium mt-1">{r.range}</p>
                <p className="text-[13px] text-gray-700 leading-snug mt-1.5">{r.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-[12px] text-gray-500 leading-relaxed mt-5">
            O status é calculado pelo <span className="font-semibold">tempo desde a última
            comunicação</span> do rastreador — não por um sinalizador fixo. Assim o que você vê
            aqui reflete o estado real do equipamento.
          </p>
        </FullScreenModal>
      )}
    </>
  );
}
