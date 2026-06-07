/**
 * Reverse geocoding via OpenStreetMap's Nominatim service (free, no API key).
 *
 * Usage policy: send a descriptive User-Agent and keep volume modest
 * (<= ~1 req/s). For higher volumes, self-host Nominatim or use a paid OSM
 * provider and point NOMINATIM_URL at it.
 */
const NOMINATIM_URL = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "GO-Direction-App/1.0 (+https://godirection.app)";

export async function reverseGeocode(
  latitude: string,
  longitude: string,
): Promise<string | null> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", latitude);
  url.searchParams.set("lon", longitude);
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("zoom", "18");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Nominatim request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { display_name?: string };
  return data.display_name ?? null;
}

const NOMINATIM_BASE = NOMINATIM_URL.replace(/\/reverse\/?$/, "");
const NOMINATIM_SEARCH = `${NOMINATIM_BASE}/search`;

export type GeoSuggestion = { label: string; lat: string; lng: string };

/** Forward geocoding (address → coordinates) via Nominatim, limited to Brazil. */
async function geocodeForward(query: string): Promise<GeoSuggestion[]> {
  const url = new URL(NOMINATIM_SEARCH);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((d) => ({ label: d.display_name, lat: d.lat, lng: d.lon }));
}

/**
 * Address/CEP search for the location picker. If the query is a CEP (8 digits),
 * resolves it via ViaCEP and then geocodes the resulting address.
 */
export async function searchAddress(query: string): Promise<GeoSuggestion[]> {
  const digits = query.replace(/\D/g, "");

  if (digits.length === 8) {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { headers: { Accept: "application/json" } });
      if (r.ok) {
        const c = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
        if (!c.erro) {
          const parts = [c.logradouro, c.bairro, c.localidade, c.uf].filter(Boolean);
          const addr = parts.join(", ");
          const geo = await geocodeForward(`${addr}, ${digits}`);
          if (geo.length > 0) return geo.map((g) => ({ ...g, label: `${addr} (${digits.slice(0, 5)}-${digits.slice(5)})` }));
          // Fall back to city-level if the street wasn't found
          const cityGeo = await geocodeForward([c.localidade, c.uf].filter(Boolean).join(", "));
          if (cityGeo.length > 0) return [{ ...cityGeo[0], label: `${addr || c.localidade} (${digits.slice(0, 5)}-${digits.slice(5)})` }];
        }
      }
    } catch {
      /* fall through to text search */
    }
  }

  return geocodeForward(query);
}

