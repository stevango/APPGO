/**
 * Status de monitoramento do rastreador — FONTE OFICIAL: GO360.
 *
 * A GO360 expõe a régua de status (online/standby/offline/manutenção) num
 * endpoint público. O app consome esse status em vez de duplicar a lógica:
 * quando a GO360 muda a régua (ex.: offline de 72h → 96h) no admin, o app
 * reflete no próximo refresh — sem deploy dos dois lados.
 *
 *   GET {host}/api/public/monitoramento/rastreador/:identificador   (cache 60s)
 *   identificador = IMEI, série, placa ou chassi
 *
 * Config (opcional — sem isso, derivamos do host do GO360):
 *   MONITORAMENTO_BASE_URL=https://<host>   (sem o /api/...)
 */
function baseHost(): string {
  const explicit = (process.env.MONITORAMENTO_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;
  const go360 = (process.env.GO360_BASE_URL || "https://go360id-production.up.railway.app/api/app").trim();
  try {
    const u = new URL(go360);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://go360id-production.up.railway.app";
  }
}

export type MonitoramentoRotulo = { label: string; cor: string; descricao: string };
export type MonitoramentoItem = {
  ativoId?: string;
  status: string;
  rotulo: MonitoramentoRotulo;
  horasSemComunicar?: number;
  ultimaComunicacao?: string;
  placa?: string;
  chassi?: string;
  imei?: string;
  serie?: string;
  veiculo?: string;
  cliente?: string;
};

// Cache em memória por identificador (60s, igual ao Cache-Control do upstream).
const cache = new Map<string, { at: number; item: MonitoramentoItem | null }>();
const TTL_MS = 60 * 1000;

export async function getMonitoramento(identificador: string): Promise<MonitoramentoItem | null> {
  const id = (identificador || "").trim();
  if (!id) return null;
  const key = id.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.item;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(
      `${baseHost()}/api/public/monitoramento/rastreador/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" }, signal: ctrl.signal },
    );
    if (res.status === 404) {
      cache.set(key, { at: Date.now(), item: null });
      return null;
    }
    if (!res.ok) throw new Error(`http_${res.status}`);
    const json: any = await res.json().catch(() => null);
    const item: MonitoramentoItem | null =
      json?.item && json?.encontrado !== false ? (json.item as MonitoramentoItem) : null;
    cache.set(key, { at: Date.now(), item });
    return item;
  } catch {
    // Em falha, devolve o último bom (se houver) — o app cai na régua local.
    return hit?.item ?? null;
  } finally {
    clearTimeout(timer);
  }
}
