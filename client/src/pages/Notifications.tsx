import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronLeft, Bell, Shield, Lock, AlertTriangle,
  Battery, Zap, Wifi, CheckCheck, Gauge, Wrench, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ErrorState from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

const typeIcons: Record<string, any> = {
  cerca_entrada: Shield,
  cerca_saida: Shield,
  bloqueio: Lock,
  desbloqueio: Lock,
  sos: AlertTriangle,
  bateria_baixa: Battery,
  velocidade_excessiva: Gauge,
  "ignição_ligada": Zap,
  "ignição_desligada": Zap,
  offline: Wifi,
  manutencao: Wrench,
  furto_roubo: AlertTriangle,
  sistema: Bell,
};

const typeColors: Record<string, string> = {
  cerca_entrada: "#243FF7",
  cerca_saida: "#F97316",
  bloqueio: "#EF4444",
  desbloqueio: "#10B981",
  sos: "#DC2626",
  bateria_baixa: "#EAB308",
  velocidade_excessiva: "#EF4444",
  "ignição_ligada": "#10B981",
  "ignição_desligada": "#6B7280",
  offline: "#EF4444",
  manutencao: "#EF4444",
  furto_roubo: "#DC2626",
  sistema: "#243FF7",
};

export default function Notifications() {
  const [, setLocation] = useLocation();
  const { data: notifications, isLoading, isError, refetch, isRefetching } = trpc.notifications.list.useQuery();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
    },
  });
  const utils = trpc.useUtils();

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  return (
    <div className="px-4 pb-4">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-4 bg-[#F5F6FA]/90 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="go-btn-active" aria-label="Voltar">
            <ChevronLeft className="w-6 h-6 text-[#343C42]" />
          </button>
          <h1 className="text-lg font-bold text-[#111111]">Notificações</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 text-xs font-medium"
            onClick={() => setLocation("/alerts-history")}
          >
            <History className="w-4 h-4 mr-1" />
            Histórico
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[#243FF7] text-xs font-medium"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="w-32 h-4 mb-1" />
                  <Skeleton className="w-48 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Erro ao carregar notificações"
          onRetry={() => refetch()}
          retrying={isRefetching}
        />
      ) : notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification: any) => {
            const Icon = typeIcons[notification.type] || Bell;
            const color = typeColors[notification.type] || "#243FF7";
            return (
              <div
                key={notification.id}
                className={`bg-white rounded-xl p-4 border transition-colors ${
                  notification.read ? "border-gray-100" : "border-[#243FF7]/20 bg-[#243FF7]/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-semibold ${notification.read ? "text-gray-700" : "text-[#111111]"}`}>
                        {notification.title}
                      </h3>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-[#243FF7] rounded-full shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {new Date(notification.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-1">Nenhuma notificação</h3>
          <p className="text-sm text-gray-400 text-center">
            Seus alertas aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
}
