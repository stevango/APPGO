/**
 * Roleta da Sorte — as REGRAS ficam no GO360 (admin de marketing/CS); a roleta
 * só RODA no app. Sorteio é server-side no GO360 (ponderado, com estoque,
 * cooldown e limites). Aqui apenas proxiamos os 4 endpoints do app usando o
 * token GO360 do cliente (guardado e descriptografado no servidor).
 *
 *   Base: {GO360_BASE_URL}/roletas      (Bearer <token do cliente>)
 *   GET  /disponiveis?trigger=<gatilho>
 *   POST /:id/girar            body { contexto? }
 *   POST /giros/:giroId/resgatar
 *   GET  /elegibilidade/:id
 */
const BASE = () =>
  (process.env.GO360_BASE_URL || "https://go360id-production.up.railway.app/api/app").replace(/\/+$/, "") + "/roletas";

export type RoletaTrigger =
  | "acesso_app"
  | "trocou_pagamento"
  | "intencao_excluir_conta"
  | "intencao_cancelar_contrato"
  | "manual";

export type RoletaPremio = {
  id: number;
  nome: string;
  descricao: string | null;
  cor: string;
  peso: number;
  imagem: string | null;
  imagemUrl?: string | null;
};

export type Roleta = {
  id: number;
  slug: string;
  nome: string;
  descricao: string;
  trigger: RoletaTrigger;
  ativa: boolean;
  mensagemChamada: string;
  mensagemPos: string;
  corDestaque: string;
  imagemUrl?: string | null;
  premios: RoletaPremio[];
};

export type GiroResult = {
  ok: boolean;
  giro: { id: number; premioNome: string; girouEm: string };
  premio: RoletaPremio;
};

export type Elegibilidade = {
  elegivel: boolean;
  motivo: string | null;
  girosRestantes: number;
  proximoGiroEm: string | null;
};

async function call(token: string, path: string, init?: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const message = json?.message || json?.error || `Falha (${res.status})`;
      const err = new Error(message) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function roletasDisponiveis(token: string, trigger: RoletaTrigger): Promise<Roleta[]> {
  const json = await call(token, `/disponiveis?trigger=${encodeURIComponent(trigger)}`).catch(() => null);
  return Array.isArray(json?.disponiveis) ? (json.disponiveis as Roleta[]) : [];
}

export async function roletaGirar(token: string, roletaId: number, contexto?: unknown): Promise<GiroResult> {
  return call(token, `/${roletaId}/girar`, {
    method: "POST",
    body: JSON.stringify({ contexto: contexto ?? null }),
  });
}

export async function roletaResgatar(token: string, giroId: number): Promise<{ ok: boolean }> {
  return call(token, `/giros/${giroId}/resgatar`, { method: "POST" });
}

export async function roletaElegibilidade(token: string, roletaId: number): Promise<Elegibilidade | null> {
  return call(token, `/elegibilidade/${roletaId}`).catch(() => null);
}
