import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Share2, Link2, Copy, Check, Trash2,
  Clock, Eye, Car, Plus, ShieldAlert, ExternalLink,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const DURATION_OPTIONS = [
  { value: "1h" as const, label: "1 hora" },
  { value: "4h" as const, label: "4 horas" },
  { value: "12h" as const, label: "12 horas" },
  { value: "24h" as const, label: "24 horas" },
  { value: "48h" as const, label: "48 horas" },
];

type LinkStatus = "active" | "expiring_soon" | "expired" | "revoked";

function getLinkStatus(link: { active: boolean | null; expiresAt: string | Date }): LinkStatus {
  if (!link.active) return "revoked";
  const diff = new Date(link.expiresAt).getTime() - Date.now();
  if (diff <= 0) return "expired";
  if (diff <= 60 * 60 * 1000) return "expiring_soon"; // < 1h
  return "active";
}

function getStatusConfig(status: LinkStatus) {
  switch (status) {
    case "active":
      return {
        label: "Ativo",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/30",
        dot: "bg-emerald-400",
      };
    case "expiring_soon":
      return {
        label: "Expirando",
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/30",
        dot: "bg-amber-400",
      };
    case "expired":
      return {
        label: "Expirado",
        color: "text-white/40",
        bg: "bg-white/5",
        border: "border-white/10",
        dot: "bg-white/40",
      };
    case "revoked":
      return {
        label: "Revogado",
        color: "text-red-400/70",
        bg: "bg-red-400/5",
        border: "border-red-400/20",
        dot: "bg-red-400/70",
      };
  }
}

export default function ShareLocation() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<"1h" | "4h" | "12h" | "24h" | "48h">("4h");
  const [label, setLabel] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: number; label: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Atualizar countdown a cada 30s
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  const { data: vehicles } = trpc.vehicles.list.useQuery();
  const utils = trpc.useUtils();
  const { data: links, isLoading } = trpc.sharing.list.useQuery(undefined, {
    refetchInterval: 60000, // Refetch a cada 1min para atualizar status
  });

  const createMutation = trpc.sharing.create.useMutation({
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/shared/${data.token}`;
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link criado e copiado!");
      setShowCreate(false);
      setLabel("");
      utils.sharing.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao criar link"),
  });

  const revokeMutation = trpc.sharing.revoke.useMutation({
    onSuccess: () => {
      toast.success("Link revogado com sucesso");
      setRevokeTarget(null);
      utils.sharing.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao revogar link");
      setRevokeTarget(null);
    },
  });

  const vehicleId = vehicles?.[0]?.id;

  const handleCreate = () => {
    if (!vehicleId) return;
    createMutation.mutate({
      vehicleId,
      label: label || undefined,
      duration: selectedDuration,
    });
  };

  const copyLink = useCallback((token: string, id: number) => {
    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleRevoke = (id: number, linkLabel: string) => {
    setRevokeTarget({ id, label: linkLabel });
  };

  const confirmRevoke = () => {
    if (revokeTarget) {
      revokeMutation.mutate({ id: revokeTarget.id });
    }
  };

  // Separar links por status
  const activeLinks = links?.filter(l => {
    const status = getLinkStatus(l);
    return status === "active" || status === "expiring_soon";
  }) || [];

  const inactiveLinks = links?.filter(l => {
    const status = getLinkStatus(l);
    return status === "expired" || status === "revoked";
  }) || [];

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0f1c]/95 backdrop-blur-sm border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full hover:bg-white/10 active:scale-95 transition-all">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Compartilhar Localização</h1>
          <p className="text-xs text-white/50">Gerencie links de compartilhamento</p>
        </div>
        <div className="flex items-center gap-2">
          {activeLinks.length > 0 && (
            <span className="text-xs bg-[#243FF7]/20 text-[#7B93FF] px-2 py-0.5 rounded-full font-medium">
              {activeLinks.length} ativo{activeLinks.length > 1 ? "s" : ""}
            </span>
          )}
          <Share2 size={20} className="text-[#243FF7]" />
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Indicador de limite */}
        {activeLinks.length > 0 && (
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-white/40">Links ativos</span>
            <span className={`text-xs font-medium ${activeLinks.length >= 5 ? "text-amber-400" : "text-white/50"}`}>
              {activeLinks.length}/5
            </span>
          </div>
        )}

        {/* Botão criar novo link */}
        {!showCreate && (
          activeLinks.length >= 5 ? (
            <div className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-amber-400/20">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-amber-400">Limite atingido</p>
                <p className="text-xs text-white/50">Revogue um link ativo para criar um novo (máx. 5)</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#243FF7] to-[#1a2fd4] active:scale-[0.98] transition-transform shadow-lg shadow-[#243FF7]/20"
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Plus size={20} />
              </div>
              <div className="text-left">
                <p className="font-semibold">Criar novo link</p>
                <p className="text-xs text-white/70">Gere um link temporário para compartilhar</p>
              </div>
            </button>
          )
        )}

        {/* Formulário de criação */}
        {showCreate && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Link2 size={18} className="text-[#E2FF04]" />
                Novo link de compartilhamento
              </h3>
              <button onClick={() => setShowCreate(false)} className="text-xs text-white/50 hover:text-white/80 transition-colors">
                Cancelar
              </button>
            </div>

            {/* Label opcional */}
            <div>
              <label className="text-xs text-white/60 mb-1 block">Nome do contato (opcional)</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Ex: Esposa, Mecânico, Seguradora..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm placeholder:text-white/30 focus:outline-none focus:border-[#243FF7] transition-colors"
              />
            </div>

            {/* Duração */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Duração do link</label>
              <div className="grid grid-cols-5 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedDuration(opt.value)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium transition-all ${
                      selectedDuration === opt.value
                        ? "bg-[#243FF7] text-white shadow-md shadow-[#243FF7]/30"
                        : "bg-white/5 text-white/60 border border-white/10 hover:border-white/20"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info de segurança */}
            <div className="bg-[#E2FF04]/10 border border-[#E2FF04]/20 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert size={16} className="text-[#E2FF04] mt-0.5 shrink-0" />
              <p className="text-xs text-[#E2FF04]/90">
                <strong>Segurança:</strong> A placa será parcialmente mascarada. O link expira automaticamente e pode ser revogado a qualquer momento.
              </p>
            </div>

            {/* Botão criar */}
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !vehicleId}
              className="w-full bg-[#E2FF04] text-black font-semibold rounded-xl h-12 hover:bg-[#d4f000] active:scale-[0.98] transition-all"
            >
              {createMutation.isPending ? "Gerando..." : "Gerar Link e Copiar"}
            </Button>
          </div>
        )}

        {/* Seção de Links Ativos */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
            <Skeleton className="h-24 rounded-2xl bg-white/5" />
          </div>
        ) : (
          <>
            {/* Links ativos */}
            {activeLinks.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Links ativos
                  </h3>
                  <span className="text-xs text-white/40">{activeLinks.length} link{activeLinks.length > 1 ? "s" : ""}</span>
                </div>
                {activeLinks.map(link => (
                  <ShareLinkCard
                    key={link.id}
                    link={link}
                    copiedId={copiedId}
                    now={now}
                    onCopy={() => copyLink(link.token, link.id)}
                    onRevoke={() => handleRevoke(link.id, link.label || "Link compartilhado")}
                  />
                ))}
              </div>
            ) : inactiveLinks.length > 0 && !showCreate ? (
              <div className="text-center py-8 rounded-2xl bg-white/[0.02] border border-dashed border-white/10">
                <div className="w-12 h-12 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-3">
                  <Link2 size={22} className="text-white/30" />
                </div>
                <p className="text-white/50 text-sm font-medium">Nenhum link ativo</p>
                <p className="text-white/30 text-xs mt-1">Crie um novo link para compartilhar a localização</p>
              </div>
            ) : null}

            {/* Links inativos */}
            {inactiveLinks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/40 px-1 flex items-center gap-2">
                  <Clock size={14} />
                  Histórico ({inactiveLinks.length})
                </h3>
                {inactiveLinks.slice(0, 5).map(link => (
                  <ShareLinkCard
                    key={link.id}
                    link={link}
                    inactive
                    copiedId={copiedId}
                    now={now}
                    onCopy={() => {}}
                    onRevoke={() => {}}
                  />
                ))}
                {inactiveLinks.length > 5 && (
                  <p className="text-xs text-white/30 text-center py-2">
                    +{inactiveLinks.length - 5} links anteriores
                  </p>
                )}
              </div>
            )}

            {/* Estado vazio */}
            {links?.length === 0 && !showCreate && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#243FF7]/20 to-[#243FF7]/5 flex items-center justify-center mb-5">
                  <Share2 size={32} className="text-[#243FF7]/60" />
                </div>
                <p className="text-white/60 font-medium mb-1">Nenhum link criado</p>
                <p className="text-white/30 text-sm max-w-[250px] mx-auto">
                  Compartilhe a localização do seu veículo em tempo real com quem você confia
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog de confirmação de revogação */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent className="bg-[#1a1f2e] border-white/10 text-white max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-white">
              <AlertTriangle size={20} className="text-amber-400" />
              Revogar link
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Tem certeza que deseja revogar o link <strong className="text-white/90">"{revokeTarget?.label}"</strong>? 
              Quem tiver este link não poderá mais ver a localização do veículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRevoke}
              disabled={revokeMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl"
            >
              {revokeMutation.isPending ? "Revogando..." : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ShareLinkCard({ link, inactive, copiedId, now, onCopy, onRevoke }: {
  link: any;
  inactive?: boolean;
  copiedId: number | null;
  now: number;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const status = getLinkStatus(link);
  const config = getStatusConfig(status);
  const timeLeft = getTimeLeft(link.expiresAt);
  const isCopied = copiedId === link.id;
  const createdDate = new Date(link.createdAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      inactive 
        ? "bg-white/[0.02] border-white/5 opacity-60" 
        : `bg-white/5 ${config.border}`
    }`}>
      {/* Status badge + label */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Car size={14} className="text-[#243FF7] shrink-0" />
            <span className="text-sm font-medium truncate">{link.label || "Link compartilhado"}</span>
          </div>
          {/* Status pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === "active" ? "animate-pulse" : ""}`} />
              {config.label}
            </span>
            {!inactive && (
              <span className="text-[11px] text-white/40 flex items-center gap-1">
                <Clock size={11} />
                {timeLeft}
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        {!inactive && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCopy}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
              title="Copiar link"
            >
              {isCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-white/70" />}
            </button>
            <button
              onClick={onRevoke}
              className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all"
              title="Revogar link"
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        )}
      </div>

      {/* Metadados */}
      <div className="flex items-center gap-4 text-[11px] text-white/40 border-t border-white/5 pt-2.5 mt-1">
        <span className="flex items-center gap-1">
          <Eye size={11} />
          {link.viewCount || 0} visualizaç{(link.viewCount || 0) === 1 ? "ão" : "ões"}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} />
          Criado {createdDate}
        </span>
        {!inactive && (
          <a
            href={`/shared/${link.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#243FF7]/70 hover:text-[#243FF7] transition-colors ml-auto"
          >
            <ExternalLink size={11} />
            Visualizar
          </a>
        )}
      </div>
    </div>
  );
}

function getTimeLeft(expiresAt: string | Date): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h restantes`;
  }
  if (hours > 0) return `${hours}h ${minutes}min restantes`;
  if (minutes > 0) return `${minutes}min restantes`;
  return "< 1min";
}
