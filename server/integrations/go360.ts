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

import * as db from "../db";

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

/**
 * Syncs the customer's GO360 vehicles/equipment into our local `vehicles` table
 * so the app screens (Home, Tracking) show them. Real-time GPS still arrives via
 * /api/ingest/telemetry, matched by trackerSerial (IMEI / id_tracker).
 */
export async function syncGo360Equipment(userId: number, token: string): Promise<{ synced: number }> {
  const resp: any = await go360Equipamento(token);
  const veiculos: any[] = Array.isArray(resp?.veiculos) ? resp.veiculos : [];
  let synced = 0;

  for (const v of veiculos) {
    const eq = v.equipamento || {};
    const serial = eq.imei || eq.id_tracker || eq.iccid || null;
    const productActive = String(v.status_produto ?? "").toUpperCase() === "ATIVO";
    const trackerOp = String(eq.status ?? "").toLowerCase() === "em_operacao";
    const trackerStatus: "online" | "offline" = productActive && trackerOp ? "online" : "offline";
    const year = parseInt(String(v.ano_modelo ?? v.ano_fabricacao ?? ""), 10);

    await db.upsertGo360Vehicle(userId, {
      plate: String(v.placa ?? serial ?? "SEM-PLACA").toUpperCase(),
      brand: v.marca ?? null,
      model: v.modelo ?? "Veículo",
      color: v.cor ?? null,
      year: Number.isFinite(year) ? year : null,
      trackerSerial: serial ? String(serial) : null,
      trackerModel: eq.modelo ?? null,
      trackerStatus,
    });
    synced++;
  }
  return { synced };
}
