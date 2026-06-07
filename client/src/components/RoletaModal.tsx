import { useMemo, useRef, useState } from "react";
import FullScreenModal from "./FullScreenModal";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Gift, Check, Sparkles, PartyPopper } from "lucide-react";
import { alertHaptic } from "@/lib/haptics";

type Premio = {
  id: number; nome: string; descricao: string | null; cor: string;
  peso: number; imagem: string | null; imagemUrl?: string | null;
};
type Roleta = {
  id: number; nome: string; descricao: string; mensagemChamada: string;
  mensagemPos: string; corDestaque: string; imagemUrl?: string | null; premios: Premio[];
};
type GiroResult = { giro: { id: number; premioNome: string; girouEm: string }; premio: Premio };

// Ponto na borda da roda para um ângulo (graus, sentido horário a partir do topo).
function pt(cx: number, cy: number, r: number, deg: number) {
  const a = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

export default function RoletaModal({
  roleta, contexto, onClose,
}: {
  roleta: Roleta; contexto?: Record<string, any>; onClose: () => void;
}) {
  const accent = roleta.corDestaque || "#243FF7";
  const premios = roleta.premios?.length ? roleta.premios : [];
  const total = premios.reduce((s, p) => s + Math.max(1, p.peso || 1), 0);

  // Fatias (ângulos acumulados, sentido horário a partir do topo).
  const slices = useMemo(() => {
    let acc = 0;
    return premios.map((p) => {
      const sweep = (Math.max(1, p.peso || 1) / total) * 360;
      const start = acc;
      const end = acc + sweep;
      acc = end;
      return { premio: p, start, end, mid: start + sweep / 2 };
    });
  }, [premios, total]);

  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [result, setResult] = useState<GiroResult | null>(null);
  const resgatado = useRef(false);

  const girar = trpc.roletas.girar.useMutation();
  const resgatar = trpc.roletas.resgatar.useMutation();

  const handleSpin = async () => {
    if (phase !== "idle") return;
    setPhase("spinning");
    try {
      const res = (await girar.mutateAsync({ roletaId: roleta.id, contexto })) as GiroResult;
      const slice = slices.find((s) => s.premio.id === res.premio.id) ?? slices[0];
      // Para a fatia premiada no topo (sob o ponteiro) + várias voltas.
      const target = 360 * 6 + (360 - slice.mid);
      setRotation(target);
      window.setTimeout(() => {
        setResult(res);
        setPhase("done");
        void alertHaptic("warning");
      }, 4200);
    } catch (e: any) {
      setPhase("idle");
      toast.error(e?.message || "Não foi possível girar agora.");
    }
  };

  const handleResgatar = async () => {
    if (!result || resgatado.current) return;
    resgatado.current = true;
    try {
      await resgatar.mutateAsync({ giroId: result.giro.id });
      toast.success("Prêmio resgatado! 🎉");
    } catch {
      resgatado.current = false;
      toast.error("Não foi possível resgatar agora.");
    }
    onClose();
  };

  const cx = 100, cy = 100, r = 95;

  return (
    <FullScreenModal title={roleta.nome} subtitle={roleta.descricao} onClose={onClose}>
      {phase !== "done" ? (
        <div className="flex flex-col items-center">
          <p className="text-center text-sm text-gray-600 mb-5">{roleta.mensagemChamada}</p>

          {/* Roda */}
          <div className="relative w-[280px] h-[280px] mb-7">
            {/* Ponteiro */}
            <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10"
              style={{ width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: `20px solid ${accent}` }}
            />
            <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-lg"
              style={{ transform: `rotate(${rotation}deg)`, transition: phase === "spinning" ? "transform 4s cubic-bezier(0.16,1,0.3,1)" : "none" }}
            >
              {slices.map((s, i) => {
                const a = pt(cx, cy, r, s.start);
                const b = pt(cx, cy, r, s.end);
                const large = s.end - s.start > 180 ? 1 : 0;
                const mid = pt(cx, cy, r * 0.62, s.mid);
                const fill = s.premio.cor || (i % 2 ? "#243FF7" : "#1a2fd4");
                return (
                  <g key={s.premio.id}>
                    <path d={`M${cx},${cy} L${a.x},${a.y} A${r},${r} 0 ${large} 1 ${b.x},${b.y} Z`} fill={fill} stroke="#fff" strokeWidth="1.5" />
                    <text x={mid.x} y={mid.y} fill="#fff" fontSize="7" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
                      transform={`rotate(${s.mid}, ${mid.x}, ${mid.y})`} style={{ pointerEvents: "none" }}>
                      {s.premio.nome.length > 16 ? s.premio.nome.slice(0, 15) + "…" : s.premio.nome}
                    </text>
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r="14" fill="#fff" stroke={accent} strokeWidth="3" />
            </svg>
          </div>

          <button
            onClick={handleSpin}
            disabled={phase === "spinning"}
            className="w-full max-w-xs h-13 min-h-[3rem] rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 go-btn-active disabled:opacity-70 shadow-lg"
            style={{ background: accent }}
          >
            {phase === "spinning" ? (
              <><Sparkles className="w-5 h-5 animate-pulse" /> Girando...</>
            ) : (
              <><Gift className="w-5 h-5" /> Girar a roleta</>
            )}
          </button>
          <p className="text-[11px] text-gray-400 mt-3 text-center">O resultado é definido com segurança no servidor.</p>
        </div>
      ) : (
        result && (
          <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: `${accent}1a` }}>
              <PartyPopper className="w-10 h-10" style={{ color: accent }} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Você ganhou</p>
            <h2 className="text-2xl font-extrabold text-[#111111] mt-1">{result.premio.nome}</h2>
            {result.premio.descricao && <p className="text-sm text-gray-600 mt-1">{result.premio.descricao}</p>}
            {result.premio.imagemUrl && (
              <img src={result.premio.imagemUrl} alt={result.premio.nome} className="w-28 h-28 object-contain my-4" />
            )}
            <div className="bg-gray-50 rounded-2xl p-4 mt-4 w-full">
              <p className="text-[13px] text-gray-600">{roleta.mensagemPos}</p>
            </div>
            <button
              onClick={handleResgatar}
              disabled={resgatar.isPending}
              className="w-full max-w-xs h-13 min-h-[3rem] mt-5 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-2 go-btn-active disabled:opacity-70"
              style={{ background: accent }}
            >
              <Check className="w-5 h-5" /> {resgatar.isPending ? "Resgatando..." : "Resgatar prêmio"}
            </button>
            <button onClick={onClose} className="mt-3 text-sm font-semibold text-gray-500 go-btn-active py-1">
              Guardar para depois
            </button>
          </div>
        )
      )}
    </FullScreenModal>
  );
}
