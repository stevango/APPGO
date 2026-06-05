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

/** Position history for a tracker (ativoId). Returns the GO360 payload as-is. */
export function go360Historico(token: string, ativoId: string, opts: { desde?: string; ate?: string; limit?: number } = {}) {
  const qs = new URLSearchParams({ ativoId });
  if (opts.desde) qs.set("desde", opts.desde);
  if (opts.ate) qs.set("ate", opts.ate);
  qs.set("limit", String(opts.limit ?? 500));
  return go360Request(`/equipamento/posicoes-historico?${qs.toString()}`, { token });
}

/**
 * Syncs the customer's GO360 vehicles/equipment into our local `vehicles` table
 * so the app screens (Home, Tracking) show them. Real-time GPS still arrives via
 * /api/ingest/telemetry, matched by trackerSerial (IMEI / id_tracker).
 */
export async function syncGo360Equipment(userId: number, token: string): Promise<{ synced: number }> {
  const resp: any = await go360Equipamento(token);
  const veiculos: any[] = Array.isArray(resp?.veiculos) ? resp.veiculos : [];
  let synced = 0;

  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const val = o?.[k]; if (val !== undefined && val !== null && val !== "") return val; }
    return undefined;
  };
  const trackerOf = (v: any) => v?.equipamento || v?.tracker || null;
  const hasTracker = (v: any) => {
    const eq = trackerOf(v);
    return !!(eq && (eq.imei || eq.id_tracker || eq.idTracker || eq.serie || eq.serial));
  };

  // GO360 can return duplicate rows for the same plate (one with tracker, one
  // without). Keep one per plate, preferring the entry that has the tracker.
  const byPlate = new Map<string, any>();
  for (const v of veiculos) {
    const plate = String(pick(v, "placa", "plate") ?? "").toUpperCase();
    const key = plate || pick(trackerOf(v), "id_tracker", "imei") || String(byPlate.size);
    const prev = byPlate.get(key);
    if (!prev || (hasTracker(v) && !hasTracker(prev))) byPlate.set(key, v);
  }

  for (const v of Array.from(byPlate.values())) {
    const eq = trackerOf(v) || {};
    const serial = pick(eq, "imei", "id_tracker", "idTracker", "serie", "serial") ?? pick(v, "imei", "id_tracker");
    const productActive = String(pick(v, "status_produto", "statusProduto", "situacao") ?? "").toUpperCase().includes("ATIV");
    const trackerOp = ["em_operacao", "operando", "ativo", "online"].includes(String(pick(eq, "status") ?? "").toLowerCase());
    const trackerStatus: "online" | "offline" = productActive && trackerOp ? "online" : "offline";
    const year = parseInt(String(pick(v, "ano_modelo", "anoModelo", "ano_fabricacao", "anoFabricacao", "ano") ?? ""), 10);

    // GO360 often has marca/modelo empty → fall back to the product label.
    const brand = pick(v, "marca", "fabricante", "montadora", "marca_veiculo", "marcaVeiculo") ?? null;
    const model =
      pick(v, "modelo", "modelo_veiculo", "modeloVeiculo", "versao", "descricao", "nome") ??
      (brand ? "Veículo" : (pick(v, "produto") ?? "Veículo"));

    // Last known position — IF GO360 ever includes it (it currently does not).
    // We read it from several likely locations so the map "just works" the day
    // GO360 adds it, without a deploy on our side.
    const pos = pick(v, "ultima_posicao", "ultimaPosicao", "posicao", "localizacao", "last_position") || pick(eq, "ultima_posicao", "posicao") || v;
    const lat = pick(pos, "latitude", "lat", "lng_lat");
    const lng = pick(pos, "longitude", "lng", "lon", "long");
    const posSpeed = pick(pos, "velocidade", "speed");
    const posAt = pick(pos, "data", "evento_em", "eventoEm", "capturado_em", "capturadoEm", "ultima_comunicacao", "ultimaComunicacao");
    const lastSignalAt = posAt ? new Date(String(posAt)) : null;

    await db.upsertGo360Vehicle(userId, {
      plate: String(pick(v, "placa", "plate") ?? serial ?? "SEM-PLACA").toUpperCase(),
      brand,
      model,
      color: pick(v, "cor", "cor_veiculo") ?? null,
      year: Number.isFinite(year) ? year : null,
      trackerSerial: serial ? String(serial) : null,
      trackerModel: pick(eq, "modelo", "fabricante", "model") ?? null,
      go360AtivoId: pick(eq, "id", "ativo_id", "ativoId") ? String(pick(eq, "id", "ativo_id", "ativoId")) : null,
      trackerStatus,
      latitude: lat != null ? String(lat) : null,
      longitude: lng != null ? String(lng) : null,
      lastAddress: pick(pos, "endereco", "address") ?? null,
      speed: posSpeed != null ? Number(posSpeed) : null,
      ignition: pick(pos, "ignicao", "ignition") != null ? Boolean(pick(pos, "ignicao", "ignition")) : null,
      lastSignalAt: lastSignalAt && !isNaN(lastSignalAt.getTime()) ? lastSignalAt : null,
    });
    synced++;
  }
  return { synced };
}
