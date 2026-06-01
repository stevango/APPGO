import { Capacitor } from "@capacitor/core";

/**
 * Base URL for the backend API.
 *
 * - Web (served by our Express server): empty string → same-origin relative calls.
 * - Native app (Capacitor): the webview is served from localhost, so it MUST call
 *   the production backend over the network. Set `VITE_API_URL` at build time.
 */
export const API_BASE_URL: string = (() => {
  const explicit = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (Capacitor.isNativePlatform()) {
    console.warn(
      "[GO] VITE_API_URL não está definido. Defina a URL do backend de produção para o app nativo funcionar.",
    );
  }
  return "";
})();

export const TRPC_URL = `${API_BASE_URL}/api/trpc`;
