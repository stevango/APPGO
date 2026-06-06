import { useState } from "react";
import { createPortal } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, Copy, Car, MapPin, FileText, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BrandMark, LicensePlate, AssetTag } from "@/lib/vehicle";
import { isVehicleAsset } from "@/lib/assetIcons";
import { getVehicleImageUrl } from "@/lib/vehicleImage";
import { getTrackerStatus } from "@/lib/trackerStatus";

// Placa e chassi NÃO são editáveis (chaves contratuais B2B no GO360).
const EDIT_FIELDS: Array<{ key: string; label: string; numeric?: boolean; max?: number }> = [
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "cor", label: "Cor" },
  { key: "anoFabricacao", label: "Ano de fabricação", numeric: true },
  { key: "anoModelo", label: "Ano do modelo", numeric: true },
  { key: "renavam", label: "Renavam", numeric: true },
  { key: "combustivel", label: "Combustível" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado (UF)", max: 2 },
];

export default function VehicleDetails() {
  const [, params] = useRoute("/vehicle/:id");
  const [, setLocation] = useLocation();
  const id = Number(params?.id);
  const utils = trpc.useUtils();
  const { data: vehicles, isLoading } = trpc.vehicles.list.useQuery();
  const vehicle = vehicles?.find((v) => v.id === id);
  const [imgOk, setImgOk] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const go360 = trpc.go360.status.useQuery();
  // Status oficial do rastreador (régua mantida pela GO360; cai na régua local se indisponível)
  const monitoring = trpc.monitoring.status.useQuery(
    { vehicleId: id },
    { enabled: Number.isFinite(id) && id > 0, staleTime: 60000, retry: false },
  );
  const updateMut = trpc.go360.updateEquipamento.useMutation({
    onSuccess: (res: any) => {
      if (res?.ok) {
        utils.vehicles.list.invalidate();
        setEditing(false);
        toast.success("Dados atualizados!");
      } else if (res?.reason === "unavailable") {
        toast("Edição estará disponível em breve (aguardando a GO360 liberar).");
      } else if (res?.reason === "invalid") {
        toast.error("Algum campo não passou na validação. Confira e tente de novo.");
      } else {
        toast("Edição indisponível para este equipamento.");
      }
    },
    onError: (e) => toast.error(e.message || "Não foi possível salvar."),
  });

  const goBack = () => (window.history.length > 1 ? window.history.back() : setLocation("/"));

  const openEdit = () => {
    if (!vehicle) return;
    const [cidadePart = "", estadoPart = ""] = String(vehicle.cityState ?? "").split(" - ");
    setForm({
      marca: vehicle.brand ?? "",
      modelo: vehicle.model ?? "",
      cor: vehicle.color ?? "",
      anoFabricacao: vehicle.anoFabricacao != null ? String(vehicle.anoFabricacao) : "",
      anoModelo: vehicle.anoModelo != null ? String(vehicle.anoModelo) : (vehicle.year != null ? String(vehicle.year) : ""),
      renavam: vehicle.renavam ?? "",
      combustivel: vehicle.fuel ?? "",
      cidade: cidadePart,
      estado: estadoPart,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (!vehicle) return;
    const [cidadeCur = "", estadoCur = ""] = String(vehicle.cityState ?? "").split(" - ");
    const cur: Record<string, any> = {
      marca: vehicle.brand ?? "", modelo: vehicle.model ?? "", cor: vehicle.color ?? "",
      anoFabricacao: vehicle.anoFabricacao ?? "", anoModelo: vehicle.anoModelo ?? vehicle.year ?? "",
      renavam: vehicle.renavam ?? "", combustivel: vehicle.fuel ?? "", cidade: cidadeCur, estado: estadoCur,
    };
    const patch: Record<string, any> = {};
    for (const f of EDIT_FIELDS) {
      const raw = (form[f.key] ?? "").trim();
      if (f.numeric) {
        const n = raw === "" ? undefined : Number(raw);
        if (n !== undefined && String(n) !== String(cur[f.key])) patch[f.key] = n;
      } else if (raw !== String(cur[f.key] ?? "")) {
        patch[f.key] = raw; // "" limpa o override no GO360
      }
    }
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    if (patch.estado && patch.estado.length !== 2) { toast.error("Estado deve ter 2 letras (UF)."); return; }
    updateMut.mutate({ vehicleId: vehicle.id, patch });
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-6">
        <Skeleton className="w-40 h-6 mb-4" />
        <Skeleton className="w-full h-44 rounded-3xl mb-4" />
        <Skeleton className="w-full h-72 rounded-2xl" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="px-4 pt-10 flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Car className="w-8 h-8 text-gray-300" />
        </div>
        <p className="font-semibold text-gray-700">Veículo não encontrado</p>
        <button onClick={() => setLocation("/")} className="mt-4 text-[#243FF7] font-semibold go-btn-active">Voltar ao início</button>
      </div>
    );
  }

  const imgUrl = getVehicleImageUrl(vehicle);
  const showImg = !!imgUrl && imgOk;

  const rows: Array<{ label: string; value: any; copy?: boolean }> = [
    { label: "Marca", value: vehicle.brand },
    { label: "Modelo", value: vehicle.model },
    { label: "Placa", value: vehicle.plate },
    { label: "Cor", value: vehicle.color },
    { label: "Ano de fabricação", value: vehicle.anoFabricacao },
    { label: "Ano do modelo", value: vehicle.anoModelo ?? vehicle.year },
    { label: "Chassi", value: vehicle.chassi, copy: true },
    { label: "Renavam", value: vehicle.renavam, copy: true },
    { label: "Combustível", value: vehicle.fuel },
    { label: "Município/UF", value: vehicle.cityState },
    { label: "Rastreador", value: vehicle.trackerModel },
    { label: "Série / IMEI", value: vehicle.trackerSerial, copy: true },
  ].filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

  return (
    <div className="px-4 pb-6">
      {/* Header (fixo no topo) */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-6 pb-3 mb-2 bg-[#F5F6FA]/90 backdrop-blur flex items-center gap-3">
        <button onClick={goBack} className="go-btn-active" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <h1 className="text-lg font-bold text-[#111111] flex-1">Detalhes do veículo</h1>
      </div>

      {/* Hero */}
      {showImg ? (
        <div className="relative mb-4 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-slate-200 h-48 overflow-hidden flex items-center justify-center">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 bg-white/60 blur-2xl rounded-full pointer-events-none" />
          <img
            src={imgUrl!}
            alt={`${vehicle.brand} ${vehicle.model}`}
            onError={() => setImgOk(false)}
            loading="lazy"
            className="relative h-[180px] w-auto max-w-[92%] object-contain pointer-events-none drop-shadow-[0_18px_22px_rgba(15,23,42,0.25)]"
          />
        </div>
      ) : (
        <div className="mb-4 flex justify-center">
          <BrandMark brand={vehicle.brand} iconType={vehicle.iconType} className="w-24 h-24" />
        </div>
      )}

      {/* Título + placa (placa em linha própria para não quebrar) */}
      <div className="mb-4">
        <h2 className="text-[17px] font-extrabold text-[#0f172a] leading-tight">{vehicle.brand} {vehicle.model}</h2>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">Ficha completa</p>
        {isVehicleAsset(vehicle.iconType) ? (
          <LicensePlate plate={vehicle.plate} size="md" />
        ) : (
          <AssetTag label={vehicle.plate} size="md" />
        )}
      </div>

      {/* Status oficial do rastreador (fonte: GO360) */}
      {(() => {
        const m = monitoring.data;
        const local = getTrackerStatus(vehicle.lastSignalAt);
        const cor = m?.rotulo?.cor || (local.key === "online" ? "#16a34a" : local.key === "standby" ? "#d97706" : "#ef4444");
        const label = m?.rotulo?.label || local.label;
        const descricao = m?.rotulo?.descricao;
        const horas = m?.horasSemComunicar;
        return (
          <div className="go-card p-4 mb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cor }} />
                <span className="text-[15px] font-bold truncate" style={{ color: cor }}>{label}</span>
              </div>
              <span className="text-[10px] font-medium text-gray-400 shrink-0">
                {m ? "via GO360" : "estimado"}
              </span>
            </div>
            {descricao && <p className="text-[13px] text-gray-600 leading-snug mt-1.5">{descricao}</p>}
            {typeof horas === "number" && (
              <p className="text-[12px] text-gray-400 mt-1">
                Sem comunicar há {horas < 1 ? "menos de 1h" : `${Math.round(horas)}h`}.
              </p>
            )}
          </div>
        );
      })()}

      {/* Ficha */}
      <div className="go-card p-4">
        <div className="flex items-center justify-between mb-1 pb-2 border-b border-gray-100">
          <h3 className="text-[13px] font-bold text-[#111111]">Dados do veículo</h3>
          {go360.data?.enabled && (vehicle as any).go360AtivoId && isVehicleAsset(vehicle.iconType) && (
            <button
              onClick={openEdit}
              className="flex items-center gap-1 text-[13px] font-semibold text-[#243FF7] bg-[#243FF7]/8 rounded-full px-3 py-1.5 go-btn-active"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-100">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[13px] text-gray-500">{r.label}</span>
              <span className="text-[13px] font-semibold text-[#111111] text-right flex items-center gap-1.5 min-w-0">
                <span className="truncate">{String(r.value)}</span>
                {r.copy && (
                  <button
                    onClick={() => { navigator.clipboard?.writeText(String(r.value)); toast.success("Copiado!"); }}
                    className="go-btn-active text-gray-400 shrink-0"
                    aria-label={`Copiar ${r.label}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Localização atalho */}
      <button
        onClick={() => setLocation("/tracking")}
        className="mt-3 w-full go-card p-4 flex items-center gap-3 text-left go-btn-active"
      >
        <div className="w-10 h-10 rounded-xl bg-[#243FF7]/8 flex items-center justify-center shrink-0">
          <MapPin className="w-5 h-5 text-[#243FF7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#111111]">Ver no mapa</p>
          <p className="text-[11px] text-gray-400 truncate">{vehicle.lastAddress || "Acompanhe a localização"}</p>
        </div>
        <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
      </button>

      {/* Ficha técnica (render nativo a partir dos dados da GO360) */}
      {(() => {
        const hasFicha = !!vehicle.fichaData && typeof vehicle.fichaData === "object" && Object.keys(vehicle.fichaData).length > 0;
        return (
          <button
            onClick={() => {
              if (hasFicha) setLocation(`/ficha/${vehicle.id}`);
              else toast("Ficha técnica chegando em breve, direto da GO360. 🚗");
            }}
            className="mt-3 w-full go-card p-4 flex items-center gap-3 text-left go-btn-active"
          >
            <div className="w-10 h-10 rounded-xl bg-[#243FF7]/8 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-[#243FF7]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[#111111]">Ficha técnica do veículo</p>
                {!hasFicha && (
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">EM BREVE</span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {hasFicha ? "Motor, potência, consumo e mais" : "Motor, potência, consumo e mais — via GO360"}
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-gray-300 rotate-180" />
          </button>
        );
      })()}

      <p className="text-[11px] text-gray-400 mt-4 leading-relaxed px-1">
        Dados fornecidos pelo cadastro do veículo. Encontrou algo errado? Toque em Editar para corrigir.
      </p>

      {/* Modal de edição (grava no GO360) */}
      {editing && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl p-5 max-h-[88vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#111111]">Editar dados</h3>
              <button onClick={() => setEditing(false)} aria-label="Fechar" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center go-btn-active">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-[11px] font-semibold text-gray-400">{f.label}</label>
                  <input
                    value={form[f.key] ?? ""}
                    inputMode={f.numeric ? "numeric" : "text"}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: f.numeric ? e.target.value.replace(/\D/g, "") : e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#243FF7]"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              As alterações são enviadas para a GO360. Campos oficiais (placa, chassi, renavam) podem passar por validação.
            </p>
            <Button
              className="w-full mt-4 bg-[#243FF7] hover:bg-[#1e35d6]"
              onClick={saveEdit}
              disabled={updateMut.isPending}
            >
              {updateMut.isPending ? "Salvando..." : <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Salvar alterações</span>}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
