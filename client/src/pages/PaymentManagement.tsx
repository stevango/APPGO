import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import RoletaTrigger from "@/components/RoletaTrigger";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CreditCard, Receipt, QrCode, RefreshCw, Gift, ArrowLeft,
  CheckCircle2, ChevronRight, Sparkles, Tag, ShoppingBag, Percent
} from "lucide-react";
import { Link } from "wouter";

type PaymentType = "boleto" | "credit_card" | "debit_card" | "pix" | "recurring_card";
type Step = "current" | "select" | "incentives" | "card_details" | "confirm" | "done";

const PAYMENT_METHODS = [
  { id: "recurring_card" as const, label: "Cartão Recorrente", sublabel: "Débito automático mensal — sem preocupação", icon: RefreshCw, color: "bg-purple-100 text-purple-600", badge: "Mais Popular" },
  { id: "credit_card" as const, label: "Cartão de Crédito", sublabel: "Pague na fatura do seu cartão", icon: CreditCard, color: "bg-blue-100 text-blue-600", badge: null },
  { id: "debit_card" as const, label: "Cartão de Débito", sublabel: "Débito direto na conta", icon: CreditCard, color: "bg-green-100 text-green-600", badge: null },
  { id: "pix" as const, label: "PIX", sublabel: "Pagamento instantâneo com desconto", icon: QrCode, color: "bg-teal-100 text-teal-600", badge: "5% OFF" },
  { id: "boleto" as const, label: "Boleto Bancário", sublabel: "Vencimento todo dia 10", icon: Receipt, color: "bg-gray-100 text-gray-600", badge: null },
];

export default function PaymentManagement() {
  const [step, setStep] = useState<Step>("current");
  const [selectedMethod, setSelectedMethod] = useState<PaymentType | null>(null);
  const [selectedIncentive, setSelectedIncentive] = useState<{ type: string; value: string } | null>(null);
  const [cardLast4, setCardLast4] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [billingDay, setBillingDay] = useState("10");

  const currentQuery = trpc.payment.getCurrent.useQuery();
  const incentivesQuery = trpc.payment.getIncentives.useQuery(
    { newMethod: selectedMethod || "" },
    { enabled: !!selectedMethod }
  );
  const changeMutation = trpc.payment.changeMethod.useMutation();

  const currentMethod = currentQuery.data;

  const handleMethodSelect = (method: PaymentType) => {
    setSelectedMethod(method);
    setStep("incentives");
  };

  const handleIncentiveSelect = (incentive: { type: string; value: string } | null) => {
    setSelectedIncentive(incentive);
    if (selectedMethod === "credit_card" || selectedMethod === "debit_card" || selectedMethod === "recurring_card") {
      setStep("card_details");
    } else {
      setStep("confirm");
    }
  };

  const handleConfirm = () => {
    if (!selectedMethod) return;
    changeMutation.mutate({
      newMethod: selectedMethod,
      cardLast4: cardLast4 || undefined,
      cardBrand: cardBrand || undefined,
      billingDay: billingDay ? parseInt(billingDay) : undefined,
      incentiveType: (selectedIncentive?.type as any) || "none",
      incentiveValue: selectedIncentive?.value || undefined,
    }, {
      onSuccess: () => {
        toast.success("Método de pagamento atualizado!");
        setStep("done");
      },
      onError: () => {
        toast.error("Erro ao alterar pagamento. Tente novamente.");
      },
    });
  };

  const getMethodLabel = (type: string) => {
    return PAYMENT_METHODS.find(m => m.id === type)?.label || type;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900">Forma de Pagamento</h1>
            <p className="text-xs text-gray-500">Gerencie como você paga</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 max-w-lg mx-auto">
        {/* Roleta — aparece se o cliente tiver direito após trocar pagamento */}
        <RoletaTrigger trigger="trocou_pagamento" />

        {/* Loading State */}
        {currentQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-blue-300" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-64" />
          </div>
        )}

        {/* Error State */}
        {currentQuery.isError && (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Erro ao carregar</h2>
            <p className="text-sm text-gray-500">Não foi possível carregar suas informações de pagamento.</p>
            <Button onClick={() => currentQuery.refetch()} className="rounded-xl bg-blue-600 hover:bg-blue-700">Tentar novamente</Button>
          </div>
        )}

        {/* STEP: Current */}
        {!currentQuery.isLoading && !currentQuery.isError && step === "current" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Current Method Card */}
            <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0 shadow-lg">
              <CardContent className="p-6">
                <p className="text-blue-200 text-sm font-medium">Método Atual</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    {currentMethod?.type === "pix" ? <QrCode className="w-6 h-6" /> :
                     currentMethod?.type === "boleto" ? <Receipt className="w-6 h-6" /> :
                     <CreditCard className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {currentMethod ? getMethodLabel(currentMethod.type) : "Boleto Bancário"}
                    </p>
                    {currentMethod?.cardLast4 && (
                      <p className="text-blue-200 text-sm">•••• {currentMethod.cardLast4}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Incentive Banner */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900 text-sm">Ganhe benefícios!</p>
                  <p className="text-xs text-amber-700">Mude para cartão recorrente e ganhe até 15% OFF ou um produto grátis</p>
                </div>
                <Sparkles className="w-5 h-5 text-amber-500" />
              </CardContent>
            </Card>

            <Button
              className="w-full h-14 text-base font-medium rounded-2xl bg-blue-600 hover:bg-blue-700"
              onClick={() => setStep("select")}
            >
              Alterar Forma de Pagamento
            </Button>

            <Link href="/payment/history">
              <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all active:scale-[0.98]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Receipt className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800">Histórico de Faturas</p>
                    <p className="text-xs text-gray-500">Visualizar faturas e 2ª via</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            </Link>

            <p className="text-center text-xs text-gray-500">
              A alteração será aplicada na próxima cobrança
            </p>
          </div>
        )}

        {/* STEP: Select Method */}
        {step === "select" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-lg font-bold text-gray-900">Escolha o novo método</h2>
              <p className="text-sm text-gray-500 mt-1">Selecione como deseja pagar</p>
            </div>

            {PAYMENT_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => handleMethodSelect(method.id)}
                disabled={method.id === currentMethod?.type}
                className={`w-full p-4 bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all text-left active:scale-[0.98] ${
                  method.id === currentMethod?.type ? "opacity-50 border-gray-200" : "border-gray-100 hover:border-blue-200"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${method.color}`}>
                    <method.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{method.label}</p>
                      {method.badge && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">
                          {method.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{method.sublabel}</p>
                  </div>
                  {method.id === currentMethod?.type ? (
                    <span className="text-xs text-gray-500">Atual</span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  )}
                </div>
              </button>
            ))}

            <button
              onClick={() => setStep("current")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-600 mt-4 py-2"
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* STEP: Incentives */}
        {step === "incentives" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Gift className="w-7 h-7 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Escolha seu benefício!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Por mudar para {getMethodLabel(selectedMethod || "")}, você ganha:
              </p>
            </div>

            <div className="space-y-3">
              {(incentivesQuery.data || []).map((incentive: any, i: number) => (
                <button
                  key={i}
                  onClick={() => handleIncentiveSelect({ type: incentive.type, value: incentive.value })}
                  className="w-full p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all text-left active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      incentive.type === "discount" ? "bg-green-100" : "bg-purple-100"
                    }`}>
                      {incentive.type === "discount" ? (
                        <Percent className="w-6 h-6 text-green-600" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{incentive.value}</p>
                      <p className="text-sm text-gray-500 mt-0.5">{incentive.description}</p>
                    </div>
                    <Tag className="w-5 h-5 text-amber-400" />
                  </div>
                </button>
              ))}

              <button
                onClick={() => handleIncentiveSelect(null)}
                className="w-full p-4 text-center text-sm text-gray-500 hover:text-gray-600 border border-dashed border-gray-200 rounded-2xl"
              >
                Não quero benefício, apenas alterar
              </button>
            </div>

            <button
              onClick={() => setStep("select")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-600 mt-2 py-2"
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* STEP: Card Details */}
        {step === "card_details" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Dados do Cartão</h2>
              <p className="text-sm text-gray-500 mt-1">Informe os dados para configurar</p>
            </div>

            <div className="space-y-4 bg-white rounded-2xl border border-gray-100 p-5">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Últimos 4 dígitos</label>
                <Input
                  value={cardLast4}
                  onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  className="rounded-xl h-12"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Bandeira</label>
                <div className="grid grid-cols-4 gap-2">
                  {["Visa", "Master", "Elo", "Amex"].map((brand) => (
                    <button
                      key={brand}
                      onClick={() => setCardBrand(brand)}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                        cardBrand === brand
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Dia de vencimento</label>
                <Input
                  type="number"
                  value={billingDay}
                  onChange={(e) => setBillingDay(e.target.value)}
                  min={1}
                  max={28}
                  className="rounded-xl h-12"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setStep("incentives")}
              >
                Voltar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
                onClick={() => setStep("confirm")}
                disabled={!cardLast4 || cardLast4.length < 4}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* STEP: Confirm */}
        {step === "confirm" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Confirmar Alteração</h2>
              <p className="text-sm text-gray-500 mt-1">Revise antes de confirmar</p>
            </div>

            <Card className="bg-white border-gray-100">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Novo método</span>
                  <span className="font-medium text-gray-900">{getMethodLabel(selectedMethod || "")}</span>
                </div>
                {cardLast4 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Cartão</span>
                    <span className="font-medium text-gray-900">{cardBrand} •••• {cardLast4}</span>
                  </div>
                )}
                {selectedIncentive && (
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <span className="text-sm text-green-600 font-medium">🎁 Benefício</span>
                    <span className="font-medium text-green-700">{selectedIncentive.value}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 rounded-xl"
                onClick={() => setStep("select")}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl bg-green-600 hover:bg-green-700"
                onClick={handleConfirm}
                disabled={changeMutation.isPending}
              >
                {changeMutation.isPending ? "Processando..." : "Confirmar"}
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
            <h2 className="text-xl font-bold text-gray-900">Pagamento Atualizado!</h2>
            <p className="text-gray-600">
              Seu método de pagamento foi alterado para <strong>{getMethodLabel(selectedMethod || "")}</strong>.
            </p>

            {selectedIncentive && (
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm font-medium text-green-800">🎉 Benefício ativado!</p>
                  <p className="text-xs text-green-600 mt-1">{selectedIncentive.value} será aplicado automaticamente</p>
                </CardContent>
              </Card>
            )}

            <Link href="/profile">
              <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-base font-medium">
                Voltar ao Perfil
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
