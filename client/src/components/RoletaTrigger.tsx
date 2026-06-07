import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Gift, ChevronRight } from "lucide-react";
import RoletaModal from "./RoletaModal";

type Trigger = "acesso_app" | "trocou_pagamento" | "intencao_excluir_conta" | "intencao_cancelar_contrato" | "manual";

/**
 * Mostra um banner discreto quando o cliente TEM direito a girar uma roleta
 * para o gatilho informado (regras definidas no GO360). Toca → abre a roleta.
 * Se não houver roleta disponível, não renderiza nada.
 */
export default function RoletaTrigger({
  trigger, contexto, className = "",
}: {
  trigger: Trigger; contexto?: Record<string, any>; className?: string;
}) {
  const { data } = trpc.roletas.disponiveis.useQuery(
    { trigger },
    { staleTime: 60_000, retry: false },
  );
  const [open, setOpen] = useState(false);
  const roleta = data?.[0];
  if (!roleta) return null;

  const accent = roleta.corDestaque || "#243FF7";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full mb-5 rounded-2xl p-4 text-left go-btn-active shadow-lg relative overflow-hidden ${className}`}
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
      >
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="flex items-center gap-3 relative">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[15px] leading-tight">{roleta.nome}</p>
            <p className="text-white/85 text-xs leading-snug mt-0.5 line-clamp-2">{roleta.mensagemChamada}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
        </div>
        <div className="mt-3 bg-white text-center font-bold text-[13px] rounded-xl py-2.5 relative" style={{ color: accent }}>
          🎁 Girar a roleta
        </div>
      </button>

      {open && <RoletaModal roleta={roleta as any} contexto={contexto} onClose={() => setOpen(false)} />}
    </>
  );
}
