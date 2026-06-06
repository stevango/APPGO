import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { LanguageProvider } from "./contexts/LanguageContext";
import { TRPC_URL } from "./lib/apiBase";
import { initNative } from "./lib/native";
import { initCampaignTheme } from "./lib/campaignTheme";
import "./index.css";

// Deploy novo → chunk antigo some. O Vite dispara este evento ao falhar o
// preload de um módulo; recarregamos uma vez para pegar a versão nova.
if (typeof window !== "undefined") {
  const reloadOnce = () => {
    const key = "go-chunk-reload-at";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  };
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
  window.addEventListener("unhandledrejection", (e) => {
    const msg = String((e as PromiseRejectionEvent)?.reason?.message || "");
    if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(msg)) reloadOnce();
  });
}

const queryClient = new QueryClient();

// When a session expires, the public `auth.me` query simply returns null, so the
// app automatically falls back to the in-app login screen (see App.tsx). We just
// log unexpected errors here — no external redirect.
queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: TRPC_URL,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </trpc.Provider>
);

// Initialize native (iOS/Android) behaviors; no-op on the web.
void initNative();

// Tema sazonal compartilhado com a GO360 (cor/slogan/ícone do dia). Best-effort.
initCampaignTheme();
