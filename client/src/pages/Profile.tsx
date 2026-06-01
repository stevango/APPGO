import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  ChevronLeft, User, Car, CreditCard, Shield, Bell,
  HelpCircle, FileText, LogOut, ChevronRight, Gauge, Check, Globe, Receipt, Trash2, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLanguage, LANGUAGE_LABELS, type Language } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function Profile() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const [showSpeedConfig, setShowSpeedConfig] = useState(false);
  const [showLanguageConfig, setShowLanguageConfig] = useState(false);
  const [speedLimit, setSpeedLimit] = useState<number>(120);
  const [speedSaving, setSpeedSaving] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe, isSupported } = usePushNotifications();
  const [showPushConfig, setShowPushConfig] = useState(false);

  const utils = trpc.useUtils();
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Sua conta foi excluída.");
      await utils.auth.me.invalidate();
    },
    onError: () => {
      toast.error("Não foi possível excluir a conta. Tente novamente.");
    },
  });

  const setSpeedLimitMutation = trpc.vehicles.setSpeedLimit.useMutation({
    onSuccess: () => {
      toast.success("Limite de velocidade atualizado!");
      setShowSpeedConfig(false);
      setSpeedSaving(false);
    },
    onError: () => {
      toast.error("Erro ao salvar limite de velocidade");
      setSpeedSaving(false);
    },
  });

  const planLabels: Record<string, string> = {
    basico: "Básico",
    intermediario: "Intermediário",
    premium: "Premium",
    empresarial: "Empresarial",
  };
  const userPlan = planLabels[(user as Record<string, any>)?.plan || "basico"] || "Básico";

  const vehicle = vehicles?.[0];

  function handleOpenSpeedConfig() {
    if (vehicle) {
      setSpeedLimit(vehicle.speedLimit || 120);
      setShowSpeedConfig(true);
    }
  }

  function handleSaveSpeedLimit() {
    if (!vehicle) return;
    setSpeedSaving(true);
    setSpeedLimitMutation.mutate({
      vehicleId: vehicle.id,
      speedLimit,
    });
  }

  const menuItems = [
    { icon: Car, label: t("my_vehicles"), sublabel: `${vehicles?.length || 0} veículo(s)`, action: () => setLocation("/vehicles") },
    { icon: Gauge, label: "Limite de velocidade", sublabel: `${vehicle?.speedLimit || 120} km/h`, action: handleOpenSpeedConfig },
    { icon: Globe, label: t("language"), sublabel: LANGUAGE_LABELS[language], action: () => setShowLanguageConfig(true) },
    { icon: CreditCard, label: "Pagamento", sublabel: "Alterar forma de pagamento", action: () => setLocation("/payment") },
    { icon: Receipt, label: "Faturas", sublabel: "Histórico e 2ª via de boleto", action: () => setLocation("/payment/history") },
    { icon: Shield, label: "Segurança", sublabel: "Senha, Face ID", action: () => {} },
    { icon: Bell, label: t("notifications"), sublabel: isSubscribed ? "Push ativo" : "Configurar alertas", action: () => setShowPushConfig(true) },
    { icon: HelpCircle, label: "Central de atendimento", sublabel: "Fale conosco", action: () => {} },
    { icon: FileText, label: "Termos e privacidade", sublabel: "Documentos legais", action: () => {} },
  ];

  const speedPresets = [60, 80, 100, 120, 140, 160];

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setLocation("/")} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Meu Perfil</h1>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#243FF7] rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#111111]">{user?.name || "Usuário"}</h2>
            <p className="text-sm text-gray-500">{user?.email || ""}</p>
            <div className="mt-1 inline-flex items-center gap-1 bg-[#243FF7]/10 px-2 py-0.5 rounded-full">
              <span className="text-[10px] font-semibold text-[#243FF7]">GO ID</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Summary */}
      {vehicle && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 mb-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Veículo principal</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-[#243FF7]" />
            </div>
            <div>
              <p className="font-semibold text-sm text-[#111111]">
                {vehicle.brand} {vehicle.model}
              </p>
              <p className="text-xs text-gray-500 font-mono">{vehicle.plate}</p>
            </div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`w-full flex items-center gap-3 px-4 py-4 text-left go-btn-active ${
              index < menuItems.length - 1 ? "border-b border-gray-50" : ""
            }`}
          >
            <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center">
              <item.icon className="w-4.5 h-4.5 text-[#343C42]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#111111]">{item.label}</p>
              <p className="text-xs text-gray-400">{item.sublabel}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        ))}
      </div>

      {/* Logout */}
      <Button
        variant="outline"
        className="w-full h-12 border-red-200 text-red-500 font-medium rounded-xl go-btn-active"
        onClick={() => logout()}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sair da conta
      </Button>

      {/* Delete account (LGPD / app store requirement) */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="w-full mt-3 text-center text-xs text-gray-400 underline underline-offset-4 go-btn-active">
            Excluir minha conta
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Excluir conta permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os seus dados — veículos, trajetos,
              cercas, contatos de emergência, faturas e notificações — serão
              apagados definitivamente. Tem certeza?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAccountMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAccountMutation.isPending}
              onClick={(e) => { e.preventDefault(); deleteAccountMutation.mutate(); }}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sim, excluir tudo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* App Version */}
      <p className="text-center text-xs text-gray-300 mt-6">
        GO Direction v1.0.0
      </p>

      {/* Language Selection Sheet */}
      {showLanguageConfig && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowLanguageConfig(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-[#243FF7]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111111]">{t("language")}</h3>
                <p className="text-xs text-gray-500">Selecione o idioma do app</p>
              </div>
            </div>
            <div className="space-y-2">
              {(["pt", "en", "es"] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setLanguage(lang); setShowLanguageConfig(false); toast.success(LANGUAGE_LABELS[lang]); }}
                  className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all go-btn-active ${
                    language === lang
                      ? "bg-[#243FF7]/10 border-2 border-[#243FF7]"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  <span className="text-2xl">
                    {lang === "pt" ? "🇧🇷" : lang === "en" ? "🇺🇸" : "🇪🇸"}
                  </span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-[#111111]">{LANGUAGE_LABELS[lang]}</p>
                    <p className="text-xs text-gray-400">
                      {lang === "pt" ? "Português do Brasil" : lang === "en" ? "United States English" : "Español Latinoamérica"}
                    </p>
                  </div>
                  {language === lang && (
                    <Check className="w-5 h-5 text-[#243FF7]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Push Notifications Configuration Sheet */}
      {showPushConfig && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowPushConfig(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#243FF7]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Notificações Push</h3>
                <p className="text-xs text-gray-500">Receba alertas no celular em tempo real</p>
              </div>
            </div>

            {!isSupported ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-amber-800 font-medium">Navegador não suportado</p>
                <p className="text-xs text-amber-600 mt-1">Seu navegador não suporta notificações push. Use Chrome, Firefox ou Edge.</p>
              </div>
            ) : permission === "denied" ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-red-800 font-medium">Permissão bloqueada</p>
                <p className="text-xs text-red-600 mt-1">Você bloqueou as notificações. Para reativar, acesse as configurações do navegador e permita notificações para este site.</p>
              </div>
            ) : (
              <>
                <div className="bg-gray-50 rounded-2xl p-5 mb-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-semibold text-[#111111]">Push Notifications</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isSubscribed ? "Ativo - você receberá alertas" : "Desativado"}
                      </p>
                    </div>
                    <div className={`w-12 h-7 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
                      isSubscribed ? "bg-[#243FF7]" : "bg-gray-300"
                    }`} onClick={() => isSubscribed ? unsubscribe() : subscribe()}>
                      <div className={`w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        isSubscribed ? "translate-x-5" : "translate-x-0"
                      }`} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">🔋</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#111111]">Bateria baixa</p>
                        <p className="text-[10px] text-gray-400">Alerta quando bateria &lt; 20%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">⚡</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#111111]">Velocidade excessiva</p>
                        <p className="text-[10px] text-gray-400">Alerta ao ultrapassar o limite</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm">📍</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-[#111111]">Cerca eletrônica</p>
                        <p className="text-[10px] text-gray-400">Alerta ao sair/entrar na área</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className={`w-full h-12 font-semibold rounded-xl go-btn-active ${
                    isSubscribed
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-[#243FF7] hover:bg-[#1a2fd6] text-white"
                  }`}
                  onClick={() => isSubscribed ? unsubscribe() : subscribe()}
                  disabled={pushLoading}
                >
                  {pushLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processando...
                    </span>
                  ) : isSubscribed ? (
                    "Desativar notificações"
                  ) : (
                    "Ativar notificações push"
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Speed Limit Configuration Sheet */}
      {showSpeedConfig && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSpeedConfig(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
            {/* Handle */}
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                <Gauge className="w-5 h-5 text-[#243FF7]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Limite de Velocidade</h3>
                <p className="text-xs text-gray-500">Receba alertas ao ultrapassar o limite</p>
              </div>
            </div>

            {/* Speed Display */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-5 text-center">
              <p className="text-5xl font-bold text-[#111111]">
                {speedLimit}
                <span className="text-lg font-normal text-gray-400 ml-1">km/h</span>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {speedLimit <= 60 ? "Zona urbana" : speedLimit <= 100 ? "Rodovia estadual" : speedLimit <= 120 ? "Rodovia federal" : "Velocidade alta"}
              </p>
            </div>

            {/* Slider */}
            <div className="mb-5">
              <input
                type="range"
                min={20}
                max={200}
                step={5}
                value={speedLimit}
                onChange={(e) => setSpeedLimit(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#243FF7]"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-gray-400">20 km/h</span>
                <span className="text-[10px] text-gray-400">200 km/h</span>
              </div>
            </div>

            {/* Presets */}
            <div className="grid grid-cols-6 gap-2 mb-6">
              {speedPresets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSpeedLimit(preset)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all go-btn-active ${
                    speedLimit === preset
                      ? "bg-[#243FF7] text-white shadow-md shadow-[#243FF7]/30"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Save Button */}
            <Button
              className="w-full h-12 bg-[#243FF7] hover:bg-[#1a2fd6] text-white font-semibold rounded-xl go-btn-active"
              onClick={handleSaveSpeedLimit}
              disabled={speedSaving}
            >
              {speedSaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Salvar limite
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
