import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ChevronLeft, Search, Trash2, ExternalLink, Plus, Save, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminVehicleImages() {
  const [, setLocation] = useLocation();
  const { data: me } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const list = trpc.vehicleImages.list.useQuery(
    { make: make || undefined, model: model || undefined },
    { enabled: me?.role === "admin" },
  );

  const [edits, setEdits] = useState<Record<number, string>>({});
  const [novo, setNovo] = useState({ make: "", model: "", year: "", imageUrl: "" });

  const invalidate = () => utils.vehicleImages.list.invalidate();
  const update = trpc.vehicleImages.update.useMutation({
    onSuccess: () => { invalidate(); toast.success("Imagem atualizada!"); },
    onError: (e) => toast.error(e.message || "Erro ao salvar."),
  });
  const remove = trpc.vehicleImages.remove.useMutation({
    onSuccess: () => { invalidate(); toast.success("Removido."); },
  });
  const add = trpc.vehicleImages.setModel.useMutation({
    onSuccess: () => { invalidate(); setNovo({ make: "", model: "", year: "", imageUrl: "" }); toast.success("Adicionado à biblioteca!"); },
    onError: (e) => toast.error(e.message || "Verifique os campos (URL válida?)."),
  });

  if (me && me.role !== "admin") {
    return (
      <div className="px-4 pt-10 text-center">
        <p className="font-semibold text-gray-700">Acesso restrito</p>
        <p className="text-sm text-gray-500 mt-1">Esta área é exclusiva para administradores.</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/")}>Voltar</Button>
      </div>
    );
  }

  const rows = list.data ?? [];

  return (
    <div className="px-4 pb-10">
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-1 bg-[#F5F6FA]/90 backdrop-blur flex items-center gap-3">
        <button onClick={() => setLocation("/profile")} className="go-btn-active" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111]">Biblioteca de imagens</h1>
      </div>
      <p className="text-xs text-gray-500 mb-4 ml-9">Curadoria de fotos por montadora e modelo.</p>

      {/* Filtro */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={make} onChange={(e) => setMake(e.target.value)}
            placeholder="Montadora (ex: nissan)"
            className="flex-1 py-2.5 text-sm outline-none bg-transparent"
          />
        </div>
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            value={model} onChange={(e) => setModel(e.target.value)}
            placeholder="Modelo (ex: versa)"
            className="flex-1 py-2.5 text-sm outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Adicionar novo */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
        <p className="text-sm font-semibold text-[#111] mb-3">Adicionar imagem</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input value={novo.make} onChange={(e) => setNovo({ ...novo, make: e.target.value })}
            placeholder="Montadora" className="col-span-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none" />
          <input value={novo.model} onChange={(e) => setNovo({ ...novo, model: e.target.value })}
            placeholder="Modelo" className="col-span-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none" />
          <input value={novo.year} onChange={(e) => setNovo({ ...novo, year: e.target.value.replace(/\D/g, "") })}
            placeholder="Ano (opcional)" inputMode="numeric" className="col-span-1 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none" />
        </div>
        <input value={novo.imageUrl} onChange={(e) => setNovo({ ...novo, imageUrl: e.target.value })}
          placeholder="https://...png" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none mb-3" />
        <Button
          className="w-full bg-[#243FF7] hover:bg-[#1e35d6]"
          disabled={add.isPending || !novo.make || !novo.model || !novo.imageUrl}
          onClick={() => add.mutate({
            make: novo.make, model: novo.model,
            year: novo.year ? Number(novo.year) : undefined,
            imageUrl: novo.imageUrl,
          })}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar à biblioteca
        </Button>
      </div>

      {/* Lista */}
      {list.isLoading ? (
        <p className="text-sm text-gray-500 text-center py-8">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <ImageOff className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Nenhuma imagem na biblioteca{make || model ? " com esse filtro" : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => {
            const current = edits[r.id] ?? r.imageUrl;
            const dirty = current !== r.imageUrl;
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                    {current ? (
                      <img src={current} alt="" className="w-full h-full object-contain" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")} />
                    ) : <ImageOff className="w-5 h-5 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#111] capitalize">{r.make} <span className="font-semibold">{r.model}</span></p>
                    <p className="text-xs text-gray-500 capitalize">{r.make} {r.model} {r.year ?? ""} · {r.source}</p>
                  </div>
                  <button onClick={() => remove.mutate({ id: r.id })} className="text-red-400 go-btn-active p-1" aria-label="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <input
                    value={current}
                    onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })}
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none text-gray-600"
                  />
                  <a href={r.imageUrl} target="_blank" rel="noreferrer" className="text-gray-500 go-btn-active p-1.5" aria-label="Abrir">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    disabled={!dirty || update.isPending}
                    onClick={() => update.mutate({ id: r.id, imageUrl: current })}
                    className={`flex items-center gap-1 text-xs font-bold rounded-lg px-3 py-2 ${
                      dirty ? "bg-[#243FF7] text-white" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
