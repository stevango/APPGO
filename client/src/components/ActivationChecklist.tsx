import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, Phone, Shield, Check, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * Checklist de ativação (onboarding leve, não-bloqueante): incentiva os 3
 * passos que mais elevam retenção/segurança — notificações, contato de
 * emergência e a primeira cerca. Some sozinho quando tudo está feito ou se o
 * usuário fechar.
 */
export default function ActivationChecklist() {
  const [, setLocation] = useLocation();
  const { isSupported, isSubscribed, isLoading, subscribe, permission } = usePushNotifications();

  const activatePush = async () => {
    if (permission === "denied") {
      toast.error("Notificações bloqueadas. Vamos ver como reativar.");
      setLocation("/profile");
      return;
    }
    const ok = await subscribe();
    if (ok) toast.success("Notificações ativadas! 🔔");
    else {
      // No iOS precisa instalar o app; sem VAPID/suporte também cai aqui.
      toast("Vamos configurar suas notificações no Perfil.");
      setLocation("/profile");
    }
  };
  const contacts = trpc.emergencyContacts.list.useQuery();
  const geos = trpc.geofences.list.useQuery();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("go-activation-dismissed") === "1"; } catch { return false; }
  });

  if (dismissed || contacts.isLoading || geos.isLoading) return null;

  const pushDone = !isSupported || isSubscribed;
  const hasContact = (contacts.data?.length ?? 0) > 0;
  const hasGeo = (geos.data?.length ?? 0) > 0;

  const steps = [
    !pushDone && { key: "push", icon: Bell, label: isLoading ? "Ativando..." : "Ativar notificações", desc: "Alertas em tempo real", action: activatePush },
    !hasContact && { key: "contact", icon: Phone, label: "Contato de emergência", desc: "Acionado num SOS", action: () => setLocation("/emergency-contacts") },
    !hasGeo && { key: "geo", icon: Shield, label: "Criar 1ª cerca", desc: "Aviso ao sair/entrar de uma área", action: () => setLocation("/geofences") },
  ].filter(Boolean) as Array<{ key: string; icon: any; label: string; desc: string; action: () => void }>;

  if (steps.length === 0) return null;
  const done = 3 - steps.length;

  const close = () => {
    try { localStorage.setItem("go-activation-dismissed", "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="mb-4 go-card p-4 relative">
      <button onClick={close} aria-label="Fechar" className="absolute top-3 right-3 p-1 text-gray-300 hover:text-gray-500 go-btn-active">
        <X className="w-4 h-4" />
      </button>
      <h3 className="text-sm font-bold text-[#111111]">Configure seu GO</h3>
      <p className="text-[11px] text-gray-400 mb-3">{done} de 3 concluídos · leva 1 minuto</p>
      <div className="space-y-2">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={s.action} className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 go-btn-active text-left">
              <div className="w-8 h-8 rounded-lg bg-[#243FF7]/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[#243FF7]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111111] leading-tight">{s.label}</p>
                <p className="text-[11px] text-gray-400">{s.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
