import { useLocation } from "wouter";
import { ChevronLeft, Check, Clock, Circle, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Etapa = { id: string; ordem: number; titulo: string; status: "concluido" | "em_andamento" | "pendente"; desde?: string | null };

function fmt(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Jornada() {
  const [, setLocation] = useLocation();
  const q = trpc.go360.jornada.useQuery(undefined, { retry: false });

  const result = q.data;
  const etapas: Etapa[] = (result && result.ok ? (result.data?.etapas ?? []) : []) as Etapa[];
  const done = etapas.filter((e) => e.status === "concluido").length;
  const pct = etapas.length ? Math.round((done / etapas.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => setLocation("/profile")} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Minha Jornada</h1>
      </div>

      <div className="px-4 py-5">
        {q.isLoading ? (
          <div className="go-card p-6 animate-pulse h-64" />
        ) : !result || !result.ok ? (
          <div className="go-card p-8 text-center">
            <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Sua jornada de implantação aparecerá aqui em breve.</p>
          </div>
        ) : (
          <>
            {/* Progress header */}
            <div className="go-card p-5 mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-[#111111]">Implantação</h2>
                <span className="text-sm font-bold text-[#243FF7]">{pct}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#243FF7] to-[#1a2fd4] rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{done} de {etapas.length} etapas concluídas</p>
            </div>

            {/* Timeline */}
            <div className="go-card p-5">
              <div className="relative">
                {etapas.sort((a, b) => a.ordem - b.ordem).map((e, i) => {
                  const isLast = i === etapas.length - 1;
                  const color =
                    e.status === "concluido" ? "bg-green-500 text-white"
                      : e.status === "em_andamento" ? "bg-[#243FF7] text-white"
                      : "bg-gray-200 text-gray-400";
                  const Icon = e.status === "concluido" ? Check : e.status === "em_andamento" ? Clock : Circle;
                  return (
                    <div key={e.id} className="flex gap-3.5">
                      <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${color} ${e.status === "em_andamento" ? "pulse-online" : ""}`}>
                          <Icon className="w-4.5 h-4.5" strokeWidth={2.5} />
                        </div>
                        {!isLast && <div className={`w-0.5 flex-1 my-1 ${e.status === "concluido" ? "bg-green-400" : "bg-gray-200"}`} style={{ minHeight: 28 }} />}
                      </div>
                      <div className={`pb-6 ${isLast ? "" : ""}`}>
                        <p className={`text-sm font-semibold ${e.status === "pendente" ? "text-gray-400" : "text-[#111111]"}`}>{e.titulo}</p>
                        <p className="text-[11px] font-medium mt-0.5">
                          {e.status === "concluido" ? <span className="text-green-600">Concluído{fmt(e.desde) ? ` • ${fmt(e.desde)}` : ""}</span>
                            : e.status === "em_andamento" ? <span className="text-[#243FF7]">Em andamento</span>
                            : <span className="text-gray-400">Pendente</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
