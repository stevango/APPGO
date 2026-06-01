import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, Receipt, CheckCircle2, Clock, AlertCircle, XCircle,
  Download, Copy, ExternalLink, Filter, ChevronLeft, ChevronRight,
  FileText, Calendar, CreditCard, QrCode, RefreshCw, Banknote
} from "lucide-react";
import { Link } from "wouter";

type StatusFilter = "all" | "paid" | "pending" | "overdue" | "cancelled";

const STATUS_CONFIG = {
  paid: {
    label: "Pago",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    badge: "bg-amber-100 text-amber-700",
  },
  overdue: {
    label: "Atrasado",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
    badge: "bg-red-100 text-red-700",
  },
  cancelled: {
    label: "Cancelado",
    icon: XCircle,
    color: "text-gray-500",
    bg: "bg-gray-50",
    border: "border-gray-200",
    badge: "bg-gray-100 text-gray-600",
  },
};

const METHOD_LABELS: Record<string, { label: string; icon: typeof Receipt }> = {
  boleto: { label: "Boleto", icon: Banknote },
  credit_card: { label: "Cartão de Crédito", icon: CreditCard },
  debit_card: { label: "Cartão de Débito", icon: CreditCard },
  pix: { label: "PIX", icon: QrCode },
  recurring_card: { label: "Recorrente", icon: RefreshCw },
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagas" },
  { value: "overdue", label: "Atrasadas" },
  { value: "cancelled", label: "Canceladas" },
];

export default function PaymentHistory() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const LIMIT = 10;

  const queryInput = useMemo(() => ({
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: LIMIT,
  }), [statusFilter, page]);

  const { data, isLoading, isError, refetch } = trpc.payment.getInvoices.useQuery(queryInput);

  const invoices = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / LIMIT);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode).then(() => {
      toast.success("Código de barras copiado!");
    }).catch(() => {
      toast.error("Erro ao copiar. Tente novamente.");
    });
  };

  const handleOpenBoleto = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/payment">
            <button className="p-2 rounded-full hover:bg-gray-100 transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          </Link>
          <div>
            <h1 className="font-semibold text-gray-900">Histórico de Pagamentos</h1>
            <p className="text-xs text-gray-500">Suas faturas e boletos</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">
        {/* Resumo rápido */}
        {!isLoading && !isError && invoices.length > 0 && (
          <div className="grid grid-cols-3 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-emerald-700">
                {invoices.filter((i: any) => i.status === "paid").length}
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">Pagas</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-700">
                {invoices.filter((i: any) => i.status === "pending").length}
              </p>
              <p className="text-[10px] text-amber-600 font-medium">Pendentes</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-red-700">
                {invoices.filter((i: any) => i.status === "overdue").length}
              </p>
              <p className="text-[10px] text-red-600 font-medium">Atrasadas</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleFilterChange(opt.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 active:scale-95 ${
                statusFilter === opt.value
                  ? "bg-[#243FF7] text-white shadow-sm shadow-blue-200"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-50 rounded w-1/2" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="text-center py-16 space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Erro ao carregar</h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              Não foi possível carregar seu histórico de pagamentos. Verifique sua conexão.
            </p>
            <Button
              onClick={() => refetch()}
              className="rounded-xl bg-[#243FF7] hover:bg-blue-700 text-white"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && invoices.length === 0 && (
          <div className="text-center py-16 space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-blue-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {statusFilter === "all" ? "Nenhuma fatura encontrada" : `Nenhuma fatura ${FILTER_OPTIONS.find(f => f.value === statusFilter)?.label.toLowerCase()}`}
            </h2>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              {statusFilter === "all"
                ? "Quando suas faturas forem geradas, elas aparecerão aqui."
                : "Tente outro filtro para encontrar suas faturas."}
            </p>
            {statusFilter !== "all" && (
              <Button
                variant="outline"
                onClick={() => handleFilterChange("all")}
                className="rounded-xl"
              >
                Ver todas as faturas
              </Button>
            )}
          </div>
        )}

        {/* Lista de Faturas */}
        {!isLoading && !isError && invoices.length > 0 && (
          <div className="space-y-2.5 animate-in fade-in slide-in-from-bottom-3 duration-500">
            {invoices.map((invoice: any) => {
              const status = STATUS_CONFIG[invoice.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const method = METHOD_LABELS[invoice.method] || METHOD_LABELS.boleto;
              const StatusIcon = status.icon;
              const MethodIcon = method.icon;
              const isExpanded = expandedId === invoice.id;
              const hasBoleto = invoice.method === "boleto" && (invoice.boletoUrl || invoice.boletoBarcode);

              return (
                <Card
                  key={invoice.id}
                  className={`border transition-all duration-200 overflow-hidden ${
                    isExpanded ? `${status.border} shadow-md` : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                  }`}
                >
                  <CardContent className="p-0">
                    {/* Linha principal — clicável */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : invoice.id)}
                      className="w-full flex items-center gap-3 p-4 text-left active:bg-gray-50 transition-colors"
                    >
                      {/* Ícone de status */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.bg}`}>
                        <StatusIcon className={`w-5 h-5 ${status.color}`} />
                      </div>

                      {/* Info principal */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {invoice.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            Venc. {formatDate(invoice.dueDate)}
                          </span>
                        </div>
                      </div>

                      {/* Valor + badge */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(invoice.amount)}
                        </p>
                        <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.badge}`}>
                          {status.label}
                        </span>
                      </div>
                    </button>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className={`px-4 pb-4 pt-0 border-t ${status.border} animate-in fade-in slide-in-from-top-1 duration-200`}>
                        <div className="pt-3 space-y-3">
                          {/* Método e referência */}
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <MethodIcon className="w-3.5 h-3.5" />
                              <span>{method.label}</span>
                            </div>
                            {invoice.referenceMonth && (
                              <span className="text-gray-400">
                                Ref: {invoice.referenceMonth}
                              </span>
                            )}
                          </div>

                          {/* Data de pagamento */}
                          {invoice.paidAt && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Pago em {formatDate(invoice.paidAt)}</span>
                            </div>
                          )}

                          {/* Ações de boleto */}
                          {hasBoleto && invoice.status !== "paid" && (
                            <div className="flex gap-2 pt-1">
                              {invoice.boletoUrl && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenBoleto(invoice.boletoUrl)}
                                  className="flex-1 h-9 rounded-xl bg-[#243FF7] hover:bg-blue-700 text-white text-xs font-semibold gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  2ª Via do Boleto
                                </Button>
                              )}
                              {invoice.boletoBarcode && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCopyBarcode(invoice.boletoBarcode)}
                                  className="h-9 rounded-xl text-xs font-semibold gap-1.5 border-gray-200"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  Copiar Código
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Boleto pago — ver comprovante */}
                          {hasBoleto && invoice.status === "paid" && invoice.boletoUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBoleto(invoice.boletoUrl)}
                              className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5 border-gray-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Ver Comprovante
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 pb-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-xl h-9 gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="text-xs text-gray-500">
              {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-xl h-9 gap-1"
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
