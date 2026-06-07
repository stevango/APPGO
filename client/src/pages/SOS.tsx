import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  AlertTriangle, Car, Wrench, Truck, Key, CircleDot,
  Battery, Fuel, Phone, ChevronLeft, CheckCircle, X,
  Shield, HeartPulse, Clock, ArrowRight, Volume2, VolumeX,
  MapPin, XCircle, Copy, Share2, MessageSquare, Send, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { alertHaptic } from "@/lib/haptics";
import type { LucideIcon } from "lucide-react";

type SosOption = {
  type: string;
  icon: LucideIcon;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
};

type UrgencyCategory = {
  id: string;
  title: string;
  description: string;
  options: SosOption[];
};

const ALL_OPTIONS: SosOption[] = [
  { type: "furto_roubo", icon: AlertTriangle, label: "Furto/Roubo", sublabel: "Acionamento imediato", color: "text-red-600", bgColor: "bg-red-50" },
  { type: "acidente", icon: Car, label: "Acidente", sublabel: "Assistência 24h", color: "text-orange-600", bgColor: "bg-orange-50" },
  { type: "pane", icon: Wrench, label: "Pane", sublabel: "Guincho disponível", color: "text-yellow-600", bgColor: "bg-yellow-50" },
  { type: "guincho", icon: Truck, label: "Guincho", sublabel: "Transporte seguro", color: "text-blue-600", bgColor: "bg-blue-50" },
  { type: "chaveiro", icon: Key, label: "Chaveiro", sublabel: "Destrancamento 24h", color: "text-purple-600", bgColor: "bg-purple-50" },
  { type: "pneu", icon: CircleDot, label: "Pneu", sublabel: "Troca rápida", color: "text-gray-600", bgColor: "bg-gray-50" },
  { type: "bateria", icon: Battery, label: "Bateria", sublabel: "Carregamento móvel", color: "text-teal-600", bgColor: "bg-teal-50" },
  { type: "pane_seca", icon: Fuel, label: "Pane Seca", sublabel: "Entrega de combustível", color: "text-orange-600", bgColor: "bg-orange-50" },
  { type: "emergencia", icon: Phone, label: "Emergência", sublabel: "Acionamento imediato", color: "text-red-600", bgColor: "bg-red-50" },
  { type: "central", icon: Phone, label: "Central GO", sublabel: "Atendimento direto", color: "text-blue-600", bgColor: "bg-blue-50" },
];

const URGENCY_CATEGORIES: UrgencyCategory[] = [
  {
    id: "immediate",
    title: "🚨 Emergência Imediata",
    description: "Para situações de risco iminente",
    options: ALL_OPTIONS.filter(o => ["theft", "emergency"].includes(o.type)),
  },
  {
    id: "assistance",
    title: "🛠️ Assistência 24h",
    description: "Para problemas com o veículo",
    options: ALL_OPTIONS.filter(o => ["accident", "breakdown", "tow", "key", "tire", "battery", "fuel"].includes(o.type)),
  },
  {
    id: "support",
    title: "☎️ Suporte",
    description: "Contato direto com a central",
    options: ALL_OPTIONS.filter(o => ["central"].includes(o.type)),
  },
];

export default function SOS() {
  const [, setLocation] = useLocation();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof localStorage !== "undefined") {
      return localStorage.getItem("sosSound") !== "false";
    }
    return true;
  });
  const [showLocationRequest, setShowLocationRequest] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const vibrationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const address = useRef<string | null>(null);
  const [displayAddress, setDisplayAddress] = useState<string | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  
  const { data: primaryContact } = trpc.emergencyContacts.getPrimary.useQuery();
  const sendAlertMutation = trpc.emergencyContacts.sendAlert.useMutation();

  useEffect(() => {
    if (userLocation && showSuccess && !displayAddress && !isLoadingAddress) {
      setIsLoadingAddress(true);
      fetch("/api/trpc/sos.reverseGeocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          json: {
            latitude: String(userLocation.lat),
            longitude: String(userLocation.lng),
          },
        }),
      })
        .then((res) => res.json())
        .then((data: any) => {
          if (data.result?.data?.success && data.result.data.address) {
            setDisplayAddress(data.result.data.address);
            address.current = data.result.data.address;
          }
          setIsLoadingAddress(false);
        })
        .catch(() => {
          setIsLoadingAddress(false);
        });
    }
  }, [userLocation, showSuccess, displayAddress, isLoadingAddress]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "denied") {
          setLocationPermissionDenied(true);
        }
      });
    }
  }, []);

  const playConfirmationBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1320, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);
    } catch (e) {
      console.log("Audio not supported");
    }
  }, [soundEnabled]);

  const requestLocation = useCallback(() => {
    setShowLocationRequest(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setShowLocationRequest(false);
          setShowConfirmation(true);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setShowLocationRequest(false);
          setShowConfirmation(true);
        }
      );
    } else {
      setShowLocationRequest(false);
      setShowConfirmation(true);
    }
  }, []);

  const handleHoldStart = useCallback(() => {
    if (!selectedType) return;

    setHoldProgress(0);
    let progress = 0;
    const requiredTime = 2000;
    const interval = 50;

    if (navigator.vibrate) {
      navigator.vibrate(30);
    }

    holdTimerRef.current = setInterval(() => {
      progress += interval;
      setHoldProgress((progress / requiredTime) * 100);

      if (progress % 300 === 0 && progress < requiredTime) {
        const intensity = Math.min(100, 30 + (progress / requiredTime) * 70);
        if (navigator.vibrate) {
          navigator.vibrate(intensity);
        }
      }

      if (progress >= requiredTime) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setHoldProgress(100);
        playConfirmationBeep();
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
        handleSosSubmit();
      }
    }, interval);
  }, [selectedType, playConfirmationBeep]);

  const handleHoldEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdProgress < 100) {
      setHoldProgress(0);
    }
  }, [holdProgress]);

  const triggerSosMutation = trpc.sos.trigger.useMutation();
  const cancelSosMutation = trpc.sos.cancel.useMutation();

  const handleSosSubmit = useCallback(async () => {
    if (!selectedType) return;

    try {
      await triggerSosMutation.mutateAsync({
        type: selectedType as "furto_roubo" | "acidente" | "pane" | "guincho" | "chaveiro" | "pneu" | "bateria" | "pane_seca" | "emergencia" | "central",
        latitude: userLocation?.lat ? String(userLocation.lat) : undefined,
        longitude: userLocation?.lng ? String(userLocation.lng) : undefined,
      });

      setShowConfirmation(false);
      setShowSuccess(true);
      setCancelCountdown(10);
      void alertHaptic("critical"); // confirmação tátil (não depende do som)

      const countdownInterval = setInterval(() => {
        setCancelCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      toast.error("Erro ao acionar SOS");
    }
  }, [selectedType, userLocation]);

  const handleSendAlertDirect = useCallback(async () => {
    if (!primaryContact || !selectedType || !userLocation) {
      toast.error("Contato favorito não configurado");
      return;
    }

    try {
      await sendAlertMutation.mutateAsync({
        contactId: primaryContact.id,
        sosType: selectedType,
        latitude: userLocation.lat.toString(),
        longitude: userLocation.lng.toString(),
        address: displayAddress || undefined,
      });
      toast.success(`Alerta enviado para ${primaryContact.name}!`);
    } catch (error) {
      toast.error("Erro ao enviar alerta");
    }
  }, [primaryContact, selectedType, userLocation, displayAddress, sendAlertMutation]);

  const handleCancelSOS = useCallback(async () => {
    try {
      await cancelSosMutation.mutateAsync();
      setIsCancelled(true);
      setCancelCountdown(0);
      toast.success("SOS cancelado com sucesso");
    } catch (error) {
      toast.error("Erro ao cancelar SOS");
    }
  }, [cancelSosMutation]);

  useEffect(() => {
    if (soundEnabled) {
      localStorage.setItem("sosSound", "true");
    } else {
      localStorage.setItem("sosSound", "false");
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (cancelCountdown > 0) {
      const timer = setTimeout(() => {
        setCancelCountdown(cancelCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cancelCountdown]);

  // === TELA PRINCIPAL ===
  if (!showConfirmation && !showSuccess && !showLocationRequest) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation("/")} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <h1 className="text-xl font-bold text-gray-900">SOS - Emergência</h1>
          </div>
        </div>

        <div className="flex-1 px-6 py-6 overflow-y-auto">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-1">Central GO 24h</h3>
                <p className="text-sm text-red-800">
                  Selecione o tipo de emergência. Após confirmação, a Central GO será acionada imediatamente.
                </p>
              </div>
            </div>
          </div>

          {URGENCY_CATEGORIES.map((category) => (
            <div key={category.id} className="mb-6">
              <h2 className="text-sm font-bold text-gray-900 mb-3">{category.title}</h2>
              <p className="text-xs text-gray-600 mb-3">{category.description}</p>
              <div className="grid grid-cols-2 gap-3">
                {category.options.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => {
                      setSelectedType(option.type);
                      requestLocation();
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                      option.bgColor
                    } border-gray-200 hover:border-gray-300`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${option.bgColor}`}>
                      <option.icon className={`w-6 h-6 ${option.color}`} />
                    </div>
                    <p className="text-sm font-bold text-gray-900">{option.label}</p>
                    <p className="text-xs text-gray-600">{option.sublabel}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // === TELA DE SOLICITAÇÃO DE LOCALIZAÇÃO ===
  if (showLocationRequest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-blue-50 to-white">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <MapPin className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3 text-center">Permissão de Localização</h2>
        <p className="text-sm text-gray-600 text-center mb-6 max-w-xs">
          Precisamos da sua localização para enviar o SOS com precisão. Sua privacidade é protegida.
        </p>
        <div className="w-full max-w-xs space-y-3">
          <Button
            onClick={() => {
              setShowLocationRequest(false);
              setShowConfirmation(true);
            }}
            className="w-full h-12 bg-gradient-to-r from-[#243FF7] to-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200"
          >
            Prosseguir sem localização
          </Button>
        </div>
      </div>
    );
  }

  // === TELA DE CONFIRMAÇÃO ===
  if (showConfirmation && !showSuccess) {
    const selectedOption = ALL_OPTIONS.find((o) => o.type === selectedType);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-blue-50 to-white">
        <button
          onClick={() => {
            setShowConfirmation(false);
            setSelectedType(null);
          }}
          className="absolute top-6 left-6 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        {selectedOption && (
          <>
            <div className={`w-20 h-20 ${selectedOption.bgColor} rounded-full flex items-center justify-center mb-6`}>
              <selectedOption.icon className={`w-10 h-10 ${selectedOption.color}`} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedOption.label}</h2>
            <p className="text-sm text-gray-600 text-center mb-8 max-w-xs">{selectedOption.sublabel}</p>
          </>
        )}

        {locationPermissionDenied && (
          <div className="w-full max-w-xs mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <p className="text-xs text-yellow-800">
              <span className="font-semibold">Localização não disponível.</span> Enviaremos o SOS sem coordenadas.
            </p>
          </div>
        )}

        {userLocation && (
          <div className="w-full max-w-xs mb-4 bg-green-50 border border-green-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs text-green-700 font-medium">Localização capturada com sucesso</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-xs mb-6">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <svg className="w-full h-full" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="56" fill="none" stroke="#e5e7eb" strokeWidth="2" />
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray={`${(holdProgress / 100) * 2 * Math.PI * 56} ${2 * Math.PI * 56}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                className="transition-all duration-75"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600 mb-1" />
              <span className="text-xs font-bold text-gray-700 tabular-nums">
                {holdProgress === 100 ? "✓" : `${(2 - (holdProgress / 100) * 2).toFixed(1)}s`}
              </span>
            </div>
          </div>
          <p className="text-center text-xs text-gray-600 mb-4">
            {holdProgress === 0
              ? "Mecanismo de segurança"
              : holdProgress < 100
              ? "Continue segurando..."
              : "Acionamento confirmado!"}
          </p>
        </div>

        <button
          onMouseDown={handleHoldStart}
          onMouseUp={handleHoldEnd}
          onTouchStart={handleHoldStart}
          onTouchEnd={handleHoldEnd}
          className={`w-full max-w-xs h-16 rounded-3xl font-bold text-white transition-all duration-150 active:scale-[0.93] shadow-lg ${
            holdProgress === 100
              ? "bg-gradient-to-r from-green-500 to-emerald-600 shadow-green-200"
              : "bg-gradient-to-r from-[#243FF7] to-blue-600 shadow-blue-200"
          }`}
          style={{
            transform: holdProgress > 0 && holdProgress < 100 ? "scale(0.93)" : "scale(1)",
          }}
        >
          {holdProgress === 100 ? "✓ SOS ENVIADO" : "MANTER PRESSIONADO"}
        </button>

        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-gray-700" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-700" />
            )}
          </button>
          <span className="text-xs text-gray-600">{soundEnabled ? "Som ativo" : "Som desativado"}</span>
        </div>
      </div>
    );
  }

  // === TELA DE SUCESSO (com botão de cancelamento) ===
  if (showSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-emerald-50 to-white">
        {isCancelled ? (
          // Estado cancelado
          <div className="flex flex-col items-center animate-in fade-in duration-300">
            <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-gray-200">
              <XCircle className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">SOS Cancelado</h2>
            <p className="text-sm text-gray-600 text-center mb-8 max-w-xs">
              O acionamento foi cancelado com sucesso. A Central GO foi notificada.
            </p>
            <Button
              className="w-full max-w-xs h-12 bg-gradient-to-r from-[#243FF7] to-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 active:scale-[0.97] transition-transform duration-150"
              onClick={() => {
                setShowSuccess(false);
                setSelectedType(null);
                setHoldProgress(0);
                setIsCancelled(false);
                setLocation("/");
              }}
            >
              Voltar ao início
            </Button>
          </div>
        ) : (
          // Estado de sucesso com countdown de cancelamento
          <>
            <div className="animate-in zoom-in-50 fade-in duration-500">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-lg shadow-emerald-200">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">SOS Enviado!</h2>
            <p className="text-sm text-gray-600 text-center mb-3 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200">
              A Central GO foi acionada e nossa equipe já está cuidando do seu caso.
            </p>

            {userLocation && (
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-3 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-500 delay-250">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs text-gray-600">Localização enviada com sucesso</span>
                </div>
                {isLoadingAddress ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse" />
                    <span className="text-xs text-gray-500">Obtendo endereço...</span>
                  </div>
                ) : displayAddress ? (
                  <p className="text-xs text-gray-700 font-medium">{displayAddress}</p>
                ) : (
                  <p className="text-xs text-gray-500">Coordenadas: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}</p>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Tempo estimado</span>
              </div>
              <p className="text-xs text-blue-600">
                Você receberá um contato em até 5 minutos. Fique tranquilo, estamos com você.
              </p>
            </div>

            {/* Botões de compartilhamento */}
            {userLocation && (
              <>
                {/* Primeira linha: Copiar e WhatsApp */}
                <div className="w-full max-w-xs mb-2 flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[350ms]">
                  <button
                    onClick={() => {
                      const textToCopy = displayAddress || `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(textToCopy).then(() => {
                          toast.success(displayAddress ? "Endereço copiado!" : "Coordenadas copiadas!");
                        }).catch(() => {
                          toast.error("Erro ao copiar");
                        });
                      } else {
                        toast.error("Cópia não suportada neste navegador");
                      }
                    }}
                    disabled={isLoadingAddress}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-medium transition-all active:scale-[0.97] duration-150"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{isLoadingAddress ? "Carregando..." : "Copiar"}</span>
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const textToShare = displayAddress || `Coordenadas: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
                        const fullMessage = `🚨 SOS Acionado!\n\nLocal: ${textToShare}\n\nEstou precisando de ajuda. Por favor, venha me buscar.`;
                        const encodedMessage = encodeURIComponent(fullMessage);
                        const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
                        const newWindow = window.open(whatsappUrl, "_blank");
                        if (!newWindow) {
                          toast.error("Não foi possível abrir WhatsApp");
                        }
                      } catch (error) {
                        toast.error("Erro ao compartilhar");
                      }
                    }}
                    disabled={isLoadingAddress}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all active:scale-[0.97] duration-150 shadow-md shadow-green-200"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>
                </div>

                {/* Segunda linha: SMS e Telegram */}
                <div className="w-full max-w-xs mb-4 flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[400ms]">
                  <button
                    onClick={() => {
                      try {
                        const textToShare = displayAddress || `Coordenadas: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
                        const smsMessage = `🚨 SOS! Local: ${textToShare}. Estou precisando de ajuda.`;
                        const smsUrl = `sms:?body=${encodeURIComponent(smsMessage)}`;
                        window.location.href = smsUrl;
                      } catch (error) {
                        toast.error("Erro ao compartilhar via SMS");
                      }
                    }}
                    disabled={isLoadingAddress}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all active:scale-[0.97] duration-150 shadow-md shadow-blue-200"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>SMS</span>
                  </button>
                  <button
                    onClick={() => {
                      try {
                        const textToShare = displayAddress || `Coordenadas: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
                        const telegramMessage = `🚨 SOS Acionado!\n\nLocal: ${textToShare}\n\nEstou precisando de ajuda. Por favor, venha me buscar.`;
                        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(telegramMessage)}`;
                        const newWindow = window.open(telegramUrl, "_blank");
                        if (!newWindow) {
                          toast.error("Não foi possível abrir Telegram");
                        }
                      } catch (error) {
                        toast.error("Erro ao compartilhar via Telegram");
                      }
                    }}
                    disabled={isLoadingAddress}
                    className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all active:scale-[0.97] duration-150 shadow-md shadow-sky-200"
                  >
                    <Send className="w-4 h-4" />
                    <span>Telegram</span>
                  </button>
                </div>

                {/* Botão de envio direto para contato favorito */}
                {primaryContact && (
                  <div className="w-full max-w-xs mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[475ms]">
                    <Button
                      onClick={handleSendAlertDirect}
                      disabled={sendAlertMutation.isPending}
                      className="w-full h-11 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium shadow-md shadow-red-200 active:scale-[0.97] transition-all duration-150"
                    >
                      <Heart className="w-4 h-4 mr-2" />
                      {sendAlertMutation.isPending ? "Enviando..." : `Avisar ${primaryContact.name}`}
                    </Button>
                  </div>
                )}

                {/* Botão de envio para contatos de emergência */}
                <div className="w-full max-w-xs mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[450ms]">
                  <Button
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.set("sosType", selectedType || "emergencia");
                      if (userLocation) {
                        params.set("latitude", userLocation.lat.toString());
                        params.set("longitude", userLocation.lng.toString());
                      }
                      if (displayAddress) {
                        params.set("address", displayAddress);
                      }
                      setLocation(`/emergency-contacts?${params.toString()}`);
                    }}
                    className="w-full h-11 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-medium shadow-md shadow-purple-200 active:scale-[0.97] transition-all duration-150"
                  >
                    <Heart className="w-4 h-4 mr-2" />
                    Avisar Contatos
                  </Button>
                </div>
              </>
            )}

            {/* Botão de cancelamento com countdown */}
            {cancelCountdown > 0 && (
              <div className="w-full max-w-xs mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[400ms]">
                <button
                  onClick={handleCancelSOS}
                  className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold transition-all active:scale-[0.97] duration-150"
                >
                  <XCircle className="w-4.5 h-4.5" />
                  <span>Cancelar SOS</span>
                  <span className="ml-1 text-xs font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded-full tabular-nums">
                    {cancelCountdown}s
                  </span>
                </button>
              </div>
            )}

            <Button
              className="w-full max-w-xs h-12 bg-gradient-to-r from-[#243FF7] to-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 active:scale-[0.97] transition-transform duration-150 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-[450ms]"
              onClick={() => {
                setShowSuccess(false);
                setSelectedType(null);
                setHoldProgress(0);
                setLocation("/");
              }}
            >
              Voltar ao início
            </Button>
          </>
        )}
      </div>
    );
  }

  return null;
}
