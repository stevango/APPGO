import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";

/**
 * Tela cheia (sobre a página atual), padrão do app: renderiza no body (portal,
 * escapa do transform da página), fica acima da navegação e tem uma seta de
 * VOLTAR à esquerda — igual às demais páginas, para a navegação ser consistente.
 */
export default function FullScreenModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return createPortal(
    // Tela cheia OPACA cobrindo a página (z-100). A navegação fica acima (z-120,
    // ver MobileLayout) e sempre íntegra. O paddingBottom reserva a altura da nav
    // (68px + o SOS que se projeta) para o conteúdo/rodapé não ficarem sob ela.
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-150"
      style={{ paddingBottom: "calc(92px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-2 px-3 py-4 border-b border-gray-100 shrink-0">
        <button
          onClick={onClose}
          aria-label="Voltar"
          className="w-9 h-9 rounded-full flex items-center justify-center go-btn-active shrink-0"
        >
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-[#111111] truncate">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-md mx-auto">{children}</div>
      </div>
      {footer && <div className="p-4 border-t border-gray-100 shrink-0"><div className="max-w-md mx-auto">{footer}</div></div>}
    </div>,
    document.body,
  );
}
