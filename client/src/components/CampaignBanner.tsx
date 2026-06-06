import { useCampaignTheme } from "@/lib/campaignTheme";

/**
 * Faixa sazonal sutil (cor/slogan/ícone do dia) — sincronizada com a GO360.
 * Só aparece quando há campanha vigente; caso contrário não renderiza nada.
 * Usa a cor da campanha como destaque, sem competir com a marca GO.
 */
export default function CampaignBanner() {
  const c = useCampaignTheme();
  if (!c.vigente || (!c.nome && !c.slogan)) return null;

  const cor = c.cor || "#243FF7";
  const cor2 = c.cor2 || cor;

  return (
    <div
      className="mb-5 rounded-2xl p-3.5 flex items-center gap-3 overflow-hidden relative stagger-item"
      style={{ background: `linear-gradient(135deg, ${cor}, ${cor2})` }}
      role="status"
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
      {c.icone && (
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 relative">
          {c.icone}
        </div>
      )}
      <div className="flex-1 min-w-0 relative">
        {c.nome && (
          <p className="text-white font-bold text-[14px] leading-tight truncate">{c.nome}</p>
        )}
        {c.slogan && (
          <p className="text-white/85 text-xs leading-snug mt-0.5">{c.slogan}</p>
        )}
      </div>
    </div>
  );
}
