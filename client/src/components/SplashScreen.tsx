import { useState, useEffect } from "react";
import { Shield, Wrench, MapPin, Clock, Car, Zap } from "lucide-react";
import GoMark from "./GoMark";
import { useCampaignTheme } from "@/lib/campaignTheme";

function SeasonalSlogan() {
  const c = useCampaignTheme();
  return (
    <p className="absolute bottom-8 text-white/30 text-xs font-medium">
      {c.vigente && c.slogan
        ? `${c.icone ? c.icone + " " : ""}${c.slogan}`
        : "GO Direction — Tecnologia que protege."}
    </p>
  );
}

const SPLASH_MESSAGES = [
  {
    text: "PROTEÇÃO\nEM TEMPO REAL",
    icon: Shield,
    subtitle: "Seu veículo monitorado 24h",
  },
  {
    text: "PARA QUALQUER\nIMPREVISTO",
    icon: Wrench,
    subtitle: "Assistência onde você estiver",
  },
  {
    text: "ASSISTÊNCIA\n24h",
    icon: Clock,
    subtitle: "Sempre ao seu lado",
  },
  {
    text: "RASTREAMENTO\nINTELIGENTE",
    icon: MapPin,
    subtitle: "Saiba onde está seu veículo",
  },
  {
    text: "SEGURANÇA\nQUE CONECTA",
    icon: Zap,
    subtitle: "Tecnologia a seu favor",
  },
];

interface SplashScreenProps {
  onFinish?: () => void;
  duration?: number; // ms total da splash
}

export function SplashScreen({ onFinish, duration = 2500 }: SplashScreenProps) {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const [visible, setVisible] = useState(true);

  // Selecionar mensagem aleatória no início
  useEffect(() => {
    setCurrentMessage(Math.floor(Math.random() * SPLASH_MESSAGES.length));
  }, []);

  // Auto-dismiss após duração
  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeIn(false);
      setTimeout(() => {
        setVisible(false);
        onFinish?.();
      }, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onFinish]);

  if (!visible) return null;

  const message = SPLASH_MESSAGES[currentMessage];
  const Icon = message.icon;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#243FF7] flex flex-col items-center justify-center transition-opacity duration-300 ${
        fadeIn ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Marca GO — herói central com glow */}
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-white/15 rounded-full blur-3xl scale-[2.2]" />
        <GoMark height={96} className="relative drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]" />
      </div>

      {/* Mensagem principal */}
      <h1 className="text-white text-2xl font-black text-center leading-tight whitespace-pre-line tracking-tight px-6">
        {message.text}
      </h1>

      {/* Subtítulo */}
      <p className="text-white/70 text-sm mt-3 font-medium flex items-center gap-1.5">
        <Icon className="w-4 h-4" strokeWidth={2} /> {message.subtitle}
      </p>

      {/* Loading bar */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-48">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E2FF04] rounded-full animate-loading-bar"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>

      {/* Slogan */}
      <SeasonalSlogan />
    </div>
  );
}

export function LoadingSplash() {
  const [currentMessage, setCurrentMessage] = useState(
    () => Math.floor(Math.random() * SPLASH_MESSAGES.length)
  );
  const [fade, setFade] = useState(true);

  // Rotate the brand messages so longer loads look like an intentional,
  // premium "carousel" instead of a blank/gray wait.
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentMessage((i) => (i + 1) % SPLASH_MESSAGES.length);
        setFade(true);
      }, 250);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  const message = SPLASH_MESSAGES[currentMessage];
  const Icon = message.icon;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#243FF7] flex flex-col items-center justify-center">
      {/* Marca GO — herói central com glow (fixo, não pisca com o carrossel) */}
      <div className="relative mb-10">
        <div className="absolute inset-0 bg-white/15 rounded-full blur-3xl scale-[2.2]" />
        <GoMark height={96} className="relative drop-shadow-[0_8px_24px_rgba(0,0,0,0.18)]" />
      </div>

      <div className={`flex flex-col items-center transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
        {/* Mensagem */}
        <h1 className="text-white text-2xl font-black text-center leading-tight whitespace-pre-line tracking-tight px-6">
          {message.text}
        </h1>

        <p className="text-white/70 text-sm mt-3 font-medium flex items-center gap-1.5">
          <Icon className="w-4 h-4" strokeWidth={2} /> {message.subtitle}
        </p>
      </div>

      {/* Spinner pulsante */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#E2FF04] rounded-full animate-spin" />
      </div>

      <SeasonalSlogan />
    </div>
  );
}
