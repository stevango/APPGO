/**
 * Tema de campanha vigente (calendário sazonal compartilhado com a GO360).
 *
 * A GO360 expõe um endpoint público (sem auth) com o tema do dia — cor, slogan
 * e ícone. O app aplica o mesmo tema, então os dois sistemas ficam idênticos no
 * mesmo dia sem precisar de deploy em nenhum dos lados.
 *
 *   Upstream: GET {host}/api/public/campanhas/tema-vigente   (Cache-Control 5min)
 *
 * Config (opcional — sem isso, derivamos do host do GO360):
 *   CAMPANHAS_TEMA_URL=https://<host>/api/public/campanhas/tema-vigente
 */

// Deriva a URL do tema a partir do host do GO360 (.../api/app → .../api/public/...)
function temaUrl(): string {
  const explicit = (process.env.CAMPANHAS_TEMA_URL || "").trim();
  if (explicit) return explicit;
  const go360 = (process.env.GO360_BASE_URL || "https://go360id-production.up.railway.app/api/app").trim();
  try {
    const u = new URL(go360);
    return `${u.protocol}//${u.host}/api/public/campanhas/tema-vigente`;
  } catch {
    return "https://go360id-production.up.railway.app/api/public/campanhas/tema-vigente";
  }
}

export type CampaignTheme = {
  /** identificador estável da campanha (para dedup/telemetria), se vier */
  id?: string | null;
  /** nome amigável: "Copa do Mundo", "Outubro Rosa"… */
  nome: string | null;
  /** cor de destaque (#RRGGBB). Pode ser uma lista; usamos a primeira como principal */
  cor: string | null;
  /** segunda cor (degradê/acento secundário), quando a campanha tem duas */
  cor2: string | null;
  /** frase curta exibida nos loaders/splash */
  slogan: string | null;
  /** emoji/ícone curto (🏆, 🎄…) */
  icone: string | null;
  /** se há campanha ativa hoje */
  vigente: boolean;
};

const EMPTY: CampaignTheme = {
  id: null, nome: null, cor: null, cor2: null, slogan: null, icone: null, vigente: false,
};

function firstString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return null;
}

// O formato exato do JSON da GO360 pode variar; normalizamos de forma defensiva.
export function normalizeTheme(raw: any): CampaignTheme {
  if (!raw || typeof raw !== "object") return EMPTY;
  const data = raw.tema ?? raw.campanha ?? raw.data ?? raw;
  if (!data || typeof data !== "object") return EMPTY;

  // cores podem vir como string única, "a,b", array, ou campos separados
  let cor = firstString(data, ["cor", "color", "corPrimaria", "primaryColor", "accent"]);
  let cor2 = firstString(data, ["cor2", "corSecundaria", "secondaryColor"]);
  const cores = data.cores ?? data.colors;
  if (Array.isArray(cores)) {
    cor = cor ?? (typeof cores[0] === "string" ? cores[0] : null);
    cor2 = cor2 ?? (typeof cores[1] === "string" ? cores[1] : null);
  } else if (typeof cores === "string" && cores.includes(",")) {
    const parts = cores.split(",").map((s) => s.trim()).filter(Boolean);
    cor = cor ?? parts[0] ?? null;
    cor2 = cor2 ?? parts[1] ?? null;
  }

  const normHex = (c: string | null) => {
    if (!c) return null;
    const s = c.startsWith("#") || c.startsWith("rgb") || c.startsWith("hsl") ? c : `#${c}`;
    // valida #RGB/#RRGGBB para não injetar lixo no CSS var
    if (/^#[0-9a-fA-F]{3}$/.test(s) || /^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^(rgb|hsl)a?\(/.test(s)) return s;
    return null;
  };

  const nome = firstString(data, ["nome", "name", "titulo", "title", "campanha"]);
  const vigenteRaw = data.vigente ?? data.ativo ?? data.active ?? data.isActive;
  const vigente = vigenteRaw === undefined ? !!nome : !!vigenteRaw;

  return {
    id: firstString(data, ["id", "slug", "key", "codigo"]),
    nome,
    cor: normHex(cor),
    cor2: normHex(cor2),
    slogan: firstString(data, ["slogan", "frase", "mensagem", "message", "tagline"]),
    icone: firstString(data, ["icone", "icon", "emoji", "simbolo"]),
    vigente,
  };
}

// Cache em memória (5 min) — o app pode chamar muitas vezes no boot/refoco.
let cache: { at: number; theme: CampaignTheme } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getCampaignTheme(): Promise<CampaignTheme> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.theme;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(temaUrl(), {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const json = await res.json();
    const theme = normalizeTheme(json);
    cache = { at: Date.now(), theme };
    return theme;
  } catch (e) {
    // Em falha, devolve o último tema bom (se houver) ou vazio — nunca quebra o boot.
    if (cache) return cache.theme;
    return EMPTY;
  } finally {
    clearTimeout(timer);
  }
}
