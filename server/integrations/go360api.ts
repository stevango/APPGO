/**
 * Cliente do namespace server-to-server da GO360: /api/v1/app/*
 *
 * Autenticação por API KEY (X-API-Key) — é o NOSSO backend agindo em nome do
 * cliente / lendo configs. A chave NUNCA vai para o app. Gere em
 * GO360 → Configurações → Chaves de API (scopes app:config:read,
 * app:cliente:read, app:cliente:write) e configure GO360_API_KEY.
 *
 * Módulo de Promoções de Pagamento: a GO360 configura (métodos, badges, banner,
 * benefícios, vigência); o app só RENDERIZA. Auditoria de cada mudança fica lá.
 */
// Por padrão deriva do host do GO360_BASE_URL (.../api/app → .../api/v1/app),
// que é o host já usado e acessível. Override por GO360_API_V1_BASE quando o
// domínio canônico (ex.: go360.gogestao.com.br) estiver no ar.
function defaultBase(): string {
  const go360 = (process.env.GO360_BASE_URL || "https://go360id-production.up.railway.app/api/app").trim();
  try {
    const u = new URL(go360);
    return `${u.protocol}//${u.host}/api/v1/app`;
  } catch {
    return "https://go360id-production.up.railway.app/api/v1/app";
  }
}
const BASE = () => (process.env.GO360_API_V1_BASE || defaultBase()).replace(/\/+$/, "");
const KEY = () => process.env.GO360_API_KEY || "";

export function go360ApiEnabled(): boolean {
  return !!KEY();
}

/** Base resolvida e prefixo da chave (mascarado) — para diagnóstico. */
export function go360ApiInfo() {
  const k = KEY();
  return { base: BASE(), keyPrefix: k ? `${k.slice(0, 8)}…(${k.length})` : null };
}

/** Probe cru do /health: devolve status/erro reais (não engole o erro). */
export async function go360HealthProbe(): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!go360ApiEnabled()) return { ok: false, error: "no_key" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE()}/health`, {
      headers: { "X-API-Key": KEY(), Accept: "application/json" },
      signal: ctrl.signal,
    });
    const body = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : body.slice(0, 300) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

export type PaymentMethodCfg = {
  id: number; codigo: string; nome: string; descricao: string; icone: string;
  badge: string | null; badgeCor: string | null; ativo: boolean; ordem: number;
};

export type Beneficio = {
  id: number; codigo: string; nome: string; descricao: string;
  tipo: "desconto_percentual" | "desconto_reais" | "brinde";
  valorPct?: number; valorReais?: number; brindeNome?: string; brindeDescricao?: string; icone: string;
};

export type Promocao = {
  id: number; slug: string; nome: string;
  metodoOrigem: string | null; metodoDestino: string;
  bannerTitulo: string; bannerSubtitulo: string; bannerCta: string; bannerBadge: string;
  bannerCor: string; bannerCorTexto: string; bannerCorCta: string;
  cardBeneficiosTitulo: string; cardBeneficiosTexto: string;
  escolhaTitulo: string; escolhaSubtitulo: string; permiteRecusar: boolean;
};

export type PromocaoResponse = { promocao: Promocao | null; beneficios: Beneficio[] };

export type MudarPayload = {
  cliente: { id: string; cpf: string; email: string };
  metodoAnterior: string;
  metodoNovo: string;
  promocaoId?: number;
  beneficioId?: number;
  recusouBeneficio?: boolean;
  contexto?: Record<string, unknown>;
};

async function call(path: string, init?: RequestInit): Promise<any> {
  if (!go360ApiEnabled()) throw new Error("go360_api_disabled");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE()}${path}`, {
      ...init,
      headers: {
        "X-API-Key": KEY(),
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(json?.message || json?.error || `http_${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Cache simples em memória ---------------------------------------------
const cache = new Map<string, { at: number; data: any }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function go360MetodosPagamento(): Promise<PaymentMethodCfg[]> {
  return cached("metodos", 6 * 60 * 60 * 1000, async () => {
    const j = await call("/config/pagamento/metodos").catch(() => null);
    return Array.isArray(j?.metodos) ? (j.metodos as PaymentMethodCfg[]) : [];
  });
}

export async function go360PromocaoPagamento(metodoAtual: string): Promise<PromocaoResponse> {
  return cached(`promo:${metodoAtual}`, 30 * 60 * 1000, async () => {
    const j = await call(`/pagamento/promocao?metodoAtual=${encodeURIComponent(metodoAtual)}`).catch(() => null);
    return { promocao: j?.promocao ?? null, beneficios: Array.isArray(j?.beneficios) ? j.beneficios : [] };
  });
}

export async function go360MudarPagamento(payload: MudarPayload): Promise<any> {
  return call("/pagamento/mudar", { method: "POST", body: JSON.stringify(payload) });
}
