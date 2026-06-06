import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  MapPin, Lock, Shield, AlertTriangle, Wrench, Clock,
  Car, Signal, Battery, Wifi, ChevronRight, BatteryWarning, X, Gauge, Share2, Power,
  Home as HomeIcon, Heart, PawPrint, DollarSign, Building2, Users, MessageCircle, Phone,
  Wallet, Headphones, Gift, Zap, Smartphone, Truck, Bike, Anchor, Music, Package, Caravan, CreditCard,
  ShieldCheck, History, Info
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark, LicensePlate, AssetTag } from "@/lib/vehicle";
import { isVehicleAsset, getAssetIcon } from "@/lib/assetIcons";
import { getVehicleImageUrl } from "@/lib/vehicleImage";
import { useActiveVehicleId, setActiveVehicleId, pickActiveVehicle, dedupeVehicles } from "@/lib/activeVehicle";
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
  const { data: vehiclesRaw, isLoading } = trpc.vehicles.list.useQuery(undefined, {
    refetchInterval: 15000,
  });
  const vehicles = useMemo(() => dedupeVehicles(vehiclesRaw), [vehiclesRaw]);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const openInvoices = trpc.payment.openSummary.useQuery();
  const currentMethod = trpc.payment.getCurrent.useQuery();

  // When backed by GO360, refresh the customer's real vehicles on open.
  const utils = trpc.useUtils();
  const go360 = trpc.go360.status.useQuery();
  const syncEquip = trpc.go360.syncEquipment.useMutation({
    onSuccess: () => utils.vehicles.list.invalidate(),
  });
  useEffect(() => {
    if (go360.data?.enabled) syncEquip.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go360.data?.enabled]);

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

      {/* TOP banner: recurring-card discount for everyone NOT on recurring card */}
      {(!openInvoices.data || openInvoices.data.count === 0) &&
        (!currentMethod.data || currentMethod.data.type !== "recurring_card") && (
          <button
            onClick={() => setLocation("/payment")}
            className="mb-5 w-full rounded-2xl bg-gradient-to-br from-[#243FF7] to-[#1a2fd4] p-4 text-left go-btn-active shadow-lg shadow-[#243FF7]/25 relative overflow-hidden"
          >
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/5 rounded-full" />
            <div className="flex items-center gap-3 relative">
              <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
                <CreditCard className="w-6 h-6 text-[#E2FF04]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white font-bold text-[15px]">Economize 15% todo mês</p>
                  <span className="text-[10px] font-black text-[#111111] bg-[#E2FF04] rounded-full px-1.5 py-0.5">-15%</span>
                </div>
                <p className="text-white/80 text-xs leading-snug mt-0.5">
                  Ative o cartão recorrente e nunca mais se preocupe com vencimento.
                </p>
              </div>
            </div>
            <div className="mt-3 bg-[#E2FF04] text-[#111111] text-center font-bold text-[13px] rounded-xl py-2.5 flex items-center justify-center gap-1 relative">
              Ativar agora <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        )}

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

      {/* Tracker sem posicionar → alerta de manutenção (nível crítico). Independe
          do status "online" que a GO360 reporta: o que importa é há quanto tempo
          não há posição. */}
      {vehicle && !vehicle.isDemo && <MaintenanceAlert vehicle={vehicle} />}

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

      {/* Friendly overdue-invoice reminder — empathetic, escalates by days late */}
      {openInvoices.data && openInvoices.data.count > 0 && (() => {
        const { totalAmount, daysLate } = openInvoices.data!;
        const money = totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        // Tiered tone — always supportive, never punitive.
        const tier =
          daysLate <= 7
            ? { title: "Ficou uma fatura em aberto 💛", msg: `Acontece! Regularize ${money} em 1 toque e siga 100% protegido.`, box: "from-amber-50 to-orange-50 border-amber-200", icon: "bg-amber-100 text-amber-600", h: "text-amber-900", p: "text-amber-700", btn: "bg-amber-500" }
            : daysLate <= 15
            ? { title: `Fatura atrasada há ${daysLate} dias`, msg: `Vamos resolver juntos? Pague ${money} agora e mantenha tudo em dia.`, box: "from-orange-50 to-orange-100 border-orange-200", icon: "bg-orange-100 text-orange-600", h: "text-orange-900", p: "text-orange-700", btn: "bg-orange-500" }
            : { title: "Mantenha sua proteção ativa", msg: `Há ${daysLate} dias em aberto. Regularize ${money} para evitar a suspensão — e conte com a gente se precisar renegociar.`, box: "from-red-50 to-orange-50 border-red-200", icon: "bg-red-100 text-red-600", h: "text-red-900", p: "text-red-700", btn: "bg-red-500" };
        return (
          <div className="mb-5 stagger-item">
            <button
              onClick={() => setLocation("/payment/history")}
              className={`w-full rounded-2xl bg-gradient-to-r ${tier.box} border p-4 text-left go-btn-active`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 ${tier.icon} rounded-xl flex items-center justify-center shrink-0`}>
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-bold text-sm ${tier.h}`}>{tier.title}</h4>
                  <p className={`text-xs ${tier.p} mt-0.5`}>{tier.msg}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`flex-1 text-center text-[13px] font-bold text-white ${tier.btn} rounded-xl py-2.5`}>
                  Resolver agora
                </span>
                <span
                  onClick={(e) => { e.stopPropagation(); setLocation("/help"); }}
                  className={`text-[13px] font-semibold ${tier.p} px-3 py-2.5`}
                >
                  Preciso de ajuda
                </span>
              </div>
            </button>

            {/* Anti-default nudge: switch boleto → recurring card with a discount */}
            <button
              onClick={() => setLocation("/payment")}
              className="mt-2 w-full rounded-2xl bg-gradient-to-r from-[#243FF7] to-[#1a2fd4] p-3.5 text-left go-btn-active shadow-md shadow-[#243FF7]/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 text-[#E2FF04]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-[13px]">Nunca mais se preocupe com vencimento</p>
                  <p className="text-white/80 text-[11px] leading-snug">
                    Ative o cartão recorrente e ganhe <span className="font-bold text-[#E2FF04]">15% de desconto</span> na mensalidade.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
              </div>
            </button>
          </div>
        );
      })()}

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

      {/* Produtos para você */}
      <ProductsSection />
    </div>
  );
}

// Alerta crítico: rastreador sem posicionar há X dias. Informa todo dia,
// permite registrar ciência ("Estou ciente") e ver o histórico de avisos.
function MaintenanceAlert({ vehicle }: { vehicle: any }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const lastSignalMs = vehicle?.lastSignalAt ? new Date(vehicle.lastSignalAt).getTime() : 0;
  const staleDays = lastSignalMs ? Math.floor((Date.now() - lastSignalMs) / (1000 * 60 * 60 * 24)) : 0;

  // O cliente pode fechar o banner. Guardamos o nº de dias em que ele fechou —
  // o aviso reaparece no dia seguinte (contagem maior), sem perder o caráter
  // crítico (push diário e histórico de avisos continuam).
  const dismissKey = `maintDismiss:${vehicle?.id}`;
  const [dismissedDays, setDismissedDays] = useState<number>(() => {
    try { return Number(localStorage.getItem(dismissKey) ?? -1); } catch { return -1; }
  });

  const lastAck = trpc.alerts.lastAck.useQuery(
    { vehicleId: vehicle.id, type: "manutencao" },
    { enabled: staleDays >= 3 },
  );
  const acknowledge = trpc.alerts.acknowledge.useMutation({
    onSuccess: () => {
      utils.alerts.lastAck.invalidate({ vehicleId: vehicle.id, type: "manutencao" });
      utils.alerts.history.invalidate();
      toast.success("Ciência registrada. Obrigado!");
    },
  });
  const dismissLog = trpc.alerts.dismiss.useMutation({
    onSuccess: () => utils.alerts.history.invalidate(),
  });
  const dismiss = () => {
    try { localStorage.setItem(dismissKey, String(staleDays)); } catch { /* ignore */ }
    setDismissedDays(staleDays);
    dismissLog.mutate({ vehicleId: vehicle.id, type: "manutencao", daysStale: staleDays });
  };

  if (staleDays < 3 || staleDays <= dismissedDays) return null;

  const severe = staleDays > 7;
  const box = severe ? "from-red-50 to-orange-50 border-red-200" : "from-amber-50 to-orange-50 border-amber-200";
  const iconBox = severe ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600";
  const h = severe ? "text-red-900" : "text-amber-900";
  const p = severe ? "text-red-700" : "text-amber-700";
  const btn = severe ? "bg-red-500" : "bg-amber-500";

  // Ciência ainda válida se foi dada com o mesmo nº de dias (ou mais recente).
  const ackedAt = lastAck.data?.createdAt ? new Date(lastAck.data.createdAt) : null;
  const ackedRecently = ackedAt && (Date.now() - ackedAt.getTime()) < 36 * 60 * 60 * 1000;

  return (
    <div className="mb-5 stagger-item">
      <div className={`relative w-full rounded-2xl bg-gradient-to-r ${box} border p-4`}>
        <button
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 go-btn-active"
        >
          <X className="w-4 h-4" />
        </button>
        <button onClick={() => setLocation("/vehicle-care")} className="w-full text-left go-btn-active">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 ${iconBox} rounded-xl flex items-center justify-center shrink-0`}>
              <Wrench className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h4 className={`font-bold text-sm ${h}`}>Rastreador há {staleDays} dias sem posicionar</h4>
              <p className={`text-xs ${p} mt-0.5`}>
                {severe
                  ? "Seu veículo pode estar SEM PROTEÇÃO. Recomendamos uma manutenção o quanto antes para voltar a rastrear."
                  : "Faz alguns dias que não recebemos a posição. Pode ser sinal ou energia — vamos verificar juntos?"}
              </p>
            </div>
          </div>
        </button>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setLocation("/vehicle-care")}
            className={`flex-1 text-center text-[13px] font-bold text-white ${btn} rounded-xl py-2.5 go-btn-active`}
          >
            Agendar manutenção
          </button>
          {ackedRecently ? (
            <span className="px-3 flex items-center gap-1 text-[12px] font-semibold text-green-700 bg-green-100 rounded-xl py-2.5">
              <ShieldCheck className="w-4 h-4" /> Ciente
            </span>
          ) : (
            <button
              onClick={() => acknowledge.mutate({ vehicleId: vehicle.id, type: "manutencao", daysStale: staleDays })}
              disabled={acknowledge.isPending}
              className="px-3 text-center text-[12px] font-semibold text-gray-700 bg-white/80 rounded-xl py-2.5 go-btn-active disabled:opacity-60"
            >
              Estou ciente
            </button>
          )}
        </div>

        <button
          onClick={() => setLocation("/alerts-history")}
          className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-medium text-gray-500 go-btn-active"
        >
          <History className="w-3.5 h-3.5" /> Ver histórico de avisos
        </button>
      </div>
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
  const lastReadingAbs = vehicle.lastSignalAt
    ? new Date(vehicle.lastSignalAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  // Tracker freshness — never show "Online" for a stale fix (safety/CS).
  const lastSignalMs = vehicle.lastSignalAt ? new Date(vehicle.lastSignalAt).getTime() : 0;
  const ageMin = lastSignalMs ? (Date.now() - lastSignalMs) / 60000 : Infinity;
  const sig =
    vehicle.trackerStatus !== "online"
      ? { label: "Offline", bg: "bg-red-50", dot: "bg-red-400", text: "text-red-500", stale: true }
      : ageMin > 60 * 24
      ? { label: "Desatualizado", bg: "bg-red-50", dot: "bg-red-400", text: "text-red-500", stale: true }
      : ageMin > 60
      ? { label: "Desatualizado", bg: "bg-amber-50", dot: "bg-amber-500", text: "text-amber-600", stale: true }
      : { label: "Online", bg: "bg-green-50", dot: "bg-green-500 pulse-online", text: "text-green-600", stale: false };

  const isVeh = isVehicleAsset(vehicle.iconType);
  const [, setLocation] = useLocation();

  // Render do modelo (estilo BYD). Some out gracefully se a imagem falhar.
  const [imgOk, setImgOk] = useState(true);
  const imgUrl = getVehicleImageUrl(vehicle);
  const showHero = !!imgUrl && imgOk;

  // Human-readable status headline (communicative, not just raw fields).
  let headline = "Rastreando";
  let dot = "bg-gray-400";
  let htext = "text-gray-500";
  if (isVeh) {
    if (vehicle.blocked) { headline = "Bloqueado"; dot = "bg-amber-500"; htext = "text-amber-600"; }
    else if (vehicle.ignition && (vehicle.speed ?? 0) > 0) { headline = "Em movimento"; dot = "bg-green-500"; htext = "text-green-600"; }
    else if (vehicle.ignition) { headline = "Ligado, parado"; dot = "bg-green-500"; htext = "text-green-600"; }
    else { headline = "Estacionado"; dot = "bg-gray-400"; htext = "text-gray-500"; }
  } else {
    if (vehicle.trackerMode === "active") { headline = "Rastreador ativo"; dot = "bg-green-500"; htext = "text-green-600"; }
    else { headline = "Em repouso"; dot = "bg-gray-400"; htext = "text-gray-500"; }
  }

  const batteryTone = isBatteryCritical ? "danger" : isBatteryWarning ? "warning" : "default";

  return (
    <>
    <button
      onClick={onPress}
      className={`w-full go-card p-5 text-left transition-transform active:scale-[0.99] ${
        isBatteryCritical
          ? "ring-2 ring-red-200 border-red-100"
          : isBatteryWarning
          ? "ring-1 ring-amber-200 border-amber-100"
          : ""
      }`}
    >
      {showHero ? (
        /* Hero estilo app de montadora: render do modelo em destaque */
        <div className="relative mb-3 rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 px-4 py-4 overflow-hidden min-h-[162px]">
          {/* brilho suave atrás do carro */}
          <div className="absolute -right-6 bottom-0 w-56 h-40 bg-white/50 blur-2xl rounded-full pointer-events-none" />
          {/* Render do veículo — protagonista, vazando pela direita */}
          <img
            src={imgUrl!}
            alt={`${vehicle.brand} ${vehicle.model}`}
            onError={() => setImgOk(false)}
            loading="lazy"
            className="absolute right-[-10px] bottom-1 h-[120px] w-auto max-w-[68%] object-contain pointer-events-none z-0 drop-shadow-[0_14px_18px_rgba(15,23,42,0.22)]"
          />
          <div className="relative z-10 flex flex-col justify-between gap-3 min-h-[130px]">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-extrabold text-[#0f172a] text-[16px] leading-tight tracking-tight max-w-[52%] line-clamp-2">
                {vehicle.brand} {vehicle.model}
              </h3>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sig.bg} shadow-sm ring-1 ring-black/[0.03]`}>
                  <div className={`w-2 h-2 rounded-full ${sig.dot}`} />
                  <span className={`text-[11px] font-semibold ${sig.text}`}>{sig.label}</span>
                </div>
                {(isBatteryCritical || isBatteryWarning) && (
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-sm ${
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
            <div className="drop-shadow-sm mb-3">
              {isVeh ? (
                <LicensePlate plate={vehicle.plate} size="md" />
              ) : (
                <AssetTag label={vehicle.plate} size="md" />
              )}
            </div>
          </div>
        </div>
      ) : (
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
                {isVeh ? (
                  <LicensePlate plate={vehicle.plate} size="sm" />
                ) : (
                  <AssetTag label={vehicle.plate} size="sm" />
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${sig.bg}`}>
              <div className={`w-2 h-2 rounded-full ${sig.dot}`} />
              <span className={`text-[11px] font-semibold ${sig.text}`}>{sig.label}</span>
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
      )}

      {/* Status — honesto sobre o frescor dos dados */}
      <div className="mt-3.5 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${sig.stale ? "text-gray-500" : htext}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sig.stale ? "bg-gray-400" : dot} ${!sig.stale && dot === "bg-green-500" ? "pulse-online" : ""}`} />
          {sig.stale ? "Sem comunicação recente" : headline}
        </span>
        {!sig.stale && isVeh && (vehicle.speed ?? 0) > 0 && (
          <span className="text-[12px] text-gray-400 font-medium">• {vehicle.speed} km/h</span>
        )}
      </div>

      {/* Quando desatualizado: deixa claro que os números abaixo são da última leitura */}
      {sig.stale && lastReadingAbs && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Valores da última comunicação · {lastReadingAbs}</span>
        </div>
      )}

      {/* Key metrics — asset-aware, esmaecidos quando os dados estão velhos */}
      <div className={`mt-3 grid grid-cols-3 gap-2 ${sig.stale ? "opacity-75" : ""}`}>
        {isVeh ? (
          <>
            <Metric icon={Gauge} label="Velocidade" value={`${vehicle.speed ?? 0}`} unit="km/h" muted={sig.stale} />
            <Metric icon={Power} label="Ignição" value={vehicle.ignition ? "Ligada" : "Off"} muted={sig.stale} />
            <Metric icon={Battery} label="Bateria"
              value={batteryMain > 0 ? batteryMain.toFixed(1) : "—"} unit={batteryMain > 0 ? "V" : undefined}
              tone={sig.stale ? "default" : batteryTone} muted={sig.stale} />
          </>
        ) : (
          <>
            <Metric icon={Battery} label="Bateria" value={`${vehicle.batteryLevel ?? 100}`} unit="%"
              tone={sig.stale ? "default" : ((vehicle.batteryLevel ?? 100) < 20 ? "danger" : (vehicle.batteryLevel ?? 100) < 40 ? "warning" : "default")} muted={sig.stale} />
            <Metric icon={Signal} label="Sinal GPS" value={`${vehicle.gpsSatellites ?? 0}`} unit="sat" muted={sig.stale} />
            <Metric icon={Wifi} label="Conexão" value={vehicle.trackerMode === "active" ? "Ativo" : "Repouso"} muted={sig.stale} />
          </>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2 text-gray-400">
        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-gray-400 leading-none mb-0.5">
            {sig.stale ? "Última localização conhecida" : "Localização atual"}
          </p>
          <span className="text-[12px] text-gray-500 line-clamp-2 leading-tight block">
            {vehicle.lastAddress || "Localização não disponível"}
          </span>
        </div>
      </div>

      {/* Ver mais sobre meu veículo (somente veículos) */}
      {isVeh && (
        <span
          onClick={(e) => { e.stopPropagation(); setLocation(`/vehicle/${vehicle.id}`); }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#243FF7] bg-[#243FF7]/[0.06] rounded-xl py-2.5 go-btn-active"
        >
          <Info className="w-3.5 h-3.5" /> Ver mais sobre meu veículo
        </span>
      )}

      {/* Clear call-to-action */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className={`text-[11px] font-medium ${sig.stale ? sig.text : "text-gray-400"}`}>
          {sig.stale ? `Sem atualização ${timeSinceSignal}` : `Atualizado ${timeSinceSignal}`}
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#243FF7] bg-[#243FF7]/8 rounded-full pl-3.5 pr-3 py-1.5">
          Ver no mapa
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </button>
    </>
  );
}

function Metric({ icon: Icon, label, value, unit, tone = "default", muted = false }: {
  icon: any; label: string; value: string; unit?: string; tone?: "default" | "warning" | "danger"; muted?: boolean;
}) {
  const text = muted ? "text-gray-500" : tone === "danger" ? "text-red-600" : tone === "warning" ? "text-amber-600" : "text-[#111111]";
  const ic = muted ? "text-gray-400" : tone === "danger" ? "text-red-500" : tone === "warning" ? "text-amber-500" : "text-[#243FF7]";
  return (
    <div className="bg-gray-50 rounded-xl px-2.5 py-2.5">
      <Icon className={`w-4 h-4 ${ic} mb-1.5`} />
      <p className="text-[10px] text-gray-400 font-medium leading-none mb-1">{label}</p>
      <p className={`text-[13px] font-bold leading-none ${text}`}>
        {value}{unit ? <span className="text-[10px] font-medium text-gray-400"> {unit}</span> : null}
      </p>
    </div>
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

const PRODUCT_CATEGORIES = [
  { key: "rastreador", label: "Rastreador", icon: MapPin },
  { key: "financas", label: "Finanças", icon: Wallet },
  { key: "seguros", label: "Seguros", icon: Shield },
  { key: "pravoce", label: "Pra Você", icon: Heart },
  { key: "veiculo", label: "Veículo", icon: Car },
  { key: "residencial", label: "Residencial", icon: HomeIcon },
  { key: "servicos", label: "Serviços", icon: Headphones },
  { key: "beneficios", label: "Benefícios", icon: Gift },
];

const CAT_COLOR: Record<string, { bg: string; text: string }> = {
  rastreador: { bg: "bg-[#243FF7]/10", text: "text-[#243FF7]" },
  financas: { bg: "bg-emerald-50", text: "text-emerald-600" },
  seguros: { bg: "bg-indigo-50", text: "text-indigo-600" },
  pravoce: { bg: "bg-rose-50", text: "text-rose-600" },
  veiculo: { bg: "bg-sky-50", text: "text-sky-600" },
  residencial: { bg: "bg-violet-50", text: "text-violet-600" },
  servicos: { bg: "bg-teal-50", text: "text-teal-600" },
  beneficios: { bg: "bg-amber-50", text: "text-amber-600" },
};

const PRODUCTS: Array<{ id: string; cat: string; title: string; subtitle: string; icon: any; badge?: string }> = [
  // Rastreador
  { id: "rast-auto", cat: "rastreador", title: "Rastreador Auto", subtitle: "Rastreamento para seu carro", icon: Car },
  { id: "rast-pet", cat: "rastreador", title: "Rastreador Pet", subtitle: "Localize seu pet em tempo real", icon: PawPrint, badge: "NOVO" },
  { id: "rast-apps", cat: "rastreador", title: "Rastreador Aplicativos", subtitle: "Para motoristas de app (Uber/99)", icon: Smartphone },
  { id: "rast-moto", cat: "rastreador", title: "Rastreador Moto", subtitle: "Sem consumir a bateria da moto", icon: Bike, badge: "SEM BATERIA" },
  { id: "rast-frotas", cat: "rastreador", title: "Rastreador Frotas", subtitle: "Gestão de vários veículos", icon: Truck },
  { id: "rast-bike", cat: "rastreador", title: "Rastreador Bike", subtitle: "Proteção para sua bicicleta", icon: Bike },
  { id: "rast-eletricos", cat: "rastreador", title: "Rastreador Elétricos", subtitle: "Patinetes e veículos elétricos", icon: Zap },
  { id: "rast-nautico", cat: "rastreador", title: "Rastreador Náutico", subtitle: "Barcos, lanchas e jet skis", icon: Anchor },
  { id: "rast-musica", cat: "rastreador", title: "Rastreador Música", subtitle: "Proteja seus instrumentos", icon: Music },
  { id: "rast-equipamentos", cat: "rastreador", title: "Rastreador Equipamentos", subtitle: "Máquinas e equipamentos", icon: Package },
  { id: "rast-implementos", cat: "rastreador", title: "Rastreador Implementos", subtitle: "Carretinhas e implementos", icon: Caravan },
  // Finanças
  { id: "credito-clt", cat: "financas", title: "Crédito CLT", subtitle: "Antecipe seu salário com taxa baixa", icon: DollarSign },
  { id: "antecipacao-fgts", cat: "financas", title: "Antecipação FGTS", subtitle: "Receba seu saque-aniversário adiantado", icon: Wallet },
  { id: "consorcio", cat: "financas", title: "Consórcio", subtitle: "Realize seus planos sem juros", icon: Users },
  { id: "financiamento-veicular", cat: "financas", title: "Financiamento Veicular", subtitle: "Financie seu veículo com as melhores taxas", icon: Car },
  { id: "financiamento-imobiliario", cat: "financas", title: "Financiamento Imobiliário", subtitle: "Conquiste seu imóvel", icon: Building2 },
  // Seguros
  { id: "seguro-auto", cat: "seguros", title: "Seguro Auto", subtitle: "Proteção completa para seu veículo", icon: Shield },
  { id: "seguro-celular", cat: "seguros", title: "Seguro Celular", subtitle: "Cobertura contra roubo e quebra", icon: Phone },
  // Pra Você
  { id: "plano-familia", cat: "pravoce", title: "Plano Família GO", subtitle: "Proteja todos os bens da família", icon: Users },
  { id: "cashback", cat: "pravoce", title: "Cashback GO", subtitle: "Dinheiro de volta nas suas compras", icon: Wallet, badge: "NOVO" },
  { id: "ofertas-personalizadas", cat: "pravoce", title: "Ofertas pra você", subtitle: "Selecionadas com base no seu perfil", icon: Heart },
  // Veículo
  { id: "plano-premium", cat: "veiculo", title: "Plano Premium", subtitle: "Mais cobertura e benefícios", icon: Car },
  { id: "manutencao", cat: "veiculo", title: "Revisão & Manutenção", subtitle: "Rede de oficinas parceiras", icon: Wrench },
  // Residencial
  { id: "seguro-residencial", cat: "residencial", title: "Seguro Residencial", subtitle: "Sua casa protegida a partir de R$29/mês", icon: HomeIcon },
  { id: "monitoramento-casa", cat: "residencial", title: "Monitoramento 24h", subtitle: "Câmeras e alarme para sua casa", icon: Lock },
  // Serviços
  { id: "telemedicina", cat: "servicos", title: "Telemedicina 24h", subtitle: "Consultas para toda a família", icon: Heart, badge: "SAÚDE" },
  { id: "assistencia-24h", cat: "servicos", title: "Assistência 24h", subtitle: "Guincho, chaveiro e mais", icon: Headphones },
  // Benefícios
  { id: "indique-ganhe", cat: "beneficios", title: "Indique e Ganhe", subtitle: "R$50 por cada amigo que assinar", icon: Users, badge: "R$50" },
  { id: "clube-descontos", cat: "beneficios", title: "Clube de Descontos", subtitle: "Ofertas exclusivas para você", icon: Gift },
];

function ProductsSection() {
  const [openCat, setOpenCat] = useState<string | null>(null);
  const items = openCat ? PRODUCTS.filter((p) => p.cat === openCat) : [];

  return (
    <div className="mt-8">
      <h2 className="text-[13px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Produtos GO para você
      </h2>

      {/* Category tabs — tap to expand the cards below */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 mb-3">
        {PRODUCT_CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = openCat === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setOpenCat(active ? null : c.key)}
              className={`flex items-center gap-1.5 shrink-0 pl-2.5 pr-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all go-btn-active ${
                active ? "bg-[#243FF7] text-white shadow-md shadow-[#243FF7]/20" : "bg-white border border-gray-100 text-gray-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Product cards — only when a category is open */}
      <div className="space-y-2.5">
        {items.map((p) => {
          const Icon = p.icon;
          const c = CAT_COLOR[p.cat] || CAT_COLOR.veiculos;
          return (
            <button
              key={p.id}
              onClick={() => toast.info(`${p.title} — em breve! Avisaremos quando lançar. 🚀`)}
              className="w-full go-card p-4 flex items-center gap-3.5 text-left go-btn-active animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${c.bg}`}>
                <Icon className={`w-5 h-5 ${c.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#111111] text-sm truncate">{p.title}</p>
                  {p.badge && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#E2FF04] text-[#111111] shrink-0">{p.badge}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{p.subtitle}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
