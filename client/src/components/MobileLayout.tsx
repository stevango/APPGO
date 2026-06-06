import { useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Home, MapPin, Bell, User, AlertTriangle } from "lucide-react";

interface MobileLayoutProps {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const [location, setLocation] = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // Toda troca de página começa no topo (o scroll fica no <main>, não na janela).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  const navItems = [
    { path: "/", icon: Home, label: "Início" },
    { path: "/tracking", icon: MapPin, label: "Rastrear" },
    { path: "/sos", icon: AlertTriangle, label: "SOS", isSpecial: true },
    { path: "/notifications", icon: Bell, label: "Alertas" },
    { path: "/profile", icon: User, label: "Perfil" },
  ];

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col max-w-md mx-auto relative">
      {/* Main Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        <div className="page-enter">
          {children}
        </div>
      </main>

      {/* Bottom Navigation Bar - Frosted glass effect */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-gray-100/80 pb-safe z-50 shadow-[0_-2px_20px_oklch(0_0_0/0.04)]">
        <div className="max-w-md mx-auto flex items-center justify-around h-[68px] px-1">
          {navItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;

            if (item.isSpecial) {
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className="relative -top-5 go-btn-active"
                  aria-label={item.label}
                >
                  <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-b from-[#3B5BFF] to-[#1A2FD4] flex items-center justify-center shadow-[0_4px_20px_oklch(0.432_0.258_264/0.4)] ring-4 ring-white">
                    <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-[10px] font-semibold text-[#243FF7] text-center block mt-1">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center justify-center gap-1 py-2 px-4 go-btn-active relative"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-[#243FF7] rounded-full" />
                )}
                <Icon
                  className={`w-[22px] h-[22px] transition-all duration-200 ${
                    isActive ? "text-[#243FF7]" : "text-gray-400"
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span
                  className={`text-[10px] transition-all duration-200 ${
                    isActive ? "text-[#243FF7] font-semibold" : "text-gray-400 font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
