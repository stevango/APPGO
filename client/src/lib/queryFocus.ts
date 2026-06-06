import { focusManager, onlineManager } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";

/**
 * Faz o React Query saber quando o app está em primeiro/segundo plano.
 *
 * Com isso, as queries com `refetchInterval` (Home 15s, Rastrear 10s, etc.)
 * PAUSAM quando o app vai para segundo plano e voltam a atualizar ao reabrir —
 * economia real de bateria e dados para quem usa o app todo dia. Cobre web
 * (visibilitychange) e nativo (Capacitor App.appStateChange).
 */
export function initQueryFocus(): void {
  focusManager.setEventListener((handleFocus) => {
    const onVisibility = () => handleFocus(document.visibilityState === "visible");
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility, false);
    }

    let removeNative: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => handleFocus(isActive)),
        )
        .then((handle) => { removeNative = () => handle.remove(); })
        .catch(() => { /* plugin indisponível: cai só no visibilitychange */ });
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      removeNative?.();
    };
  });

  // Reconexão de rede: ao voltar a ter internet, revalida (web).
  if (typeof window !== "undefined") {
    onlineManager.setEventListener((setOnline) => {
      const on = () => setOnline(true);
      const off = () => setOnline(false);
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      return () => {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
      };
    });
  }
}
