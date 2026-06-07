import { useSyncExternalStore } from "react";
import { API_BASE_URL } from "./apiBase";

/**
 * Tema de campanha vigente (sazonal), compartilhado com a GO360.
 *
 * Buscamos no boot do app o tema do dia (cor/slogan/ícone) e aplicamos a marca
 * de forma sutil — o mesmo dia mostra o mesmo tema nos dois sistemas, sem deploy.
 * Endpoint same-origin (proxy no nosso backend): GET /api/campanhas/tema-vigente
 *
 * Tudo é best-effort: se o fetch falhar, o app segue com a marca padrão.
 */
export type CampaignTheme = {
  id?: string | null;
  nome: string | null;
  cor: string | null;
  cor2: string | null;
  slogan: string | null;
  icone: string | null;
  vigente: boolean;
};

const EMPTY: CampaignTheme = {
  id: null, nome: null, cor: null, cor2: null, slogan: null, icone: null, vigente: false,
};

const CACHE_KEY = "go-campaign-theme";
const TTL_MS = 6 * 60 * 60 * 1000; // 6h no cliente; o servidor revalida a cada 5min

let theme: CampaignTheme = readCache() ?? EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readCache(): CampaignTheme | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, theme } = JSON.parse(raw);
    if (!at || Date.now() - at > TTL_MS) return null;
    return theme as CampaignTheme;
  } catch {
    return null;
  }
}

function writeCache(t: CampaignTheme) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), theme: t }));
  } catch {
    /* ignore */
  }
}

/** Aplica a cor de destaque como CSS var (--go-accent) no <html>. */
function applyTheme(t: CampaignTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t.vigente && t.cor) {
    root.style.setProperty("--go-accent", t.cor);
    root.style.setProperty("--go-accent-2", t.cor2 || t.cor);
    root.setAttribute("data-campaign", t.id || t.nome || "on");
  } else {
    root.style.removeProperty("--go-accent");
    root.style.removeProperty("--go-accent-2");
    root.removeAttribute("data-campaign");
  }
}

export function getCampaignTheme(): CampaignTheme {
  return theme;
}

export function useCampaignTheme(): CampaignTheme {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getCampaignTheme,
    () => EMPTY,
  );
}

let started = false;
/** Busca o tema no boot (uma vez). Aplica o cache imediatamente e revalida. */
export function initCampaignTheme(): void {
  if (started) return;
  started = true;
  applyTheme(theme); // pinta na hora com o cache (se houver)

  fetch(`${API_BASE_URL}/api/campanhas/tema-vigente`, {
    headers: { Accept: "application/json" },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((t: CampaignTheme | null) => {
      if (!t || typeof t !== "object") return;
      theme = { ...EMPTY, ...t };
      writeCache(theme);
      applyTheme(theme);
      emit();
    })
    .catch(() => { /* segue com a marca padrão */ });
}
