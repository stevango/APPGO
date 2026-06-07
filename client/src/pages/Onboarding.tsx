import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { Shield, MapPin, Bell, Zap, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import GoMark from "@/components/GoMark";

type Mode = "login" | "register";

export default function Onboarding() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();
  const onAuthSuccess = async () => {
    await utils.auth.me.invalidate();
  };

  const loginMutation = trpc.auth.login.useMutation({ onSuccess: onAuthSuccess });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess: onAuthSuccess });
  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    try {
      if (mode === "login") {
        await loginMutation.mutateAsync({ email, password });
      } else {
        await registerMutation.mutateAsync({ name, email, password });
        toast.success("Conta criada com sucesso!");
      }
    } catch (err) {
      const message =
        err instanceof TRPCClientError
          ? err.message
          : "Algo deu errado. Tente novamente.";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#243FF7] flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
        <div className="absolute top-1/3 -left-10 w-40 h-40 bg-white/5 rounded-full" />
        <div className="absolute bottom-1/4 right-10 w-24 h-24 bg-[#E2FF04]/10 rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 px-6 pt-14 pb-10">
        {/* Logo */}
        <div className="flex items-center justify-center mb-6">
          <GoMark height={72} />
        </div>

        {/* Tagline */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Tecnologia que protege.
          </h1>
          <p className="text-base text-white/80">Confiança que acompanha.</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-4 gap-2 mb-8">
          <FeatureChip icon={MapPin} title="Rastreio" />
          <FeatureChip icon={Shield} title="Bloqueio" />
          <FeatureChip icon={Bell} title="Alertas" />
          <FeatureChip icon={Zap} title="SOS 24h" />
        </div>

        {/* Auth card */}
        <div className="bg-white rounded-2xl p-5 shadow-2xl">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                mode === "login" ? "bg-white text-[#243FF7] shadow-sm" : "text-gray-500"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`h-10 rounded-lg text-sm font-semibold transition-colors ${
                mode === "register" ? "bg-white text-[#243FF7] shadow-sm" : "text-gray-500"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-gray-700">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "register" ? "Mínimo 8 caracteres" : "Sua senha"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-13 min-h-[3rem] bg-[#243FF7] text-white font-bold text-base rounded-xl hover:bg-[#1e35d6] go-btn-active"
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === "login" ? (
                "Entrar"
              ) : (
                "Criar minha conta"
              )}
            </Button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-4">
            {mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => setMode("register")} className="text-[#243FF7] font-semibold">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" onClick={() => setMode("login")} className="text-[#243FF7] font-semibold">
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          GO Direction · Tecnologia que conecta.
        </p>
      </div>
    </div>
  );
}

function FeatureChip({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl py-3 flex flex-col items-center gap-1 border border-white/10">
      <Icon className="w-5 h-5 text-[#E2FF04]" />
      <p className="text-white/90 font-medium text-[11px]">{title}</p>
    </div>
  );
}
