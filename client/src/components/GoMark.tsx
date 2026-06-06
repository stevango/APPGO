import { useState } from "react";

/**
 * Marca GO. Usa o arquivo oficial em /logo-go.png (coloque em client/public/).
 * Se o arquivo não existir, cai no wordmark "Go!" como fallback — nada quebra.
 * Versão branca recomendada para fundos azuis (loaders/splash).
 */
export default function GoMark({ className = "", height = 40 }: { className?: string; height?: number }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <span className={`font-black text-white tracking-tight ${className}`} style={{ fontSize: height * 0.7 }}>
        Go<span className="text-[#E2FF04]">!</span>
      </span>
    );
  }
  return (
    <img
      src="/logo-go.png"
      alt="GO"
      onError={() => setOk(false)}
      style={{ height }}
      className={`w-auto object-contain ${className}`}
    />
  );
}
