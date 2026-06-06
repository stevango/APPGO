import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import {
  ChevronLeft, AlertTriangle, Car, Shield, CheckCircle,
  FileText, MapPin, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const occurrenceTypes = [
  { value: "furto", label: "Furto", description: "Veículo levado sem violência" },
  { value: "roubo", label: "Roubo", description: "Veículo levado com violência ou ameaça" },
  { value: "apropriacao", label: "Apropriação Indébita", description: "Não devolveram o veículo" },
  { value: "golpe", label: "Golpe", description: "Fraude na venda ou transação" },
  { value: "outro", label: "Outro", description: "Outra situação" },
];

export default function ReportTheft() {
  const [, setLocation] = useLocation();
  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.[0];

  const [step, setStep] = useState(1);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [protocol, setProtocol] = useState("");

  const createMutation = trpc.occurrences.create.useMutation({
    onSuccess: (data) => {
      setProtocol(data.protocol);
      setStep(5);
      toast.success("Ocorrência registrada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao registrar ocorrência.");
    },
  });

  const handleSubmit = () => {
    if (!vehicle || !type) return;
    createMutation.mutate({
      vehicleId: vehicle.id,
      type: type as any,
      description,
    });
  };

  // Step 5: Success
  if (step === 5) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-[#111111] mb-2">Ocorrência Registrada</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          A Central GO foi acionada e está monitorando seu veículo.
        </p>

        <div className="w-full max-w-xs bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Protocolo</span>
            <span className="text-sm font-bold text-[#243FF7] font-mono">{protocol}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Status</span>
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
              Central Acionada
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Data/Hora</span>
            <span className="text-xs text-gray-700">
              {new Date().toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <Button
          className="mt-8 w-full max-w-xs h-12 bg-[#243FF7] text-white rounded-xl go-btn-active"
          onClick={() => setLocation("/")}
        >
          Voltar ao início
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 min-h-screen flex flex-col">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-4 bg-[#F5F6FA]/90 backdrop-blur flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(step - 1) : setLocation("/")} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Comunicar Furto/Roubo</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`flex-1 h-1 rounded-full transition-colors ${
              s <= step ? "bg-[#243FF7]" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      <div className="flex-1">
        {/* Step 1: Type */}
        {step === 1 && (
          <div>
            <h2 className="text-base font-bold text-[#111111] mb-1">Tipo de ocorrência</h2>
            <p className="text-sm text-gray-500 mb-5">Selecione o que aconteceu:</p>
            <div className="space-y-3">
              {occurrenceTypes.map((ot) => (
                <button
                  key={ot.value}
                  onClick={() => { setType(ot.value); setStep(2); }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors go-btn-active ${
                    type === ot.value
                      ? "border-[#243FF7] bg-[#243FF7]/5"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <p className="font-semibold text-sm text-[#111111]">{ot.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ot.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Confirm Vehicle */}
        {step === 2 && vehicle && (
          <div>
            <h2 className="text-base font-bold text-[#111111] mb-1">Confirmar veículo</h2>
            <p className="text-sm text-gray-500 mb-5">Verifique os dados do veículo:</p>

            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-[#243FF7]/10 rounded-xl flex items-center justify-center">
                  <Car className="w-6 h-6 text-[#243FF7]" />
                </div>
                <div>
                  <p className="font-bold text-[#111111]">{vehicle.brand} {vehicle.model}</p>
                  <p className="text-sm text-gray-500 font-mono">{vehicle.plate}</p>
                </div>
              </div>
              <div className="border-t border-gray-50 pt-3 space-y-2">
                <InfoRow label="Cor" value={vehicle.color || "Não informada"} />
                <InfoRow label="Ano" value={vehicle.year?.toString() || "N/A"} />
                <InfoRow label="Último sinal" value={
                  vehicle.lastSignalAt
                    ? new Date(vehicle.lastSignalAt).toLocaleString("pt-BR")
                    : "Sem dados"
                } />
                <InfoRow label="Última localização" value={vehicle.lastAddress || "Não disponível"} />
              </div>
            </div>

            <Button
              className="w-full h-12 bg-[#243FF7] text-white rounded-xl mt-6 go-btn-active"
              onClick={() => setStep(3)}
            >
              Confirmar e continuar
            </Button>
          </div>
        )}

        {/* Step 3: Description */}
        {step === 3 && (
          <div>
            <h2 className="text-base font-bold text-[#111111] mb-1">Detalhes da ocorrência</h2>
            <p className="text-sm text-gray-500 mb-5">Descreva o que aconteceu (opcional):</p>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Veículo foi levado do estacionamento do shopping por volta das 14h..."
              className="w-full h-32 p-4 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-[#243FF7]"
            />

            <Button
              className="w-full h-12 bg-[#243FF7] text-white rounded-xl mt-6 go-btn-active"
              onClick={() => setStep(4)}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div>
            <h2 className="text-base font-bold text-[#111111] mb-1">Confirmar envio</h2>
            <p className="text-sm text-gray-500 mb-5">Revise e confirme a comunicação:</p>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Atenção</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Ao confirmar, a Central GO será acionada imediatamente e o veículo entrará em modo de monitoramento intensivo.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 mb-6">
              <InfoRow label="Tipo" value={occurrenceTypes.find(o => o.value === type)?.label || type} />
              <InfoRow label="Veículo" value={`${vehicle?.brand} ${vehicle?.model} - ${vehicle?.plate}`} />
              {description && <InfoRow label="Descrição" value={description} />}
            </div>

            <Button
              className="w-full h-14 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl go-btn-active"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                "Enviando..."
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Confirmar e Acionar Central GO
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-xs text-gray-700 text-right">{value}</span>
    </div>
  );
}
