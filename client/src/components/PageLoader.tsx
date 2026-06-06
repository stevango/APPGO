import { useState } from "react";
import { createPortal } from "react-dom";
import { Shield, Wrench, MapPin, Clock, Zap } from "lucide-react";
import GoMark from "./GoMark";
import { useCampaignTheme } from "@/lib/campaignTheme";

/**
 * Branded page-transition loader (Suspense fallback while a lazy route chunk
 * loads). Mantém a marca na tela com um visual premium — nunca um flash branco.
 */
const MESSAGES = [
  { text: "RASTREAMENTO\nINTELIGENTE", icon: MapPin, subtitle: "Saiba onde está seu veículo" },
  { text: "PROTEÇÃO\nEM TEMPO REAL", icon: Shield, subtitle: "Seu veículo monitorado 24h" },
  { text: "ASSISTÊNCIA\n24h", icon: Clock, subtitle: "Sempre ao seu lado" },
  { text: "PARA QUALQUER\nIMPREVISTO", icon: Wrench, subtitle: "Assistência onde você estiver" },
  { text: "SEGURANÇA\nQUE CONECTA", icon: Zap, subtitle: "Tecnologia a seu favor" },
];

export default function PageLoader() {
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
  const Icon = message.icon;
  const campaign = useCampaignTheme();

  // Renderiza no body (portal) para não ficar preso no wrapper de transição
  // (.page-enter usa transform), que deixava o loader desbotado e sem cobrir a tela.
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#243FF7] flex flex-col items-center justify-center">
      {/* Marca GO — herói central com glow */}
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-white/15 rounded-full blur-3xl scale-[2.2]" />
        <GoMark height={96} className="relative drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]" />
      </div>

      {/* Mensagem */}
      <h1 className="text-white text-2xl font-black text-center leading-tight whitespace-pre-line tracking-tight px-6">
        {message.text}
      </h1>
      <p className="text-white/70 text-sm mt-3 font-medium flex items-center gap-1.5">
        <Icon className="w-4 h-4" strokeWidth={2} /> {message.subtitle}
      </p>

      {/* Barra de progresso indeterminada */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48">
        <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="animate-loading-indeterminate bg-[#E2FF04] rounded-full" />
        </div>
      </div>

      {/* Slogan (sazonal quando há campanha vigente) */}
      <p className="absolute bottom-8 text-white/30 text-xs font-medium">
        {campaign.vigente && campaign.slogan
          ? `${campaign.icone ? campaign.icone + " " : ""}${campaign.slogan}`
          : "GO Direction — Tecnologia que protege."}
      </p>
    </div>,
    document.body,
  );
}
