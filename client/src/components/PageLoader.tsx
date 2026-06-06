import { useState } from "react";
import { createPortal } from "react-dom";
import { Shield, Wrench, MapPin, Clock, Zap } from "lucide-react";

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

  // Renderiza no body (portal) para não ficar preso no wrapper de transição
  // (.page-enter usa transform), que deixava o loader desbotado e sem cobrir a tela.
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-[#243FF7] flex flex-col items-center justify-center">
      {/* Logo GO */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2">
        <span className="text-2xl font-black text-white tracking-tight">
          Go<span className="text-[#E2FF04]">!</span>
        </span>
      </div>

      {/* Ícone central com glow */}
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl scale-150" />
        <div className="relative w-24 h-24 bg-white/15 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
          <Icon className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>
      </div>

      {/* Mensagem */}
      <h1 className="text-white text-3xl font-black text-center leading-tight whitespace-pre-line tracking-tight px-6">
        {message.text}
      </h1>
      <p className="text-white/60 text-sm mt-4 font-medium">{message.subtitle}</p>

      {/* Barra de progresso indeterminada */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48">
        <div className="relative h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="animate-loading-indeterminate bg-[#E2FF04] rounded-full" />
        </div>
      </div>

      {/* Slogan */}
      <p className="absolute bottom-8 text-white/30 text-xs font-medium">
        GO Direction — Tecnologia que protege.
      </p>
    </div>,
    document.body,
  );
}
