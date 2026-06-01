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
