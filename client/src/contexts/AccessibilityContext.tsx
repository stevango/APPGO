import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

/**
 * Acessibilidade do app — pensada para pessoas com deficiência VISUAL e AUDITIVA.
 *
 *  - Visual: tamanho de texto (zoom), alto contraste, reduzir animações.
 *    (Some-se a isso o suporte a leitor de tela — VoiceOver/TalkBack — via
 *    aria-labels/roles espalhados pelo app.)
 *  - Auditiva: vibração (háptico) em alertas críticos, já que o som não é uma
 *    opção. Cada alerta importante tem sempre um equivalente VISUAL + VIBRAÇÃO.
 *
 * As preferências são salvas no aparelho e aplicadas no <html> via classes/atrib.
 */
export type FontScale = "normal" | "large" | "xlarge";

export type A11ySettings = {
  fontScale: FontScale;
  highContrast: boolean;
  reduceMotion: boolean;
  hapticAlerts: boolean;
};

const DEFAULTS: A11ySettings = {
  fontScale: "normal",
  highContrast: false,
  // Respeita a preferência do sistema por padrão (vestibular/visual).
  reduceMotion: typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
  hapticAlerts: true,
};

const STORAGE_KEY = "go-a11y";

function load(): A11ySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function apply(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-font-scale", s.fontScale);
  root.classList.toggle("a11y-contrast", s.highContrast);
  root.classList.toggle("a11y-reduce-motion", s.reduceMotion);
}

type Ctx = {
  settings: A11ySettings;
  setSettings: (patch: Partial<A11ySettings>) => void;
};

const AccessibilityContext = createContext<Ctx | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setState] = useState<A11ySettings>(() => load());

  // Aplica na montagem e sempre que mudar.
  useEffect(() => { apply(settings); }, [settings]);

  const setSettings = useCallback((patch: Partial<A11ySettings>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <AccessibilityContext.Provider value={{ settings, setSettings }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}

/** Lê as preferências fora de React (ex.: helper de háptico). */
export function getA11ySettings(): A11ySettings {
  return load();
}
