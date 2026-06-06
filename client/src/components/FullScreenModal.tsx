import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Modal em tela cheia, padrão do app: renderiza no body (portal, escapa do
 * transform da página), fica acima da navegação e tem cabeçalho com X.
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
    // Tela cheia, mas ABAIXO da navegação (z-40 < nav z-50): a barra inferior
    // renderiza por cima e fica intacta, igual a uma página normal. O
    // paddingBottom reserva a altura da nav para o conteúdo/rodapé não ficarem
    // sob ela.
    <div
      className="fixed inset-0 z-40 bg-white flex flex-col animate-in fade-in duration-150"
      style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-[#111111] truncate">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center go-btn-active shrink-0"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-md mx-auto">{children}</div>
      </div>
      {footer && <div className="p-4 border-t border-gray-100 shrink-0"><div className="max-w-md mx-auto">{footer}</div></div>}
    </div>,
    document.body,
  );
}
