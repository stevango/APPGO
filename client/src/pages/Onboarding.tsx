import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Shield, MapPin, Bell, Zap } from "lucide-react";

export default function Onboarding() {
  return (
    <div className="min-h-screen bg-[#243FF7] flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/3 -left-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute bottom-1/4 right-10 w-24 h-24 bg-[#E2FF04]/10 rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col flex-1 px-6 pt-16 pb-10">
        {/* Logo */}
        <div className="flex items-center justify-center mb-12">
          <div className="text-6xl font-black text-white tracking-tight">
            Go<span className="text-[#E2FF04]">!</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-bold text-white mb-3">
            Tecnologia que protege.
          </h1>
          <p className="text-lg text-white/80">
            Confiança que acompanha.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <FeatureCard icon={MapPin} title="Rastreamento" subtitle="Tempo real" />
          <FeatureCard icon={Shield} title="Segurança" subtitle="Bloqueio remoto" />
          <FeatureCard icon={Bell} title="Alertas" subtitle="Notificações" />
          <FeatureCard icon={Zap} title="SOS" subtitle="Emergência 24h" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            className="w-full h-14 bg-[#E2FF04] text-[#111111] font-bold text-base rounded-xl hover:bg-[#E2FF04]/90 go-btn-active"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Entrar na minha conta
          </Button>
          <Button
            variant="outline"
            className="w-full h-14 border-white/30 text-white font-medium text-base rounded-xl hover:bg-white/10 go-btn-active"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Criar conta
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          GO Direction - Tecnologia que conecta.
        </p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
      <Icon className="w-6 h-6 text-[#E2FF04] mb-2" />
      <p className="text-white font-semibold text-sm">{title}</p>
      <p className="text-white/60 text-xs">{subtitle}</p>
    </div>
  );
}
