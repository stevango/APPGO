import { useState, useEffect } from "react";
import { Shield, Wrench, MapPin, Clock, Car, Zap } from "lucide-react";

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

      {/* Mensagem principal */}
      <h1 className="text-white text-3xl font-black text-center leading-tight whitespace-pre-line tracking-tight">
        {message.text}
      </h1>

      {/* Subtítulo */}
      <p className="text-white/60 text-sm mt-4 font-medium">
        {message.subtitle}
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
      <p className="absolute bottom-8 text-white/30 text-xs font-medium">
        GO Direction — Tecnologia que protege.
      </p>
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
      {/* Logo GO */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2">
        <span className="text-2xl font-black text-white tracking-tight">
          Go<span className="text-[#E2FF04]">!</span>
        </span>
      </div>

      <div className={`flex flex-col items-center transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
        {/* Ícone central */}
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

        <p className="text-white/60 text-sm mt-4 font-medium">
          {message.subtitle}
        </p>
      </div>

      {/* Spinner pulsante */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
        <div className="w-6 h-6 border-2 border-white/20 border-t-[#E2FF04] rounded-full animate-spin" />
      </div>

      <p className="absolute bottom-8 text-white/30 text-xs font-medium">
        GO Direction — Tecnologia que protege.
      </p>
    </div>
  );
}
