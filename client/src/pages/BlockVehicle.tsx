import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronLeft, Lock, Unlock, ShieldCheck, AlertTriangle,
  CheckCircle, Loader2, History, Clock, Shield, FileWarning
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BlockVehicle() {
  const [, setLocation] = useLocation();
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.[0];
  const [step, setStep] = useState<"idle" | "terms" | "confirm" | "processing" | "done" | "history">("idle");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const utils = trpc.useUtils();

  const { data: blockHistory, isLoading: historyLoading, error: historyError } = trpc.vehicles.blockHistory.useQuery(
    { vehicleId: vehicle?.id ?? 0, page: historyPage, limit: 20 },
    { enabled: !!vehicle }
  );

  const acceptTermsMutation = trpc.vehicles.acceptBlockTerms.useMutation();

  const blockMutation = trpc.vehicles.block.useMutation({
    onSuccess: () => {
      setStep("done");
      utils.vehicles.list.invalidate();
      utils.vehicles.blockHistory.invalidate();
      toast.success(
        vehicle?.blocked ? "Veículo desbloqueado!" : "Veículo bloqueado!"
      );
    },
    onError: (err) => {
      setStep("idle");
      toast.error(err.message || "Falha no comando. Tente novamente.");
    },
  });

  const handleAction = () => {
    if (!vehicle) return;
    setStep("processing");
    blockMutation.mutate({
      vehicleId: vehicle.id,
      action: vehicle.blocked ? "unblock" : "block",
      termsAccepted: true,
      ipAddress: undefined,
      userAgent: navigator.userAgent,
    });
  };

  const handleBlockClick = () => {
    if (!vehicle?.blocked) {
      // Para bloquear, exigir aceite dos termos
      setTermsAccepted(false);
      setStep("terms");
    } else {
      // Para desbloquear, ir direto para confirmação
      setStep("confirm");
    }
  };

  const handleAcceptTerms = async () => {
    if (!vehicle) return;
    try {
      // Registrar aceite dos termos independentemente e aguardar confirmação
      await acceptTermsMutation.mutateAsync({
        vehicleId: vehicle.id,
        userAgent: navigator.userAgent,
      });
      setStep("confirm");
    } catch {
      toast.error("Erro ao registrar aceite dos termos. Tente novamente.");
    }
  };

  const isBlocked = vehicle?.blocked;
  const actionLabel = isBlocked ? "Desbloquear" : "Bloquear";
  const ActionIcon = isBlocked ? Unlock : Lock;

  return (
    <div className="px-4 pb-4 min-h-screen flex flex-col">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-6 bg-[#F5F6FA]/90 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/")} className="go-btn-active">
            <ChevronLeft className="w-6 h-6 text-[#343C42]" />
          </button>
          <h1 className="text-lg font-bold text-[#111111]">Bloqueio Remoto</h1>
        </div>
        <button
          onClick={() => setStep("history")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 go-btn-active"
        >
          <History className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-medium text-gray-600">Histórico</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {step === "history" ? (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setStep("idle")} className="go-btn-active">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-lg font-bold text-[#111111]">Histórico de Comandos</h2>
            </div>
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-[#243FF7] animate-spin mb-3" />
                <p className="text-sm text-gray-500">Carregando histórico...</p>
              </div>
            ) : historyError ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-sm text-red-500">Erro ao carregar histórico</p>
              </div>
            ) : !blockHistory || blockHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Nenhum comando registrado</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {/* Paginação */}
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-gray-500">Página {historyPage}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs rounded-lg"
                    onClick={() => setHistoryPage(p => p + 1)}
                    disabled={!blockHistory || blockHistory.length < 20}
                  >
                    Próxima
                  </Button>
                </div>
                {blockHistory.map((log) => (
                  <div key={log.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          log.action === "block" ? "bg-red-100" : "bg-green-100"
                        }`}>
                          {log.action === "block" ? (
                            <Lock className="w-4 h-4 text-red-600" />
                          ) : (
                            <Unlock className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">
                            {log.action === "block" ? "Bloqueio" : "Desbloqueio"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        log.status === "confirmed" ? "bg-green-100 text-green-700" :
                        log.status === "failed" ? "bg-red-100 text-red-700" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {log.status === "confirmed" ? "Confirmado" :
                         log.status === "failed" ? "Falhou" : "Pendente"}
                      </span>
                    </div>
                    <div className="border-t border-gray-50 pt-2 mt-2 space-y-1">
                      {log.ipAddress && (
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">IP:</span> {log.ipAddress}
                        </p>
                      )}
                      {log.vehicleSpeed !== null && log.vehicleSpeed !== undefined && log.action === "block" && (
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Velocidade no momento:</span> {log.vehicleSpeed} km/h
                        </p>
                      )}
                      {log.termsAcceptedAt && (
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Termos aceitos:</span> {new Date(log.termsAcceptedAt).toLocaleString("pt-BR")}
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-xs text-gray-400">
                          <span className="font-medium text-gray-500">Motivo:</span> {log.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : step === "terms" ? (
          <div className="w-full max-w-sm">
            {/* Termo de responsabilidade */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <FileWarning className="w-10 h-10 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-[#111111] mb-1 text-center">
                Termo de Responsabilidade
              </h2>
              <p className="text-sm text-gray-500 text-center">
                Leia atentamente antes de prosseguir
              </p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-800">
                  ATENÇÃO: Riscos do Bloqueio Remoto
                </p>
              </div>
              <div className="space-y-2 text-xs text-red-700 leading-relaxed">
                <p>
                  O bloqueio remoto do veículo <strong>interrompe o fornecimento de combustível</strong> ao motor, 
                  podendo causar a parada imediata do veículo.
                </p>
                <p>
                  <strong>Se o veículo estiver em movimento</strong>, o bloqueio pode resultar em:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Perda de direção hidráulica</li>
                  <li>Perda de frenagem assistida</li>
                  <li>Acidentes de trânsito</li>
                  <li>Risco à vida do condutor e terceiros</li>
                </ul>
                <p className="font-semibold mt-2">
                  O usuário assume total responsabilidade pelos danos decorrentes do uso indevido 
                  desta funcionalidade, incluindo danos materiais, corporais e morais a si e a terceiros.
                </p>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-600 leading-relaxed">
                  <p className="font-semibold mb-1">Ao aceitar, você declara que:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Compreende os riscos envolvidos no bloqueio remoto</li>
                    <li>Confirma que o veículo está parado ou em local seguro</li>
                    <li>Assume total responsabilidade pelo comando enviado</li>
                    <li>Autoriza o registro de seus dados (IP, horário, dispositivo) para fins de auditoria</li>
                  </ul>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-3 p-4 bg-white border-2 border-gray-200 rounded-xl mb-4 cursor-pointer go-btn-active">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[#243FF7] focus:ring-[#243FF7] mt-0.5"
              />
              <span className="text-sm text-[#111111] leading-relaxed">
                <strong>Li, compreendi e aceito</strong> os termos de responsabilidade acima e estou ciente dos riscos 
                envolvidos no bloqueio remoto do veículo.
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl go-btn-active"
                onClick={() => setStep("idle")}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white go-btn-active disabled:opacity-50"
                onClick={handleAcceptTerms}
                disabled={!termsAccepted}
              >
                Aceitar e continuar
              </Button>
            </div>
          </div>
        ) : step === "done" ? (
          <>
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-[#111111] mb-2">
              Comando confirmado!
            </h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              O veículo foi {isBlocked ? "desbloqueado" : "bloqueado"} com sucesso.
            </p>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 mt-4 w-full max-w-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Status: Confirmado</span>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mt-3 w-full max-w-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600">
                  Registrado em {new Date().toLocaleString("pt-BR")}
                </span>
              </div>
            </div>
            <Button
              className="mt-8 w-full max-w-xs h-12 bg-[#243FF7] text-white rounded-xl go-btn-active"
              onClick={() => { setStep("idle"); setLocation("/"); }}
            >
              Voltar ao início
            </Button>
          </>
        ) : step === "processing" ? (
          <>
            <div className="w-24 h-24 bg-[#243FF7]/10 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="w-12 h-12 text-[#243FF7] animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-[#111111] mb-2">Enviando comando...</h2>
            <p className="text-sm text-gray-500 text-center">
              Aguarde a confirmação do rastreador.
            </p>
            <div className="mt-6 space-y-2 w-full max-w-xs">
              <StatusStep label="Comando solicitado" done />
              <StatusStep label="Enviando ao rastreador" active />
              <StatusStep label="Confirmação do veículo" />
            </div>
          </>
        ) : step === "confirm" ? (
          <>
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
              isBlocked ? "bg-green-100" : "bg-red-100"
            }`}>
              <ActionIcon className={`w-12 h-12 ${isBlocked ? "text-green-600" : "text-red-500"}`} />
            </div>
            <h2 className="text-xl font-bold text-[#111111] mb-2">
              {actionLabel} veículo?
            </h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              {vehicle?.brand} {vehicle?.model} - {vehicle?.plate}
            </p>

            {!isBlocked && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-4 w-full max-w-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    O bloqueio cortará a alimentação de combustível do veículo. Use apenas em caso de necessidade.
                  </p>
                </div>
              </div>
            )}

            {!isBlocked && termsAccepted && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 mt-3 w-full max-w-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Termos aceitos</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8 w-full max-w-xs">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl go-btn-active"
                onClick={() => setStep("idle")}
              >
                Cancelar
              </Button>
              <Button
                className={`flex-1 h-12 rounded-xl go-btn-active ${
                  isBlocked ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
                } text-white`}
                onClick={handleAction}
              >
                Confirmar
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 ${
              isBlocked ? "bg-red-50 border-4 border-red-200" : "bg-green-50 border-4 border-green-200"
            }`}>
              {isBlocked ? (
                <Lock className="w-16 h-16 text-red-500" />
              ) : (
                <Unlock className="w-16 h-16 text-green-500" />
              )}
            </div>

            <h2 className="text-xl font-bold text-[#111111] mb-1">
              {isBlocked ? "Veículo Bloqueado" : "Veículo Desbloqueado"}
            </h2>
            <p className="text-sm text-gray-500 text-center mb-2">
              {vehicle?.brand} {vehicle?.model} - {vehicle?.plate}
            </p>

            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-2 ${
              isBlocked ? "bg-red-100" : "bg-green-100"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isBlocked ? "bg-red-500" : "bg-green-500"}`} />
              <span className={`text-xs font-medium ${isBlocked ? "text-red-700" : "text-green-700"}`}>
                {isBlocked ? "Bloqueado" : "Livre"}
              </span>
            </div>

            <Button
              className={`mt-10 w-full max-w-xs h-14 rounded-xl text-base font-semibold go-btn-active ${
                isBlocked
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              }`}
              onClick={handleBlockClick}
              disabled={!vehicle}
            >
              <ActionIcon className="w-5 h-5 mr-2" />
              {actionLabel} Veículo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusStep({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
        done ? "bg-green-500" : active ? "bg-[#243FF7]" : "bg-gray-200"
      }`}>
        {done ? (
          <CheckCircle className="w-4 h-4 text-white" />
        ) : active ? (
          <Loader2 className="w-3 h-3 text-white animate-spin" />
        ) : (
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
        )}
      </div>
      <span className={`text-sm ${done ? "text-green-700 font-medium" : active ? "text-[#243FF7] font-medium" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}
