import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Heart, Car, Wrench, Home, Warehouse, HelpCircle,
  Calendar, MapPin, Phone, Clock, ChevronRight, CheckCircle2,
  ArrowLeft, Shield
} from "lucide-react";
import { Link } from "wouter";

type Step = "greeting" | "reason" | "details" | "service_points" | "schedule" | "done";

export default function VehicleCare() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("greeting");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const vehiclesQuery = trpc.vehicles.list.useQuery();
  const servicePointsQuery = trpc.care.listServicePoints.useQuery();
  const reportMutation = trpc.care.reportOfflineReason.useMutation();
  const appointmentMutation = trpc.care.createAppointment.useMutation();

  const vehicles = vehiclesQuery.data || [];
  const offlineVehicles = vehicles.filter((v: any) => v.trackerStatus === "offline");
  const targetVehicle = selectedVehicleId
    ? vehicles.find((v: any) => v.id === selectedVehicleId)
    : offlineVehicles[0];

  const reasons = [
    { id: "all_ok", label: "Está tudo bem!", sublabel: "O veículo está funcionando normalmente", icon: CheckCircle2, color: "text-green-500" },
    { id: "garage", label: "Está na garagem", sublabel: "Veículo parado em local fechado", icon: Home, color: "text-blue-500" },
    { id: "workshop", label: "Está na oficina", sublabel: "Em manutenção ou reparo mecânico", icon: Wrench, color: "text-orange-500" },
    { id: "maintenance", label: "Manutenção do rastreador", sublabel: "O equipamento precisa de atenção", icon: Shield, color: "text-purple-500" },
    { id: "other", label: "Outro motivo", sublabel: "Quero informar algo diferente", icon: HelpCircle, color: "text-gray-500" },
  ];

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    if (reason === "all_ok" || reason === "garage") {
      // Registrar e finalizar
      if (targetVehicle) {
        reportMutation.mutate({
          vehicleId: targetVehicle.id,
          reason: reason as any,
          needsService: false,
        }, {
          onSuccess: () => setStep("done"),
        });
      }
    } else if (reason === "maintenance") {
      setStep("service_points");
    } else {
      setStep("details");
    }
  };

  const handleDetailsSubmit = () => {
    if (targetVehicle) {
      const needsService = selectedReason === "workshop" || selectedReason === "other";
      reportMutation.mutate({
        vehicleId: targetVehicle.id,
        reason: selectedReason as any,
        details: details || undefined,
        needsService,
      }, {
        onSuccess: () => {
          if (needsService) {
            setStep("service_points");
          } else {
            setStep("done");
          }
        },
      });
    }
  };

  const handleSchedule = () => {
    if (targetVehicle && selectedPoint && selectedDate) {
      appointmentMutation.mutate({
        vehicleId: targetVehicle.id,
        servicePointId: selectedPoint,
        scheduledDate: new Date(selectedDate).toISOString(),
        serviceType: "maintenance",
        notes: details || undefined,
      }, {
        onSuccess: () => {
          toast.success("Agendamento realizado com sucesso!");
          setStep("done");
        },
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900">Cuidando de Você</h1>
            <p className="text-xs text-gray-500">Estamos aqui para ajudar</p>
          </div>
          <Heart className="w-5 h-5 text-red-400 ml-auto animate-pulse" />
        </div>
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto">
        {/* Loading State */}
        {vehiclesQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Heart className="w-8 h-8 text-blue-300" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-64" />
          </div>
        )}

        {/* Error State */}
        {vehiclesQuery.isError && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <HelpCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Ops, algo deu errado</h2>
            <p className="text-sm text-gray-500">Não conseguimos carregar. Tente novamente.</p>
            <Button onClick={() => vehiclesQuery.refetch()} className="rounded-xl bg-blue-600 hover:bg-blue-700">Tentar novamente</Button>
          </div>
        )}

        {/* No offline vehicles */}
        {!vehiclesQuery.isLoading && !vehiclesQuery.isError && offlineVehicles.length === 0 && step === "greeting" && (
          <div className="text-center py-16 space-y-4 animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Tudo certo!</h2>
            <p className="text-gray-600">Todos os seus veículos estão com comunicação normal.</p>
            <Link href="/"><Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-medium mt-4">Voltar para o início</Button></Link>
          </div>
        )}

        {/* STEP: Greeting (with offline vehicle) */}
        {!vehiclesQuery.isLoading && !vehiclesQuery.isError && (offlineVehicles.length > 0 || step !== "greeting") && step === "greeting" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""}! 👋
              </h2>
              <p className="text-gray-600 leading-relaxed">
                Percebemos que {targetVehicle ? `seu ${targetVehicle.brand || ""} ${targetVehicle.model}` : "seu veículo"} está sem comunicação há algum tempo. 
                Está tudo bem com você?
              </p>
            </div>

            {targetVehicle && (
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <Car className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{targetVehicle.brand} {targetVehicle.model}</p>
                    <p className="text-sm text-gray-500 font-mono">{targetVehicle.plate}</p>
                  </div>
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                    Offline
                  </span>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full h-14 text-base font-medium rounded-2xl bg-blue-600 hover:bg-blue-700"
              onClick={() => setStep("reason")}
            >
              Sim, quero informar o que aconteceu
            </Button>

            <p className="text-center text-xs text-gray-400">
              Sua segurança é nossa prioridade. Não estamos monitorando você — estamos cuidando.
            </p>
          </div>
        )}

        {/* STEP: Reason Selection */}
        {step === "reason" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">O que está acontecendo?</h2>
              <p className="text-sm text-gray-500 mt-1">Selecione a opção que melhor descreve a situação</p>
            </div>

            {reasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => handleReasonSelect(reason.id)}
                className="w-full p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200 flex items-center gap-4 text-left active:scale-[0.98]"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-gray-50 ${reason.color}`}>
                  <reason.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{reason.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{reason.sublabel}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            ))}

            <button
              onClick={() => setStep("greeting")}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4 py-2"
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* STEP: Details */}
        {step === "details" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Conte-nos mais</h2>
              <p className="text-sm text-gray-500 mt-1">
                {selectedReason === "workshop" 
                  ? "Qual oficina ou tipo de serviço está sendo feito?"
                  : "Descreva brevemente o que está acontecendo"}
              </p>
            </div>

            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Ex: O veículo está na oficina para troca de óleo..."
              className="min-h-[120px] rounded-xl border-gray-200 focus:border-blue-300"
            />

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setStep("reason")}
              >
                Voltar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={handleDetailsSubmit}
                disabled={reportMutation.isPending}
              >
                {reportMutation.isPending ? "Enviando..." : "Continuar"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Service Points */}
        {step === "service_points" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Agendar Manutenção</h2>
              <p className="text-sm text-gray-500 mt-1">
                Escolha um ponto de instalação para levar seu veículo
              </p>
            </div>

            <div className="space-y-3">
              {(servicePointsQuery.data || []).length === 0 ? (
                <Card className="bg-white border-gray-100">
                  <CardContent className="p-6 text-center">
                    <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Nenhum ponto disponível no momento</p>
                    <p className="text-xs text-gray-400 mt-1">Entre em contato pelo WhatsApp para agendar</p>
                    <Button
                      className="mt-4 bg-green-600 hover:bg-green-700 rounded-xl"
                      onClick={() => window.open("https://wa.me/5500000000000?text=Olá! Preciso agendar manutenção do rastreador", "_blank")}
                    >
                      Falar no WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                (servicePointsQuery.data || []).map((point: any) => (
                  <button
                    key={point.id}
                    onClick={() => {
                      setSelectedPoint(point.id);
                      setStep("schedule");
                    }}
                    className={`w-full p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98] ${
                      selectedPoint === point.id ? "border-blue-400 bg-blue-50" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{point.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{point.address}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {point.phone && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Phone className="w-3 h-3" /> {point.phone}
                            </span>
                          )}
                          {point.openHours && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" /> {point.openHours}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 mt-1" />
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() => setStep("done")}
            >
              Não preciso agendar agora
            </Button>
          </div>
        )}

        {/* STEP: Schedule */}
        {step === "schedule" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Escolha a data</h2>
              <p className="text-sm text-gray-500 mt-1">Quando você pode levar o veículo?</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Data e horário</label>
              <input
                type="datetime-local"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setStep("service_points")}
              >
                Voltar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={handleSchedule}
                disabled={!selectedDate || appointmentMutation.isPending}
              >
                {appointmentMutation.isPending ? "Agendando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Obrigado pelo retorno!</h2>
            <p className="text-gray-600 leading-relaxed">
              {selectedReason === "all_ok" && "Que bom que está tudo bem! Continuaremos cuidando do seu veículo."}
              {selectedReason === "garage" && "Entendido! Quando o veículo sair da garagem, a comunicação será restabelecida automaticamente."}
              {selectedReason === "workshop" && "Registramos que seu veículo está na oficina. Quando voltar, nos avise!"}
              {selectedReason === "maintenance" && "Seu agendamento foi registrado. Entraremos em contato para confirmar."}
              {selectedReason === "other" && "Obrigado por nos informar. Estamos aqui se precisar de algo mais."}
            </p>

            <Card className="bg-blue-50 border-blue-100">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-blue-700 font-medium">💡 Dica</p>
                <p className="text-xs text-blue-600 mt-1">
                  Você pode verificar o status do seu rastreador a qualquer momento na tela principal do app.
                </p>
              </CardContent>
            </Card>

            <Link href="/">
              <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-medium">
                Voltar para o início
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
