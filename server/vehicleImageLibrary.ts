import * as db from "./db";

/**
 * Biblioteca de imagens de modelos que se auto-constrói. Indexada por
 * marca|modelo|ano:
 *  - 1ª vez de um modelo: tenta buscar (Google Programmable Search, se houver
 *    chave) e guarda no banco.
 *  - próximas vezes: vem do cache (custo zero, instantâneo).
 *
 * Sem GOOGLE_CSE_KEY/GOOGLE_CSE_CX, a busca automática é desligada e usamos só
 * o que estiver na biblioteca (curadoria manual) — sem risco de copyright.
 *
 *   GOOGLE_CSE_KEY=...   (API key do Custom Search JSON API)
 *   GOOGLE_CSE_CX=...    (ID do mecanismo de pesquisa com Busca de imagens ON)
 */
const cseEnabled = () => !!process.env.GOOGLE_CSE_KEY && !!process.env.GOOGLE_CSE_CX;

function normalize(make?: string | null, model?: string | null, year?: number | null) {
  const mk = String(make || "").trim().toLowerCase();
  // Pega só a "família" do modelo (1ª palavra) para casar Versa, Versa 1.0, etc.
  const md = String(model || "").trim().toLowerCase().split(/\s+/)[0] || "";
  return { make: mk, model: md, year: year ?? null };
}

async function fetchFromGoogle(make: string, model: string, year: number | null): Promise<string | null> {
  if (!cseEnabled()) return null;
  const q = `${make} ${model} ${year ?? ""} carro`.trim();
  const params = new URLSearchParams({
    key: process.env.GOOGLE_CSE_KEY!,
    cx: process.env.GOOGLE_CSE_CX!,
    q,
    searchType: "image",
    fileType: "png",
    imgType: "photo",
    num: "1",
    safe: "active",
  });
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params.toString()}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json: any = await res.json();
    const link = json?.items?.[0]?.link;
    return typeof link === "string" && link.startsWith("http") ? link : null;
  } catch {
    return null;
  }
}

/**
 * Cache-first: retorna a imagem do modelo da biblioteca; se faltar e houver
 * provedor configurado, busca, guarda e retorna. Nunca lança.
 */
export async function resolveModelImage(
  make?: string | null, model?: string | null, year?: number | null,
): Promise<string | null> {
  const k = normalize(make, model, year);
  if (!k.make || !k.model) return null;
  try {
    const cached = await db.getModelImage(k.make, k.model, k.year);
    if (cached?.imageUrl) return cached.imageUrl;
    const found = await fetchFromGoogle(k.make, k.model, k.year);
    if (found) {
      await db.upsertModelImage({ make: k.make, model: k.model, year: k.year, imageUrl: found, source: "google" });
      return found;
    }
  } catch {
    /* degrade graciosamente */
  }
  return null;
}
