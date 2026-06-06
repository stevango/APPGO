/**
 * Integração com o Caçador / Olho de Deus (recuperação veicular).
 * Envia a ocorrência comunicada no app para a quarentena deles, que a equipe
 * revisa e promove a ocorrência oficial (caçadores são acionados).
 *
 * Ativada por env (sem elas, é no-op e o app só registra a ocorrência local):
 *   CACADOR_BASE_URL=https://<host-do-cacador>
 *   CACADOR_GO_APP_TOKEN=<token do Admin > Integrações > GO APP>
 */
const BASE = () => (process.env.CACADOR_BASE_URL || "").replace(/\/+$/, "");
const TOKEN = () => process.env.CACADOR_GO_APP_TOKEN || "";

export function cacadorEnabled(): boolean {
  return !!BASE() && !!TOKEN();
}

// Mapeia o tipo da tela mobile → enum do Caçador.
export function mapTipoOcorrencia(t: string): string {
  return ({
    furto: "furto",
    roubo: "roubo",
    apropriacao: "apropriacao_indebita",
    golpe: "golpe",
    outro: "outros",
  } as Record<string, string>)[t] ?? "outros";
}

export type CacadorResult = { ok: boolean; status?: string; quarentenaId?: number; error?: string };

export async function sendOcorrenciaToCacador(payload: Record<string, unknown>): Promise<CacadorResult> {
  if (!cacadorEnabled()) return { ok: false, error: "not_configured" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE()}/api/v1/go-app/ocorrencia`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN()}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `http_${res.status}`, status: json?.status, quarentenaId: json?.quarentenaId };
    return { ok: true, status: json?.status, quarentenaId: json?.quarentenaId };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}
