import FullScreenModal from "./FullScreenModal";
import { Switch } from "@/components/ui/switch";
import { useAccessibility, type FontScale } from "@/contexts/AccessibilityContext";
import { alertHaptic } from "@/lib/haptics";
import { Type, Contrast, Sparkles, Vibrate, Ear, Eye } from "lucide-react";

const FONT_OPTIONS: { key: FontScale; label: string; sample: string }[] = [
  { key: "normal", label: "Normal", sample: "A" },
  { key: "large", label: "Grande", sample: "A" },
  { key: "xlarge", label: "Maior", sample: "A" },
];

function Row({
  icon: Icon, title, desc, checked, onChange,
}: {
  icon: any; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-[#243FF7]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#111111]">{title}</p>
        <p className="text-xs text-gray-500 leading-snug">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0 data-[state=checked]:bg-[#243FF7]" aria-label={title} />
    </div>
  );
}

export default function AccessibilityPanel({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useAccessibility();

  return (
    <FullScreenModal title="Acessibilidade" subtitle="Deixe o GO do seu jeito" onClose={onClose}>
      {/* Tamanho do texto (visão reduzida) */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Type className="w-4 h-4 text-[#243FF7]" />
          <h3 className="text-sm font-bold text-[#111111]">Tamanho do texto</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((opt) => {
            const active = settings.fontScale === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setSettings({ fontScale: opt.key })}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 go-btn-active ${
                  active ? "border-[#243FF7] bg-[#243FF7]/5" : "border-gray-100 bg-gray-50"
                }`}
              >
                <span
                  className={`font-black ${active ? "text-[#243FF7]" : "text-gray-500"}`}
                  style={{ fontSize: opt.key === "normal" ? 16 : opt.key === "large" ? 20 : 26 }}
                >
                  {opt.sample}
                </span>
                <span className={`text-[11px] font-semibold ${active ? "text-[#243FF7]" : "text-gray-500"}`}>{opt.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Aumenta o texto e os controles de todo o app.</p>
      </div>

      {/* Visão */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 divide-y divide-gray-50 mb-5">
        <Row
          icon={Contrast}
          title="Alto contraste"
          desc="Texto e bordas mais fortes, melhor leitura sob sol ou baixa visão."
          checked={settings.highContrast}
          onChange={(v) => setSettings({ highContrast: v })}
        />
        <Row
          icon={Sparkles}
          title="Reduzir animações"
          desc="Menos movimento na tela. Bom para sensibilidade visual/vestibular."
          checked={settings.reduceMotion}
          onChange={(v) => setSettings({ reduceMotion: v })}
        />
      </div>

      {/* Audição */}
      <div className="bg-white rounded-2xl border border-gray-100 px-4 mb-5">
        <Row
          icon={Vibrate}
          title="Vibrar em alertas"
          desc="Alertas críticos também vibram o aparelho — você não depende do som."
          checked={settings.hapticAlerts}
          onChange={(v) => { setSettings({ hapticAlerts: v }); if (v) void alertHaptic("warning"); }}
        />
      </div>

      {/* Nota leitor de tela */}
      <div className="bg-[#243FF7]/5 border border-[#243FF7]/10 rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#243FF7]" />
          <Ear className="w-4 h-4 text-[#243FF7]" />
          <p className="text-[13px] font-bold text-[#243FF7]">Leitor de tela e legendas</p>
        </div>
        <p className="text-[12px] text-gray-600 leading-relaxed">
          O GO é compatível com <span className="font-semibold">VoiceOver (iPhone)</span> e
          <span className="font-semibold"> TalkBack (Android)</span>: botões, status e alertas
          têm descrições por voz. Alertas importantes aparecem sempre como
          <span className="font-semibold"> texto + vibração</span>, nunca só por som.
        </p>
      </div>
    </FullScreenModal>
  );
}
