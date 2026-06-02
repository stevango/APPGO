import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  MapPin, Lock, Shield, AlertTriangle, Wrench, Clock,
  Car, Signal, Battery, Wifi, ChevronRight, BatteryWarning, X, Zap, Gauge, Share2, Power,
  Home as HomeIcon, Heart, PawPrint, DollarSign, Building2, Users, MessageCircle, Phone
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark, LicensePlate, AssetTag } from "@/lib/vehicle";
import { isVehicleAsset, getAssetIcon } from "@/lib/assetIcons";
import { useActiveVehicleId, setActiveVehicleId, pickActiveVehicle } from "@/lib/activeVehicle";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";

// Battery thresholds
const BATTERY_WARNING_THRESHOLD = 11.0;
const BATTERY_CRITICAL_THRESHOLD = 10.5;
const BATTERY_BACKUP_WARNING = 3.5;
const BATTERY_BACKUP_CRITICAL = 3.2;

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const [alertDismissed, setAlertDismissed] = useState(false);

  const activeVehicleId = useActiveVehicleId();
  const vehicle = pickActiveVehicle(vehicles, activeVehicleId);
  const firstName = user?.name?.split(" ")[0] || "Usuário";

  // Battery alert logic
  const batteryMain = parseFloat(String(vehicle?.batteryMain || "13"));
  const batteryBackup = parseFloat(String(vehicle?.batteryBackup || "4"));
  const isBatteryCritical = batteryMain > 0 && batteryMain < BATTERY_CRITICAL_THRESHOLD;
  const isBatteryWarning = batteryMain > 0 && batteryMain < BATTERY_WARNING_THRESHOLD && !isBatteryCritical;
  const isBackupCritical = batteryBackup > 0 && batteryBackup < BATTERY_BACKUP_CRITICAL;
  const isBackupWarning = batteryBackup > 0 && batteryBackup < BATTERY_BACKUP_WARNING && !isBackupCritical;
  const hasAnyBatteryAlert = isBatteryCritical || isBatteryWarning || isBackupCritical || isBackupWarning;

  // Speed alert logic
  const currentSpeed = vehicle?.speed || 0;
  const speedLimit = vehicle?.speedLimit || 120;
  const isOverSpeed = currentSpeed > 0 && currentSpeed > speedLimit;

  // Show toast on critical battery when app opens
  useEffect(() => {
    if (isBatteryCritical && vehicle) {
      toast.error("Bateria crítica!", {
        description: `A bateria principal do ${vehicle.brand} ${vehicle.model} está em ${batteryMain}V. Verifique imediatamente.`,
        duration: 8000,
        icon: <BatteryWarning className="w-5 h-5 text-red-500" />,
      });
    }
  }, [isBatteryCritical, vehicle?.id]);

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }, []);

  return (
    <div className="px-5 pt-6 pb-6">
      {/* Header - Clean and welcoming */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="text-[13px] text-gray-400 font-medium">{greeting},</p>
          <h1 className="text-[22px] font-bold text-[#111111] tracking-tight">{firstName}</h1>
        </div>
        <button
          onClick={() => setLocation("/notifications")}
          className="relative w-11 h-11 bg-white rounded-full flex items-center justify-center go-btn-active shadow-sm border border-gray-100/80"
          aria-label="Notificações"
        >
          <Bell className="w-[20px] h-[20px] text-[#343C42]" />
          <NotificationBadge />
        </button>
      </div>

      {/* Speed Alert Banner */}
      {vehicle && isOverSpeed && (
        <div className="mb-5 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 p-4 shadow-lg shadow-red-500/20 overflow-hidden stagger-item">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
              <Gauge className="w-5 h-5 text-white" />
            </div>
            <button onClick={() => setLocation("/tracking")} className="flex-1 text-left">
              <h4 className="font-bold text-sm text-white">Velocidade Excessiva!</h4>
              <p className="text-xs text-red-100 mt-0.5">
                {currentSpeed} km/h — Limite: {speedLimit} km/h
              </p>
            </button>
            <div className="text-right">
              <p className="text-white font-bold text-2xl tabular-nums">{currentSpeed}</p>
              <p className="text-red-200 text-[10px] font-medium">km/h</p>
            </div>
          </div>
        </div>
      )}

      {/* Offline Vehicle Care Alert */}
      {vehicle && vehicle.trackerStatus === "offline" && vehicle.lastSignalAt && (() => {
        const lastSignal = new Date(vehicle.lastSignalAt!).getTime();
        const hoursOffline = (Date.now() - lastSignal) / (1000 * 60 * 60);
        return hoursOffline > 24;
      })() && (
        <button
          onClick={() => setLocation("/vehicle-care")}
          className="mb-5 w-full rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 shadow-sm text-left go-btn-active stagger-item"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-amber-900">Está tudo bem?</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Seu equipamento está sem comunicação há mais de 24h. Toque para nos contar.
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </div>
        </button>
      )}

      {/* Battery Alert Banner */}
      {vehicle && hasAnyBatteryAlert && !alertDismissed && (
        <BatteryAlertBanner
          batteryMain={batteryMain}
          batteryBackup={batteryBackup}
          isCritical={isBatteryCritical || isBackupCritical}
          isWarning={isBatteryWarning || isBackupWarning}
          onDismiss={() => setAlertDismissed(true)}
          onPress={() => setLocation("/tracking")}
        />
      )}

      {/* Asset switcher — tap a chip to change the active equipment */}
      {!isLoading && vehicles && vehicles.length > 1 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Meus equipamentos ({vehicles.length})
            </p>
            <button
              onClick={() => setLocation("/vehicles")}
              className="text-[11px] font-semibold text-[#243FF7] go-btn-active"
            >
              Gerenciar
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {vehicles.map((v) => {
              const Icon = getAssetIcon(v.iconType);
              const active = v.id === vehicle?.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveVehicleId(v.id)}
                  className={`flex items-center gap-2 shrink-0 pl-2.5 pr-3.5 py-2 rounded-xl border-2 transition-all go-btn-active ${
                    active
                      ? "border-[#243FF7] bg-[#243FF7] text-white shadow-md shadow-[#243FF7]/20"
                      : "border-gray-100 bg-white text-gray-600"
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? "bg-white/20" : "bg-gray-100"}`}>
                    <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#243FF7]"}`} />
                  </div>
                  <span className="text-[13px] font-semibold whitespace-nowrap max-w-[120px] truncate">
                    {v.model || v.brand || "Equipamento"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {isLoading ? (
        <VehicleCardSkeleton />
      ) : vehicle ? (
        <VehicleCard
          vehicle={vehicle}
          onPress={() => setLocation("/tracking")}
          batteryMain={batteryMain}
          isBatteryCritical={isBatteryCritical}
          isBatteryWarning={isBatteryWarning}
        />
      ) : (
        <EmptyVehicleCard />
      )}

      {/* Quick Actions - Refined grid */}
      <div className="mt-7">
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">
            Ações rápidas
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={MapPin} label="Localizar" color="#243FF7" onClick={() => setLocation("/tracking")} />
          <QuickAction icon={Lock} label="Bloquear" color="#243FF7" onClick={() => setLocation("/block")} />
          <QuickAction icon={Shield} label="Cerca" color="#243FF7" onClick={() => setLocation("/geofences")} />
          <QuickAction icon={Share2} label="Compartilhar" color="#243FF7" onClick={() => setLocation("/share")} />
          <QuickAction icon={AlertTriangle} label="Furto" color="#EF4444" onClick={() => setLocation("/report-theft")} />
          <QuickAction icon={Wrench} label="Assistência" color="#343C42" onClick={() => setLocation("/sos")} />
          <QuickAction icon={Clock} label="Histórico" color="#343C42" onClick={() => setLocation("/trip-history")} />
          <QuickAction icon={MessageCircle} label="WhatsApp" color="#25D366" onClick={() => {
            if (vehicle) {
              const msg = encodeURIComponent(`📍 Localização: ${vehicle.lastAddress || "N/D"}\n🚗 ${vehicle.brand} ${vehicle.model} - ${vehicle.plate}\n\n🗺️ https://www.google.com/maps?q=${vehicle.lastLatitude},${vehicle.lastLongitude}\n\n_Enviado via GO Direction_`);
              window.open(`https://wa.me/?text=${msg}`, "_blank");
            } else {
              toast.info("Cadastre um equipamento primeiro");
            }
          }} />
        </div>
      </div>

      {/* Banner Carrossel - Publicidade e Oportunidades */}
      <PromoBannerCarousel />

      {/* Vehicle Status - Compact and elegant */}
      {vehicle && (
        <div className="mt-7 go-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider">Status</h3>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${vehicle.trackerStatus === "online" ? "bg-green-500 pulse-online" : "bg-red-400"}`} />
              <span className={`text-[11px] font-medium ${vehicle.trackerStatus === "online" ? "text-green-600" : "text-red-500"}`}>
                {vehicle.trackerStatus === "online" ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatusPill
              icon={Battery}
              label="Bateria"
              value={`${batteryMain.toFixed(1)}V`}
              status={isBatteryCritical ? "danger" : isBatteryWarning ? "warning" : "ok"}
            />
            <StatusPill
              icon={Zap}
              label="Backup"
              value={`${batteryBackup.toFixed(1)}V`}
              status={isBackupCritical ? "danger" : isBackupWarning ? "warning" : "ok"}
            />
            <StatusPill
              icon={Car}
              label="Ignição"
              value={vehicle.ignition ? "Ligada" : "Desligada"}
              status={vehicle.ignition ? "ok" : "neutral"}
            />
            <StatusPill
              icon={Lock}
              label="Bloqueio"
              value={vehicle.blocked ? "Bloqueado" : "Livre"}
              status={vehicle.blocked ? "warning" : "ok"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Battery Alert Banner Component
function BatteryAlertBanner({
  batteryMain,
  batteryBackup,
  isCritical,
  isWarning,
  onDismiss,
  onPress,
}: {
  batteryMain: number;
  batteryBackup: number;
  isCritical: boolean;
  isWarning: boolean;
  onDismiss: () => void;
  onPress: () => void;
}) {
  return (
    <div className={`relative mb-5 rounded-2xl p-4 shadow-lg overflow-hidden stagger-item ${
      isCritical
        ? "bg-gradient-to-r from-red-500 to-red-600 shadow-red-500/15"
        : "bg-gradient-to-r from-amber-400 to-amber-500 shadow-amber-400/15"
    }`}>
      {isCritical && (
        <div className="absolute inset-0 bg-red-400 opacity-20 animate-pulse rounded-2xl" />
      )}

      <div className="relative flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCritical ? "bg-white/20" : "bg-amber-600/20"}`}>
          <BatteryWarning className={`w-5 h-5 ${isCritical ? "text-white" : "text-amber-800"}`} />
        </div>

        <button onClick={onPress} className="flex-1 text-left">
          <h4 className={`font-bold text-sm ${isCritical ? "text-white" : "text-amber-900"}`}>
            {isCritical ? "Bateria Crítica!" : "Bateria Baixa"}
          </h4>
          <p className={`text-xs mt-0.5 ${isCritical ? "text-red-100" : "text-amber-800/80"}`}>
            {batteryMain < BATTERY_WARNING_THRESHOLD && <>Principal: {batteryMain.toFixed(1)}V </>}
            {batteryBackup < BATTERY_BACKUP_WARNING && <>Backup: {batteryBackup.toFixed(1)}V</>}
          </p>
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition ${isCritical ? "bg-white/20 hover:bg-white/30" : "bg-amber-600/20 hover:bg-amber-600/30"}`}
          aria-label="Dispensar alerta"
        >
          <X className={`w-3.5 h-3.5 ${isCritical ? "text-white" : "text-amber-800"}`} />
        </button>
      </div>

      {/* Battery level indicator */}
      <div className="relative mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isCritical ? "bg-white" : "bg-amber-800"}`}
          style={{ width: `${Math.max(5, Math.min(100, (batteryMain / 14) * 100))}%` }}
        />
      </div>
    </div>
  );
}

function Bell({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function NotificationBadge() {
  const { data: notifications } = trpc.notifications.list.useQuery();
  const unread = notifications?.filter((n: any) => !n.read).length || 0;
  if (unread === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center ring-2 ring-white">
      {unread > 9 ? "9+" : unread}
    </span>
  );
}

function VehicleCard({
  vehicle,
  onPress,
  batteryMain,
  isBatteryCritical,
  isBatteryWarning,
}: {
  vehicle: any;
  onPress: () => void;
  batteryMain: number;
  isBatteryCritical: boolean;
  isBatteryWarning: boolean;
}) {
  const timeSinceSignal = vehicle.lastSignalAt
    ? getTimeSince(new Date(vehicle.lastSignalAt))
    : "Sem dados";

  return (
    <button
      onClick={onPress}
      className={`w-full go-card p-5 text-left ${
        isBatteryCritical
          ? "ring-2 ring-red-200 border-red-100"
          : isBatteryWarning
          ? "ring-1 ring-amber-200 border-amber-100"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-[58px] h-[58px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center border border-gray-100 shrink-0 overflow-hidden">
            <BrandMark brand={vehicle.brand} iconType={vehicle.iconType} className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[#111111] text-[15px] tracking-tight truncate">
              {vehicle.brand} {vehicle.model}
            </h3>
            <div className="mt-1.5">
              {isVehicleAsset(vehicle.iconType) ? (
                <LicensePlate plate={vehicle.plate} size="sm" />
              ) : (
                <AssetTag label={vehicle.plate} size="sm" />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${vehicle.trackerStatus === "online" ? "bg-green-50" : "bg-red-50"}`}>
            <div className={`w-2 h-2 rounded-full ${vehicle.trackerStatus === "online" ? "bg-green-500 pulse-online" : "bg-red-400"}`} />
            <span className={`text-[11px] font-semibold ${vehicle.trackerStatus === "online" ? "text-green-600" : "text-red-500"}`}>
              {vehicle.trackerStatus === "online" ? "Online" : "Offline"}
            </span>
          </div>
          {(isBatteryCritical || isBatteryWarning) && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
              isBatteryCritical ? "bg-red-50" : "bg-amber-50"
            }`}>
              <BatteryWarning className={`w-3 h-3 ${isBatteryCritical ? "text-red-500" : "text-amber-500"}`} />
              <span className={`text-[10px] font-semibold ${isBatteryCritical ? "text-red-600" : "text-amber-600"}`}>
                {batteryMain.toFixed(1)}V
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mini-stats — vehicles show speed/ignition; other assets show battery/signal */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {isVehicleAsset(vehicle.iconType) ? (
          <>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Gauge className="w-4 h-4 text-[#243FF7] shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] text-gray-400 font-medium">Velocidade</p>
                <p className="text-[13px] font-bold text-[#111111]">{vehicle.speed ?? 0} <span className="text-[10px] font-medium text-gray-400">km/h</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Power className={`w-4 h-4 shrink-0 ${vehicle.ignition ? "text-green-500" : "text-gray-400"}`} />
              <div className="leading-tight">
                <p className="text-[10px] text-gray-400 font-medium">Ignição</p>
                <p className="text-[13px] font-bold text-[#111111]">{vehicle.ignition ? "Ligada" : "Desligada"}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Battery className="w-4 h-4 text-[#243FF7] shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] text-gray-400 font-medium">Bateria</p>
                <p className="text-[13px] font-bold text-[#111111]">{vehicle.batteryLevel ?? 100}<span className="text-[10px] font-medium text-gray-400">%</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <Signal className="w-4 h-4 text-[#243FF7] shrink-0" />
              <div className="leading-tight">
                <p className="text-[10px] text-gray-400 font-medium">Sinal GPS</p>
                <p className="text-[13px] font-bold text-[#111111]">{vehicle.gpsSatellites ?? 0} <span className="text-[10px] font-medium text-gray-400">sat</span></p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-gray-400">
        <MapPin className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[12px] truncate flex-1 leading-tight">
          {vehicle.lastAddress || "Localização não disponível"}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-300 font-medium">
          Último sinal: {timeSinceSignal}
        </span>
        <div className="w-6 h-6 rounded-full bg-[#243FF7]/8 flex items-center justify-center">
          <ChevronRight className="w-3.5 h-3.5 text-[#243FF7]" />
        </div>
      </div>
    </button>
  );
}

function EmptyVehicleCard() {
  return (
    <div className="go-card p-8 text-center">
      <div className="w-16 h-16 bg-gradient-to-br from-[#243FF7]/10 to-[#243FF7]/5 rounded-full flex items-center justify-center mx-auto mb-4">
        <Car className="w-8 h-8 text-[#243FF7]" />
      </div>
      <h3 className="font-bold text-[#111111] text-[15px] mb-1">Nenhum equipamento</h3>
      <p className="text-[13px] text-gray-400 leading-relaxed">
        Seu equipamento aparecerá aqui após a ativação do rastreador.
      </p>
    </div>
  );
}

function VehicleCardSkeleton() {
  return (
    <div className="go-card p-5">
      <div className="flex items-center gap-3.5">
        <div className="w-[52px] h-[52px] rounded-2xl go-shimmer" />
        <div>
          <div className="w-32 h-5 rounded-lg go-shimmer mb-2" />
          <div className="w-20 h-4 rounded-lg go-shimmer" />
        </div>
      </div>
      <div className="w-full h-4 rounded-lg go-shimmer mt-4" />
      <div className="w-2/3 h-3 rounded-lg go-shimmer mt-2" />
    </div>
  );
}

function QuickAction({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center bg-white rounded-2xl p-3 border border-gray-100/80 gap-2 go-btn-active shadow-sm"
      aria-label={label}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: `${color}12` }}
      >
        <Icon className="w-[20px] h-[20px]" style={{ color }} strokeWidth={2} />
      </div>
      <span className="text-[10px] font-semibold text-[#343C42] leading-tight">{label}</span>
    </button>
  );
}

function StatusPill({ icon: Icon, label, value, status }: { icon: any; label: string; value: string; status: "ok" | "warning" | "danger" | "neutral" }) {
  const colors = {
    ok: { bg: "bg-green-50", text: "text-green-700", icon: "text-green-500" },
    warning: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
    danger: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-500" },
    neutral: { bg: "bg-gray-50", text: "text-gray-600", icon: "text-gray-400" },
  };
  const c = colors[status];

  return (
    <div className={`${c.bg} rounded-xl p-3 flex items-center gap-2.5`}>
      <Icon className={`w-4 h-4 ${c.icon} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <p className={`text-[13px] font-semibold ${c.text} truncate`}>{value}</p>
      </div>
    </div>
  );
}

// Promo Banner Carousel
const PROMO_BANNERS = [
  {
    id: 1,
    title: "Seguro Residencial",
    subtitle: "Proteja sua casa a partir de R$29/mês",
    cta: "Fazer cotação",
    gradient: "from-[#243FF7] to-indigo-700",
    icon: HomeIcon,
    badge: "NOVO",
  },
  {
    id: 2,
    title: "Telemedicina 24h",
    subtitle: "Consultas ilimitadas para toda família",
    cta: "Ativar agora",
    gradient: "from-emerald-500 to-teal-600",
    icon: Heart,
    badge: "SAÚDE",
  },
  {
    id: 3,
    title: "Rastreador PET",
    subtitle: "GPS em tempo real para seu pet",
    cta: "Conhecer planos",
    gradient: "from-orange-400 to-pink-500",
    icon: PawPrint,
    badge: "PET",
  },
  {
    id: 4,
    title: "Crédito CLT",
    subtitle: "Até R$50.000 com taxa a partir de 1,49%",
    cta: "Simular agora",
    gradient: "from-violet-600 to-purple-700",
    icon: DollarSign,
    badge: "CRÉDITO",
  },
  {
    id: 5,
    title: "Home Equity",
    subtitle: "Use seu imóvel como garantia, juros baixos",
    cta: "Saber mais",
    gradient: "from-sky-500 to-blue-700",
    icon: Building2,
    badge: "IMÓVEL",
  },
  {
    id: 6,
    title: "Indique e Ganhe",
    subtitle: "R$50 por cada amigo que assinar",
    cta: "Indicar agora",
    gradient: "from-green-500 to-emerald-600",
    icon: Users,
    badge: "R$50",
  },
];

function PromoBannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Auto-rotate every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % PROMO_BANNERS.length);
        setIsTransitioning(false);
      }, 150);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSwipe = (endX: number) => {
    const diff = touchStart - endX;
    if (Math.abs(diff) > 50) {
      setIsTransitioning(true);
      setTimeout(() => {
        if (diff > 0) setCurrentSlide((prev) => (prev + 1) % PROMO_BANNERS.length);
        else setCurrentSlide((prev) => (prev - 1 + PROMO_BANNERS.length) % PROMO_BANNERS.length);
        setIsTransitioning(false);
      }, 150);
    }
  };

  const banner = PROMO_BANNERS[currentSlide];
  const Icon = banner.icon;

  return (
    <div className="mt-7">
      <div
        className={`relative rounded-2xl bg-gradient-to-br ${banner.gradient} p-5 shadow-xl overflow-hidden cursor-pointer transition-all duration-300 ${
          isTransitioning ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
        }`}
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => handleSwipe(e.changedTouches[0].clientX)}
      >
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-white/8 rounded-full -translate-y-14 translate-x-14" />
        <div className="absolute bottom-0 left-0 w-28 h-28 bg-white/5 rounded-full translate-y-10 -translate-x-10" />

        {/* Badge */}
        {banner.badge && (
          <div className="absolute top-3.5 left-3.5 bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
            {banner.badge}
          </div>
        )}

        <div className="relative flex items-center gap-4 mt-4">
          <div className="flex-1">
            <h3 className="text-white font-extrabold text-xl leading-tight">{banner.title}</h3>
            <p className="text-white/80 text-[13px] mt-1.5 leading-snug">{banner.subtitle}</p>
            <div className="mt-3.5 inline-flex items-center gap-1 text-white text-[12px] font-semibold bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 hover:bg-white/30 transition-colors">
              {banner.cta}
              <ChevronRight size={14} />
            </div>
          </div>
          <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      {/* Dots indicator */}
      <div className="flex items-center justify-center gap-1.5 mt-3.5">
        {PROMO_BANNERS.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setIsTransitioning(true);
              setTimeout(() => { setCurrentSlide(idx); setIsTransitioning(false); }, 150);
            }}
            className={`rounded-full transition-all duration-300 ${
              idx === currentSlide
                ? "w-6 h-[6px] bg-[#243FF7]"
                : "w-[6px] h-[6px] bg-gray-300"
            }`}
            aria-label={`Slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function getTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `há ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}
