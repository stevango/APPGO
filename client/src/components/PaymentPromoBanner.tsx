import { ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { CreditCard, ChevronRight } from "lucide-react";

/**
 * Banner de promoção de pagamento — TOTALMENTE configurado no GO360 (texto,
 * cores, CTA, badge). O app só renderiza. Se não houver promoção ativa (ou a
 * API não estiver configurada), mostra o `fallback` (banner padrão do app).
 */
export default function PaymentPromoBanner({ fallback = null }: { fallback?: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data } = trpc.paymentPromo.promocao.useQuery(undefined, {
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  const promo = data?.promocao;
  if (!promo) return <>{fallback}</>;

  return (
    <button
      onClick={() => setLocation("/payment")}
      className="mb-5 w-full rounded-2xl p-4 text-left go-btn-active shadow-lg relative overflow-hidden"
      style={{ background: promo.bannerCor, color: promo.bannerCorTexto }}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />
      <div className="flex items-center gap-3 relative">
        <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
          <CreditCard className="w-6 h-6" style={{ color: promo.bannerCorCta }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[15px]" style={{ color: promo.bannerCorTexto }}>{promo.bannerTitulo}</p>
            {promo.bannerBadge && (
              <span className="text-[10px] font-black rounded-full px-1.5 py-0.5" style={{ background: promo.bannerCorCta, color: promo.bannerCor }}>
                {promo.bannerBadge}
              </span>
            )}
          </div>
          <p className="text-xs leading-snug mt-0.5 opacity-90">{promo.bannerSubtitulo}</p>
        </div>
        <ChevronRight className="w-5 h-5 shrink-0 opacity-80" />
      </div>
      <div className="mt-3 text-center font-bold text-[13px] rounded-xl py-2.5 relative flex items-center justify-center gap-1"
        style={{ background: promo.bannerCorCta, color: promo.bannerCor }}>
        {promo.bannerCta} <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}
