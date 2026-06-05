import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  ChevronLeft, User, Car, CreditCard, Shield, Bell,
  HelpCircle, FileText, LogOut, ChevronRight, Gauge, Check, Globe, Receipt, Trash2, Loader2, Sparkles, Star, FileSignature, MapPin, Route, Images
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressSearch } from "@/components/AddressSearch";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useLanguage, LANGUAGE_LABELS, type Language } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useActiveVehicleId, pickActiveVehicle } from "@/lib/activeVehicle";
import { isVehicleAsset } from "@/lib/assetIcons";

type RetentionReason = {
  key: string; label: string; offerTitle: string; offerDesc: string; accept: string; support?: boolean;
};

// Cancellation save flow — reason → tailored offer (retain) or proceed to delete.
const RETENTION_REASONS: RetentionReason[] = [
  { key: "caro", label: "Está caro pra mim", offerTitle: "30% de desconto por 3 meses", offerDesc: "Queremos manter você protegido. Que tal 30% OFF nos próximos 3 meses para continuar com a gente?", accept: "Quero o desconto" },
  { key: "nao_uso", label: "Não estou usando", offerTitle: "Pause sua assinatura", offerDesc: "Você pode pausar por até 3 meses sem perder seus dados — e voltar quando quiser.", accept: "Quero pausar" },
  { key: "tecnico", label: "Tive um problema técnico", offerTitle: "A gente resolve pra você", offerDesc: "A maioria dos problemas se resolve em minutos com o nosso time. Vamos tentar juntos?", accept: "Falar com suporte", support: true },
  { key: "trocar", label: "Vou trocar de empresa", offerTitle: "Deixe a gente fazer uma proposta", offerDesc: "Temos condições especiais de fidelidade. Antes de decidir, que tal ouvir nossa proposta?", accept: "Ver proposta", support: true },
  { key: "outro", label: "Outro motivo", offerTitle: "Queremos te entender", offerDesc: "Conte com a gente para encontrar a melhor solução pra você.", accept: "Falar com a gente", support: true },
];

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
  const testPush = trpc.push.test.useMutation({
    onSuccess: (res) => {
      if (res.sent > 0) toast.success("Push enviado! Confira suas notificações.");
      else toast.error("Nenhum dispositivo recebeu. Verifique as chaves VAPID no servidor.");
    },
    onError: () => toast.error("Falha ao enviar push de teste."),
  });

  const [showAddress, setShowAddress] = useState(false);
  const userAddress = (user as Record<string, any>)?.address as string | undefined;

  const [showRetention, setShowRetention] = useState(false);
  const [retStep, setRetStep] = useState<"reason" | "offer" | "confirm">("reason");
  const [retReason, setRetReason] = useState<RetentionReason | null>(null);
  const retentionMutation = trpc.retention.logEvent.useMutation();

  const openRetention = () => { setRetReason(null); setRetStep("reason"); setShowRetention(true); };
  const chooseReason = (r: RetentionReason) => {
    setRetReason(r);
    setRetStep("offer");
    retentionMutation.mutate({ reason: r.key, action: "offer_shown", offer: r.offerTitle });
  };
  const acceptOffer = () => {
    if (!retReason) return;
    if (retReason.support) {
      retentionMutation.mutate({ reason: retReason.key, action: "support" });
      setShowRetention(false);
      setLocation("/help");
      return;
    }
    retentionMutation.mutate({ reason: retReason.key, action: "offer_accepted", offer: retReason.offerTitle });
    toast.success("Que bom que você fica! 💙 Nossa equipe vai cuidar disso.");
    setShowRetention(false);
  };
  const confirmDelete = () => {
    retentionMutation.mutate({ reason: retReason?.key, action: "cancelled" });
    deleteAccountMutation.mutate();
  };

  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const feedbackMutation = trpc.feedback.submit.useMutation({
    onSuccess: () => setFeedbackSent(true),
    onError: () => toast.error("Não foi possível enviar. Tente novamente."),
  });

  // iPhone só permite Web Push quando o app é instalado na Tela de Início (PWA).
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);
  const iosNeedsInstall = isIOS && !isStandalone;

  const utils = trpc.useUtils();
  const setAddressMutation = trpc.account.setAddress.useMutation({
    onSuccess: async () => {
      toast.success("Endereço salvo!");
      await utils.auth.me.invalidate();
      setShowAddress(false);
    },
    onError: () => toast.error("Não foi possível salvar o endereço."),
  });
  const deleteAccountMutation = trpc.account.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Sua conta foi excluída.");
      await utils.auth.me.invalidate();
    },
    onError: () => {
      toast.error("Não foi possível excluir a conta. Tente novamente.");
    },
  });

  const go360Status = trpc.go360.status.useQuery();
  const demoStatus = trpc.demo.status.useQuery();
  const enableDemo = trpc.demo.enable.useMutation({
    onSuccess: async () => {
      toast.success("Modo demonstração ativado! Veja em Rastrear.");
      await Promise.all([utils.demo.status.invalidate(), utils.vehicles.list.invalidate()]);
    },
    onError: () => toast.error("Não foi possível ativar a demonstração."),
  });
  const disableDemo = trpc.demo.disable.useMutation({
    onSuccess: async () => {
      toast.success("Modo demonstração desativado.");
      await Promise.all([utils.demo.status.invalidate(), utils.vehicles.list.invalidate()]);
    },
    onError: () => toast.error("Não foi possível desativar a demonstração."),
  });
  const demoEnabled = demoStatus.data?.enabled ?? false;
  const demoPending = enableDemo.isPending || disableDemo.isPending;

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

  // Speed limit applies to the ACTIVE equipment (the one selected on Home),
  // and only makes sense for vehicles.
  const activeId = useActiveVehicleId();
  const vehicle = pickActiveVehicle(vehicles, activeId);
  const speedLimitApplies = isVehicleAsset(vehicle?.iconType);

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
    { icon: Car, label: t("my_vehicles"), sublabel: `${vehicles?.length || 0} equipamento(s)`, action: () => setLocation("/vehicles") },
    ...(speedLimitApplies
      ? [{ icon: Gauge, label: "Limite de velocidade", sublabel: `${vehicle?.model || "Veículo"} • ${vehicle?.speedLimit || 120} km/h`, action: handleOpenSpeedConfig }]
      : []),
    { icon: Globe, label: t("language"), sublabel: LANGUAGE_LABELS[language], action: () => setShowLanguageConfig(true) },
    { icon: CreditCard, label: "Pagamento", sublabel: "Alterar forma de pagamento", action: () => setLocation("/payment") },
    { icon: Receipt, label: "Faturas", sublabel: "Histórico e 2ª via de boleto", action: () => setLocation("/payment/history") },
    { icon: Shield, label: "Segurança", sublabel: "Senha, Face ID", action: () => {} },
    { icon: Bell, label: t("notifications"), sublabel: isSubscribed ? "Push ativo" : "Configurar alertas", action: () => setShowPushConfig(true) },
    ...(go360Status.data?.enabled
      ? [{ icon: Route, label: "Minha jornada", sublabel: "Acompanhe sua implantação", action: () => setLocation("/jornada") }]
      : []),
    { icon: MapPin, label: "Meu endereço", sublabel: userAddress ? userAddress : "Adicionar endereço", action: () => setShowAddress(true) },
    { icon: FileSignature, label: "Meu contrato", sublabel: "Visualizar e assinar (DocuSign)", action: () => setLocation("/contract") },
    { icon: Sparkles, label: "Central de Ajuda", sublabel: "Tire dúvidas com a assistente GO", action: () => setLocation("/help") },
    { icon: Star, label: "Avaliar o app", sublabel: "Dê sua nota e sugestões", action: () => setShowFeedback(true) },
    { icon: FileText, label: "Termos e privacidade", sublabel: "Documentos legais e histórico de aceite", action: () => setLocation("/legal") },
    ...((user as Record<string, any>)?.role === "admin"
      ? [{ icon: Images, label: "Biblioteca de imagens", sublabel: "Curadoria de fotos por montadora/modelo", action: () => setLocation("/admin/vehicle-images") }]
      : []),
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
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Equipamento principal</h3>
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

      {/* Modo demonstração */}
      <div className="bg-gradient-to-r from-[#243FF7] to-[#1a2fd4] rounded-2xl p-4 mb-4 shadow-lg shadow-[#243FF7]/20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#E2FF04]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Modo demonstração</p>
            <p className="text-white/70 text-xs leading-snug">
              Veículo simulado andando no mapa em tempo real, com rota, alertas e telemetria.
            </p>
          </div>
          {demoPending ? (
            <Loader2 className="w-5 h-5 text-white animate-spin shrink-0" />
          ) : (
            <Switch
              checked={demoEnabled}
              onCheckedChange={(checked) => (checked ? enableDemo.mutate() : disableDemo.mutate())}
              className="shrink-0 data-[state=checked]:bg-[#E2FF04]"
              aria-label="Ativar modo demonstração"
            />
          )}
        </div>
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

      {/* Delete account → goes through the retention save flow first */}
      <button
        onClick={openRetention}
        className="w-full mt-3 text-center text-xs text-gray-400 underline underline-offset-4 go-btn-active"
      >
        Cancelar / excluir minha conta
      </button>

      {showRetention && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRetention(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {retStep === "reason" && (
              <>
                <h3 className="text-lg font-bold text-[#111111]">Que pena que você quer ir 😢</h3>
                <p className="text-sm text-gray-500 mt-1 mb-5">Antes de seguir, conte o que aconteceu — queremos cuidar disso pra você.</p>
                <div className="space-y-2">
                  {RETENTION_REASONS.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => chooseReason(r)}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-100 bg-gray-50 go-btn-active"
                    >
                      <span className="text-sm font-medium text-[#111111]">{r.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowRetention(false)} className="w-full mt-4 text-center text-sm font-semibold text-[#243FF7] go-btn-active py-2">
                  Voltar — quero continuar no GO
                </button>
              </>
            )}

            {retStep === "offer" && retReason && (
              <>
                <div className="w-14 h-14 bg-[#E2FF04]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-7 h-7 text-[#243FF7]" />
                </div>
                <h3 className="text-xl font-bold text-[#111111] text-center">{retReason.offerTitle}</h3>
                <p className="text-sm text-gray-500 mt-2 mb-6 text-center leading-relaxed">{retReason.offerDesc}</p>
                <Button
                  className="w-full h-12 bg-[#243FF7] text-white font-bold rounded-xl go-btn-active"
                  onClick={acceptOffer}
                  disabled={retentionMutation.isPending}
                >
                  {retReason.accept}
                </Button>
                <button
                  onClick={() => setRetStep("confirm")}
                  className="w-full mt-3 text-center text-xs text-gray-400 underline underline-offset-4 go-btn-active py-1"
                >
                  Não, quero continuar a exclusão
                </button>
              </>
            )}

            {retStep === "confirm" && (
              <>
                <div className="flex items-center gap-2 text-red-600 mb-2">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="text-lg font-bold">Excluir conta permanentemente</h3>
                </div>
                <p className="text-sm text-gray-500 mb-5">
                  Esta ação é irreversível. Todos os seus dados — equipamentos, trajetos,
                  cercas, contatos de emergência, faturas e notificações — serão apagados definitivamente.
                </p>
                <Button
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl go-btn-active"
                  onClick={confirmDelete}
                  disabled={deleteAccountMutation.isPending}
                >
                  {deleteAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sim, excluir tudo"}
                </Button>
                <button onClick={() => setShowRetention(false)} className="w-full mt-3 text-center text-sm font-semibold text-[#243FF7] go-btn-active py-1">
                  Voltar — mudei de ideia
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
              iosNeedsInstall ? (
                <div className="bg-[#243FF7]/5 border border-[#243FF7]/20 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-[#243FF7]">📲 Ative no seu iPhone</p>
                  <p className="text-xs text-gray-600 mt-1.5">
                    Para receber notificações no iPhone, instale o GO na Tela de Início:
                  </p>
                  <ol className="text-xs text-gray-700 mt-2.5 space-y-1.5 list-decimal list-inside">
                    <li>Toque em <b>Compartilhar</b> <span className="text-gray-400">(ícone ⬆️)</span> no Safari</li>
                    <li>Escolha <b>Adicionar à Tela de Início</b></li>
                    <li>Abra o GO pelo novo ícone e volte aqui</li>
                  </ol>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-sm text-amber-800 font-medium">Navegador não suportado</p>
                  <p className="text-xs text-amber-600 mt-1">Use o Chrome/Edge no computador ou Android para ativar as notificações.</p>
                </div>
              )
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

                {isSubscribed && (
                  <Button
                    variant="outline"
                    className="w-full h-11 mt-3 rounded-xl border-[#243FF7]/30 text-[#243FF7] font-semibold go-btn-active"
                    onClick={() => testPush.mutate()}
                    disabled={testPush.isPending}
                  >
                    {testPush.isPending ? "Enviando..." : "Enviar push de teste"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Address sheet */}
      {showAddress && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddress(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 min-h-[55vh] animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#243FF7]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#111111]">Meu endereço</h3>
                <p className="text-xs text-gray-500">Busque por CEP ou endereço</p>
              </div>
            </div>

            {userAddress && (
              <div className="mb-4 bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">Endereço atual</p>
                  <p className="text-sm text-gray-700">{userAddress}</p>
                </div>
              </div>
            )}

            <AddressSearch
              autoFocus
              placeholder="Digite o CEP ou endereço..."
              onSelect={(lat, lng, label) =>
                setAddressMutation.mutate({ address: label, lat: String(lat), lng: String(lng) })
              }
            />

            {setAddressMutation.isPending && (
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Feedback / rating sheet */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFeedback(false)} />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8 animate-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
            {feedbackSent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-[#111111]">Obrigado! 💙</h3>
                <p className="text-sm text-gray-500 mt-1">Sua opinião ajuda o GO a melhorar cada vez mais.</p>
                <Button
                  className="w-full h-12 mt-6 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active"
                  onClick={() => { setShowFeedback(false); setFeedbackSent(false); setRating(0); setFeedbackMsg(""); }}
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                    <Star className="w-5 h-5 text-[#243FF7]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#111111]">Avaliar o app</h3>
                    <p className="text-xs text-gray-500">Sua nota e sugestões nos ajudam a melhorar</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 mb-5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRating(n)} className="go-btn-active" aria-label={`${n} estrelas`}>
                      <Star className={`w-9 h-9 ${n <= rating ? "text-[#E2FF04] fill-[#E2FF04]" : "text-gray-300"}`} />
                    </button>
                  ))}
                </div>

                <textarea
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  placeholder="Conte o que achou ou sugira uma melhoria (opcional)"
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 p-3 text-sm outline-none focus:ring-2 focus:ring-[#243FF7]/30 resize-none"
                />

                <Button
                  className="w-full h-12 mt-4 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active disabled:opacity-50"
                  disabled={rating === 0 || feedbackMutation.isPending}
                  onClick={() => feedbackMutation.mutate({ rating, message: feedbackMsg.trim() || undefined })}
                >
                  {feedbackMutation.isPending ? "Enviando..." : "Enviar avaliação"}
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
                <p className="text-xs text-gray-500">
                  {vehicle ? `${vehicle.brand ? vehicle.brand + " " : ""}${vehicle.model} • ${vehicle.plate}` : "Receba alertas ao ultrapassar o limite"}
                </p>
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
