import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ChevronLeft, Bell, BellRing, Mail, MessageSquare, Smartphone, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const channelMeta: Record<string, { label: string; icon: any; color: string }> = {
  push: { label: "Push", icon: BellRing, color: "#243FF7" },
  inapp: { label: "No app", icon: Bell, color: "#6366F1" },
  email: { label: "E-mail", icon: Mail, color: "#0EA5E9" },
  sms: { label: "SMS", icon: Smartphone, color: "#10B981" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "#22C55E" },
};

const severityMeta: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Crítico", color: "#DC2626", bg: "#FEE2E2" },
  warning: { label: "Atenção", color: "#D97706", bg: "#FEF3C7" },
  info: { label: "Info", color: "#2563EB", bg: "#DBEAFE" },
};

export default function AlertsHistory() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.alerts.history.useQuery();

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => setLocation("/notifications")} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Histórico de avisos</h1>
      </div>
      <p className="text-xs text-gray-500 mb-5 ml-9">
        Registro de todos os avisos que enviamos a você, com data, hora e canal.
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
              <Skeleton className="w-40 h-4 mb-2" />
              <Skeleton className="w-56 h-3" />
            </div>
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((log: any) => {
            const ch = channelMeta[log.channel] || channelMeta.inapp;
            const sev = severityMeta[log.severity] || severityMeta.info;
            const isAck = String(log.type).endsWith("_ciente");
            const Icon = isAck ? ShieldCheck : ch.icon;
            return (
              <div key={log.id} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isAck ? "#DCFCE7" : `${ch.color}15` }}
                  >
                    <Icon className="w-4.5 h-4.5" style={{ color: isAck ? "#16A34A" : ch.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-[#111111]">{log.title || ch.label}</h3>
                      {!isAck && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{ color: sev.color, backgroundColor: sev.bg }}
                        >
                          {sev.label}
                        </span>
                      )}
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {isAck ? "Ciência" : ch.label}
                      </span>
                      {log.delivered === false && !isAck && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                          não entregue
                        </span>
                      )}
                    </div>
                    {log.message && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-3">{log.message}</p>
                    )}
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      {new Date(log.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                        hour: "2-digit", minute: "2-digit",
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
          <h3 className="font-semibold text-gray-700 mb-1">Nenhum aviso ainda</h3>
          <p className="text-sm text-gray-400 text-center">
            O histórico de avisos enviados aparecerá aqui.
          </p>
        </div>
      )}
    </div>
  );
}
