import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, FileText, ShieldCheck, Lock, Check, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LEGAL_DOCS, CONSENT_LABEL, type LegalDoc } from "@/lib/legalDocs";

const DOC_ICON: Record<string, any> = {
  termos_uso: FileText,
  privacidade_lgpd: ShieldCheck,
  confidencialidade: Lock,
};

function fmt(d: string | Date) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Legal() {
  const [, setLocation] = useLocation();
  const [openDoc, setOpenDoc] = useState<LegalDoc | null>(null);

  const consentsQuery = trpc.legal.consents.useQuery();
  const utils = trpc.useUtils();
  const accept = trpc.legal.accept.useMutation({
    onSuccess: async () => {
      toast.success("Aceite registrado!");
      await utils.legal.consents.invalidate();
      setOpenDoc(null);
    },
    onError: () => toast.error("Não foi possível registrar. Tente novamente."),
  });

  const consents = consentsQuery.data ?? [];
  const latestFor = (key: string) =>
    consents.find((c) => c.docType === key);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setLocation("/profile")} className="go-btn-active" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Termos e Privacidade</h1>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Documents */}
        <div>
          <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Documentos</h2>
          <div className="space-y-2.5">
            {LEGAL_DOCS.map((doc) => {
              const Icon = DOC_ICON[doc.key] || FileText;
              const consent = latestFor(doc.key);
              return (
                <button
                  key={doc.key}
                  onClick={() => setOpenDoc(doc)}
                  className="w-full go-card p-4 flex items-center gap-3.5 text-left go-btn-active"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#243FF7]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#243FF7]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#111111] text-sm">{doc.title}</p>
                    <p className="text-xs text-gray-500 truncate">{doc.short}</p>
                    {consent ? (
                      <p className="text-[11px] text-green-600 font-medium mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Aceito em {fmt(consent.acceptedAt)} (v{consent.version})
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-600 font-medium mt-1">Toque para ler e aceitar</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Consent history */}
        <div>
          <h2 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Histórico de aceites</h2>
          {consents.length === 0 ? (
            <div className="go-card p-5 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum aceite registrado ainda.</p>
            </div>
          ) : (
            <div className="go-card divide-y divide-gray-100">
              {consents.map((c) => (
                <div key={c.id} className="p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#111111]">{CONSENT_LABEL[c.docType] || c.docType}</p>
                    <p className="text-xs text-gray-500">{fmt(c.acceptedAt)} • versão {c.version}</p>
                    {c.ipAddress && <p className="text-[10px] text-gray-400 font-mono mt-0.5">IP {c.ipAddress}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document viewer */}
      {openDoc && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="border-b border-gray-100 px-4 py-4 flex items-center gap-3 shrink-0">
            <button onClick={() => setOpenDoc(null)} className="go-btn-active" aria-label="Voltar">
              <ChevronLeft className="w-6 h-6 text-[#343C42]" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#111111] truncate">{openDoc.title}</h1>
              <p className="text-[11px] text-gray-400">Versão {openDoc.version} • Atualizado em {openDoc.updatedAt}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-[13px] text-gray-700 whitespace-pre-line leading-relaxed">{openDoc.body}</p>
          </div>

          <div className="border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
            {latestFor(openDoc.key) ? (
              <div className="text-center text-sm text-green-600 font-medium py-2 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" /> Você já aceitou esta versão
              </div>
            ) : (
              <Button
                className="w-full h-12 bg-[#243FF7] text-white font-semibold rounded-xl go-btn-active disabled:opacity-50"
                disabled={accept.isPending}
                onClick={() => accept.mutate({ docType: openDoc.key, version: openDoc.version })}
              >
                {accept.isPending ? "Registrando..." : "Li e aceito"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
