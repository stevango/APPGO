/**
 * GO360 "App API" client — the end-customer portal backend.
 * Base: https://go360id-production.up.railway.app/api/app  (JWT per user)
 *
 * This API provides identity, equipment (IoT/IMEI), DocuSign contracts and
 * ASAAS billing — NOT GPS position (real-time location comes from the tracker
 * hardware via /api/ingest/telemetry).
 *
 * Enabled only when GO360_ENABLED=1 (so the demo/local login is unaffected).
 *   GO360_ENABLED=1
 *   GO360_BASE_URL=https://go360id-production.up.railway.app/api/app
 */
const BASE = () => (process.env.GO360_BASE_URL || "https://go360id-production.up.railway.app/api/app").replace(/\/+$/, "");

export function go360Enabled(): boolean {
  return process.env.GO360_ENABLED === "1";
}

async function go360Request<T = any>(
  path: string,
  opts: { method?: "GET" | "POST"; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE()}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: any = undefined;
  try { json = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }

  if (!res.ok) {
    const err: any = new Error(`GO360 ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = json ?? text;
    throw err;
  }
  return json as T;
}

export type Go360Cliente = { id: string; nome?: string; email?: string; cpf?: string };
export type Go360LoginResp = { token: string; mustChangePassword?: boolean; cliente: Go360Cliente };

export function go360Login(email: string, senha: string): Promise<Go360LoginResp> {
  return go360Request<Go360LoginResp>("/auth/login", { method: "POST", body: { email, senha } });
}

export function go360FirstAccess(input: { email: string; senhaTemp: string; novaSenha: string; aceites: string[] }): Promise<any> {
  return go360Request("/auth/primeiro-acesso", { method: "POST", body: input });
}

export const go360Me = (token: string) => go360Request("/me", { token });
export const go360Equipamento = (token: string) => go360Request("/equipamento", { token });
export const go360Contrato = (token: string) => go360Request("/contrato", { token });
export const go360Cobranca = (token: string) => go360Request("/cobranca", { token });
export const go360Jornada = (token: string) => go360Request("/minha-jornada", { token });
