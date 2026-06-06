import { AlertCircle } from "lucide-react";

/**
 * Estado de erro padrão do app (falha ao carregar dados). Mantém a tela honesta
 * — em vez de parecer "vazia" — e oferece "Tentar novamente".
 */
export default function ErrorState({
  title = "Não foi possível carregar",
  message = "Verifique sua conexão e tente novamente.",
  onRetry,
  retrying = false,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="text-center py-16 px-6 space-y-4 animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 rounded-xl bg-[#243FF7] text-white font-semibold px-5 py-2.5 go-btn-active disabled:opacity-60"
        >
          {retrying ? "Tentando..." : "Tentar novamente"}
        </button>
      )}
    </div>
  );
}
