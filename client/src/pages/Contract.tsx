import { useLocation } from "wouter";
import { ChevronLeft, FileSignature, Download, ExternalLink, ShieldCheck, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "bg-amber-50 text-amber-700" },
  sent: { label: "Enviado para assinatura", cls: "bg-blue-50 text-blue-700" },
  signed: { label: "Assinado", cls: "bg-green-50 text-green-700" },
  active: { label: "Ativo", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "Cancelado", cls: "bg-red-50 text-red-700" },
};

function fmt(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Contract() {
  const [, setLocation] = useLocation();
  const { data: contract, isLoading } = trpc.contract.get.useQuery();

  const status = contract ? STATUS_LABEL[contract.status] || STATUS_LABEL.pending : STATUS_LABEL.pending;
  const hasDoc = !!contract?.documentUrl;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setLocation("/profile")} className="go-btn-active" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Meu Contrato</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="go-card p-6 animate-pulse h-40" />
        ) : (
          <>
            {/* Contract card */}
            <div className="go-card p-5">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#243FF7]/10 flex items-center justify-center shrink-0">
                  <FileSignature className="w-6 h-6 text-[#243FF7]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-[#111111] text-base">{contract?.title || "Contrato de Adesão GO"}</h2>
                  <span className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-500">Emitido em</p>
                  <p className="font-semibold text-[#111111]">{fmt(contract?.createdAt)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-500">Assinado em</p>
                  <p className="font-semibold text-[#111111]">{fmt(contract?.signedAt)}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <Button
                  className="w-full h-12 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active disabled:opacity-50"
                  disabled={!hasDoc}
                  onClick={() => contract?.documentUrl && window.open(contract.documentUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {hasDoc ? "Ver / assinar contrato" : "Disponível em breve"}
                </Button>
                {hasDoc && (
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl border-[#243FF7]/30 text-[#243FF7] font-semibold go-btn-active"
                    onClick={() => contract?.documentUrl && window.open(contract.documentUrl, "_blank")}
                  >
                    <Download className="w-4 h-4 mr-2" /> Baixar PDF
                  </Button>
                )}
              </div>
            </div>

            {/* DocuSign note */}
            {!hasDoc && (
              <div className="go-card p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Seu contrato será disponibilizado aqui para visualização e assinatura digital via
                  <span className="font-semibold"> DocuSign</span>. Assim que a integração estiver ativa,
                  você poderá assinar e baixar o documento diretamente pelo app.
                </p>
              </div>
            )}

            {/* Security note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Documento protegido e com validade jurídica.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
